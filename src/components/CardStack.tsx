import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import useCardStore, { CardData, CardMessage } from '../stores/cardStore';
import { X, ZoomIn, FileText, Loader } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import ReactMarkdown, { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSettingsStore } from '../stores/settingsStore';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { visit } from 'unist-util-visit';
import { Node, Parent, Literal } from 'unist';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';

// ================================================================================================
// #region Helper Functions & Types
// ================================================================================================

const ANIMATION_DURATION = 350; // ms, used for both JS timeouts and CSS transitions

type AnimationStatus = 
  | 'stable' 
  | 'stable-moving'
  | 'entering' // Generic entering state, handled by JS
  | 'exiting-dissolve'
  | 'exiting-fly-right'
  | 'exiting-fly-up-right'
  | 'exiting-shrink-out';

// NEW: A hint for the animation system about the user's action
type NavigationAction = 'create' | 'delete' | null;

interface AnimatedCard {
  id: string;
  card: CardData;
  status: AnimationStatus;
  style: React.CSSProperties;
}

function normalizeMathDelimiters(content: string): string {
  let normalized = content.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$');
  normalized = normalized.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
  return normalized;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const calculateCardPosition = (
    depth: number,
    centerX: number,
    centerY: number,
    availableHeight: number
) => {
    if (depth === 0) {
        return { x: centerX, y: centerY, scale: 1, rotation: 0, blur: 0, brightness: 1, opacity: 1 };
    }
    if (availableHeight <= centerY || availableHeight < 100) {
        return { x: centerX, y: centerY, scale: 0, rotation: 0, blur: 20, brightness: 0.5, opacity: 0 };
    }

    const ANGLE_STEP_DEG = 5;
    const SCALE_STEP = 0.04; 
    const BLUR_STEP_PX = 0.5;
    const BRIGHTNESS_STEP = 0.05;

    const chordLength = availableHeight/2;
    const radius = chordLength/2; 
    const circleCenterY = centerY + radius;
    const circleCenterX = centerX;

    const startAngleRad = Math.PI/2;
    const angleStepRad = (ANGLE_STEP_DEG * Math.PI) / 180;
    const cardAngleRad = startAngleRad + (depth * angleStepRad);
    
    const x = circleCenterX + radius * Math.cos(cardAngleRad);
    const y = circleCenterY - radius * Math.sin(cardAngleRad); 
    
    return {
        x, y,
        scale: Math.max(0, 1.0 - (depth * SCALE_STEP)),
        rotation: -ANGLE_STEP_DEG * depth,
        blur: depth * BLUR_STEP_PX,
        brightness: Math.max(0.6, 1 - (depth * BRIGHTNESS_STEP)),
        opacity: 0.9
    };
};

const findCommonAncestorId = (path1: CardData[], path2: CardData[]): string | null => {
    const path1Ids = new Set(path1.map(c => c.id));
    for (let i = path2.length - 1; i >= 0; i--) {
        if (path1Ids.has(path2[i].id)) return path2[i].id;
    }
    return null;
};
// #endregion

// ================================================================================================
// #region Markdown and Rendering Components
// ================================================================================================

// ... (Components like MarkdownRenderer, PreviewCard, CurrentCardDialog, ParentCard remain unchanged)
const remarkConceptualTerm = () => {
  return (tree: Node) => {
    visit(tree, 'text', (node: Literal, index: number | undefined, parent: Parent | undefined) => {
      const nodeValue = node.value as string;
      if (typeof nodeValue !== 'string' || !/@@.*?@@/.test(nodeValue) || !parent || !Array.isArray(parent.children) || typeof index !== 'number') return;
      
      const newNodes: (Node | Literal)[] = [];
      let lastIndex = 0;
      const regex = /@@(.*?)@@/g;
      let match;
      while ((match = regex.exec(nodeValue)) !== null) {
        if (match.index > lastIndex) {
          newNodes.push({ type: 'text', value: nodeValue.slice(lastIndex, match.index) });
        }
        newNodes.push({ type: 'html', value: `<span class="conceptual-term">${match[1]}</span>` });
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < nodeValue.length) newNodes.push({ type: 'text', value: nodeValue.slice(lastIndex) });
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
        return ['skip', index + newNodes.length];
      }
    });
  };
};

const customSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames!, 'ol', 'li'],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.div || []), 'className', 'style'],
    ol: [...(defaultSchema.attributes?.ol || []), 'className', 'start'],
    li: [...(defaultSchema.attributes?.li || []), 'className', 'checked', 'disabled'],
  },
};

interface CustomSpanProps extends React.HTMLAttributes<HTMLSpanElement> {
    children?: React.ReactNode;
    node?: ExtraProps['node'];
}

const MarkdownRenderer: React.FC<{ 
  content: string; 
  onTermClick?: (term: string, rect: DOMRect) => void;
}> = React.memo(({ content, onTermClick }) => {
  const customComponents: Components = {
    span: ({ node, children, ...props }: CustomSpanProps) => {
      if (props.className === 'conceptual-term') {
        const term = React.Children.toArray(children).join('');
        return (
          <span
            {...props}
            style={{ cursor: onTermClick ? 'pointer' : 'default' }}
            onClick={(e) => {
              if (onTermClick) {
                e.stopPropagation();
                onTermClick(term, e.currentTarget.getBoundingClientRect());
              }
            }}
          >
            {children}
          </span>
        );
      }
      return <span {...props}>{children}</span>;
    },
  };
  const normalizedContent = useMemo(() => normalizeMathDelimiters(content), [content]);
  return (
    <div className="markdown-content w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkConceptualTerm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, [rehypeSanitize, customSanitizeSchema]]}
        components={customComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
});

const PreviewCard: React.FC<{
  position: { top: number; left: number };
  content: string;
  isLoading: boolean;
  onClose: () => void;
  onCreate: () => void;
  parentRef: React.RefObject<HTMLDivElement>;
}> = ({ position, content, isLoading, onClose, onCreate, parentRef }) => {
  const cardWidth = parentRef.current ? parentRef.current.offsetWidth / 2 : 300;
  const cardHeight = parentRef.current ? parentRef.current.offsetHeight / 2 : 200;
  const cleanContent = content.replace(/@@(.*?)@@/g, '$1');
  const normalizedContent = useMemo(() => normalizeMathDelimiters(cleanContent), [cleanContent]);
  return (
    <div
      className="fixed bg-[#222222] text-white rounded-[16px] shadow-card p-3 flex flex-col z-50"
      style={{ left: position.left, top: position.top, width: cardWidth, height: cardHeight, transform: 'translate(10px, -50%)' }}
    >
      <div className="flex items-center justify-end w-full mb-1">
        <div className="flex items-center gap-2">
          <button onClick={onCreate} className="w-7 h-7 bg-[#4C4C4C] rounded-full flex items-center justify-center hover:bg-[#5C5C5C]" title="Create new card from preview">
            <ZoomIn className="w-4 h-4" color="#13E425" />
          </button>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full" title="Close preview">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="markdown-content w-full flex-1 overflow-y-auto min-h-0 text-sm [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-[#222222] [&::-webkit-scrollbar-thumb]:bg-[#888] [&::-webkit-scrollbar-thumb]:rounded-full">
        {isLoading && <Loader className="animate-spin text-gray-400 mx-auto mt-4" />}
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, [rehypeSanitize, customSanitizeSchema]]}>
            {normalizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const CurrentCardDialog: React.FC<{ 
  card: CardData; 
  cardRef?: React.RefObject<HTMLDivElement>; 
  onDelete: () => void;
  onCreateNew: () => void;
  onTextSelection: (text: string) => void;
  onCreateFromSelection: () => void;
  onTermClick: (term: string, rect: DOMRect) => void;
}> = ({ card, cardRef, onDelete, onCreateNew, onTextSelection, onCreateFromSelection, onTermClick }) => {
  const [selectionButton, setSelectionButton] = useState({ visible: false, top: 0, left: 0 });
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
      onTextSelection(selection.toString().trim()); 
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = cardRef?.current?.getBoundingClientRect();
      if (containerRect) {
        setSelectionButton({ visible: true, top: rect.top - containerRect.top, left: rect.right - containerRect.left });
      }
    } else {
      setSelectionButton({ visible: false, top: 0, left: 0 });
    }
  }, [onTextSelection, cardRef]);
  useEffect(() => {
    const handleMouseUp = () => setTimeout(handleTextSelection, 0);
    const container = cardRef?.current;
    if (container) { container.addEventListener('mouseup', handleMouseUp); }
    return () => { if (container) { container.removeEventListener('mouseup', handleMouseUp); } };
  }, [cardRef, handleTextSelection]);
  const handleCreateFromSelectionClick = () => {
    onCreateFromSelection();
    setSelectionButton({ visible: false, top: 0, left: 0 });
  };
  return (
    <div
      ref={cardRef}
      className="bg-[#222222] text-white rounded-[24px] shadow-card p-4 flex flex-col h-full w-full"
      style={{ boxShadow: '-4px 8px 24px rgba(0, 0, 0, 0.3)' }}
    >
      <style>{`
        .conceptual-term { cursor: pointer; font-weight: 500; border-bottom: 1px dotted #888; transition: border-bottom 0.2s; }
        .conceptual-term:hover { border-bottom: 1px solid #FFF; }
        .markdown-content ul, .markdown-content ol { padding-left: 1.75rem; margin-block: 0.5rem; }
        .markdown-content ol { list-style-type: decimal; }
        .markdown-content ul { list-style-type: disc; }
        .markdown-content li { margin-bottom: 0.25rem; }
      `}</style>
      
      {selectionButton.visible && (
        <button
          onClick={handleCreateFromSelectionClick}
          className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center hover:bg-[#5C5C5C] absolute z-10"
          title="Create new card from selection"
          style={{ top: selectionButton.top, left: selectionButton.left, transform: 'translate(-50%, -120%)' }}
        >
            <ZoomIn className="w-5 h-5" color="#13E425" />
        </button>
      )}

      <div className="flex items-center justify-between w-full mb-2 pb-1 border-b border-[#333]">
        <span className="font-normal text-title leading-9 flex-1 truncate pr-2">{card.title || 'Untitled Card'}</span>
        <div className="flex items-center gap-2">
          <button onClick={onCreateNew} className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center shadow-card hover:bg-[#5C5C5C]" title="Create new card">
            <ZoomIn className="w-5 h-5" color="#13E425" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full" title="Delete this card and its children">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="w-full flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#222222] [&::-webkit-scrollbar-thumb]:bg-[#D9D9D9] [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
        {card.messages && card.messages.length > 0 ? (
          <div className="flex flex-col gap-4"> 
            {card.messages.map((msg, idx) => (
              msg.role === 'user' ? (
                <div key={msg.id || idx} className="flex justify-end">
                  <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[90%]">
                    <span className="text-content whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              ) : (
                <div key={msg.id || idx} className="text-content max-w-full">
                  <MarkdownRenderer content={msg.content} onTermClick={onTermClick} />
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="text-center text-[#888] text-lg py-4">Start Exploring</div>
        )}
      </div>
    </div>
  );
};

const ParentCard: React.FC<{ 
  card: CardData; 
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}> = ({ card, onClick, onHoverStart, onHoverEnd }) => {
  return (
    <div
      className="absolute top-0 left-0 w-full h-full cursor-pointer transition-all duration-300 ease-in-out bg-[#222222] rounded-[24px] shadow-card"
      onClick={() => {
        onHoverEnd(); // 立即清除悬浮状态
        onClick();    // 然后执行卡片切换
      }}
      onMouseEnter={onHoverStart} // Report that hover has started
      onMouseLeave={onHoverEnd}   // Report that hover has ended
    >
      <div className="p-4 h-full flex flex-col text-white overflow-hidden pointer-events-none">
        <div className="font-normal text-title leading-9 mb-2 pb-1 border-b border-[#333] truncate">
          {card.title || 'Untitled Card'}
        </div>
        <div className="w-full flex-1 overflow-hidden min-h-0 relative text-sm">
          <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-[#222222] to-transparent z-10" />
          {card.messages && card.messages.length > 0 ? (
            <div className="flex flex-col gap-4 pr-2"> 
              {card.messages.slice(0, 5).map((msg, idx) => (
                msg.role === 'user' ? (
                  <div key={msg.id || idx} className="flex justify-end">
                    <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[90%]">
                      <span className="text-content whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id || idx} className="text-content max-w-full">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="text-center text-[#888] py-4">No content</div>
          )}
        </div>
      </div>
    </div>
  );
};
// #endregion

// ================================================================================================
// #region Animation Hook (REWRITTEN TO FIX ANIMATION JUMP)
// ================================================================================================


const useAnimation = (
    currentCardId: string | null,
    getCardPath: (id: string) => CardData[],
    dimensions: { centerX: number; centerY: number; availableHeight: number; cardWidth: number, cardHeight: number },
    setCurrentCard: (id: string | null) => void,
    navigationAction: React.MutableRefObject<NavigationAction>
) => {
    // NEW: Stagger delay for sequential animations (in milliseconds)
    const STAGGER_DELAY_MS = 50;

    const [animatingCards, setAnimatingCards] = useState<AnimatedCard[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [pendingFinalTarget, setPendingFinalTarget] = useState<string | null>(null);
    const prevCardId = usePrevious(currentCardId);

    useEffect(() => {
        if (!isAnimating && pendingFinalTarget) {
            const target = pendingFinalTarget;
            setPendingFinalTarget(null);
            setCurrentCard(target);
        }
    }, [isAnimating, pendingFinalTarget, setCurrentCard]);


    useEffect(() => {
        if (isAnimating || currentCardId === prevCardId) {
            return;
        }

        const oldPath = prevCardId ? getCardPath(prevCardId) : [];
        const newPath = currentCardId ? getCardPath(currentCardId) : [];

        let animationType = 'init';
        if (oldPath.length > 0 && newPath.length > 0) {
            const isPrefix = (shortPath: CardData[], longPath: CardData[]) => {
                if (shortPath.length >= longPath.length) return false;
                return shortPath.every((card, index) => card.id === longPath[index]?.id);
            };

            if (navigationAction.current === 'delete') {
                animationType = 'DELETE';
            } else if (isPrefix(oldPath, newPath)) {
                animationType = navigationAction.current === 'create' ? 'CREATE_CHILD' : 'SWITCH_TO_CHILD';
            } else if (isPrefix(newPath, oldPath)) {
                animationType = 'SWITCH_TO_PARENT';
            } else if (oldPath[oldPath.length-1].parentId === newPath[newPath.length-1].parentId) {
                animationType = 'SWITCH_SIBLING';
            } else {
                animationType = 'SWITCH_UNRELATED';
            }
        } else if (newPath.length > 0) {
            animationType = 'CREATE_CHILD';
        }
        
        if (animationType === 'SWITCH_UNRELATED') {
            const commonAncestorId = findCommonAncestorId(oldPath, newPath);
            if (commonAncestorId && commonAncestorId !== currentCardId) {
                setPendingFinalTarget(currentCardId);
                setCurrentCard(commonAncestorId);
                return;
            }
        }
        
        const runAnimation = (fromPath: CardData[], toPath: CardData[], type: string) => {
            setIsAnimating(true);
            const allCardsData = new Map<string, CardData>();
            [...fromPath, ...toPath].forEach(c => allCardsData.set(c.id, c));
            const allIds = Array.from(allCardsData.keys());

            const cardStates = allIds.map(id => {
                const cardData = allCardsData.get(id)!;
                const oldIdx = fromPath.findIndex(c => c.id === id);
                const newIdx = toPath.findIndex(c => c.id === id);
                const oldDepth = oldIdx !== -1 ? fromPath.length - 1 - oldIdx : -1;
                const newDepth = newIdx !== -1 ? toPath.length - 1 - newIdx : -1;
                
                const isEntering = oldDepth === -1;
                const isExiting = newDepth === -1;

                const initialPos = calculateCardPosition(oldDepth, dimensions.centerX, dimensions.centerY, dimensions.availableHeight);
                const finalPos = calculateCardPosition(newDepth, dimensions.centerX, dimensions.centerY, dimensions.availableHeight);

                let status: AnimationStatus = 'stable-moving';
                let initialTransform = `translate(-50%, -50%) rotate(${initialPos.rotation}deg) scale(${initialPos.scale})`;
                let delay = '0ms';
                
                if (isEntering) {
                    status = 'entering';
                    if ((type === 'SWITCH_TO_CHILD' || type === 'CREATE_CHILD') && toPath.length - fromPath.length > 0) {
                        const baseDelay = (type === 'CREATE_CHILD' ? 0 : 50);
                        delay = `${baseDelay + (newIdx - fromPath.length) * STAGGER_DELAY_MS}ms`;
                    }

                    if (type === 'CREATE_CHILD') { 
                        initialTransform = `translate(-50%, -150%) scale(1.2) rotate(0deg)`;
                    } else if (type === 'SWITCH_TO_CHILD') {
                        initialTransform = `translate(-40%, -55%) scale(1.2) rotate(5deg)`;
                    } else if (type === 'SWITCH_SIBLING') { 
                        initialTransform = `translate(-150%, -50%) scale(1) rotate(0deg)`;
                    }
                } else if (isExiting) {
                     if (type === 'DELETE' && oldDepth === 0) status = 'exiting-dissolve';
                    else if (type === 'SWITCH_TO_PARENT') {
                        status = 'exiting-fly-up-right';
                        if (fromPath.length - toPath.length > 0) {
                           delay = `${oldDepth * STAGGER_DELAY_MS}ms`;
                        }
                    }
                    else if (type === 'SWITCH_SIBLING' && oldDepth === 0) status = 'exiting-fly-right';
                    else if (type === 'CREATE_CHILD' && fromPath.length >= 24) status = 'exiting-shrink-out';
                    else status = 'exiting-dissolve';
                } 
                else if (type === 'SWITCH_TO_PARENT' && !isExiting) {
                    const numSteps = fromPath.length - toPath.length;
                    if (numSteps > 0) {
                        delay = `${(numSteps - 1) * STAGGER_DELAY_MS}ms`;
                    }
                }

                const initialStyle: React.CSSProperties = {
                    width: dimensions.cardWidth, height: dimensions.cardHeight,
                    left: initialPos.x, top: initialPos.y,
                    transform: initialTransform,
                    filter: `blur(${initialPos.blur}px) brightness(${initialPos.brightness})`,
                    opacity: isEntering ? 0 : initialPos.opacity,
                    zIndex: 25 - (isEntering ? newDepth : oldDepth),
                    transitionDelay: (status === 'entering' || status === 'stable-moving') ? delay : undefined,
                    animationDelay: (status.startsWith('exiting-')) ? delay : undefined,
                };

                const finalStyle: React.CSSProperties = {
                    ...initialStyle,
                    left: finalPos.x, top: finalPos.y,
                    transform: `translate(-50%, -50%) rotate(${finalPos.rotation}deg) scale(${finalPos.scale})`,
                    filter: `blur(${finalPos.blur}px) brightness(${finalPos.brightness})`,
                    opacity: finalPos.opacity,
                    zIndex: 25 - newDepth,
                };
                
                return { id, card: cardData, status, initialStyle, finalStyle, isExiting };
            });

            setAnimatingCards(cardStates.map(s => ({ id: s.id, card: s.card, status: s.status, style: s.initialStyle })));
            
            setTimeout(() => {
                setAnimatingCards(current => current.map(animatingCard => {
                    const state = cardStates.find(s => s.id === animatingCard.id);
                    if (!state) return animatingCard;
                    if (state.isExiting) {
                        return { ...animatingCard, status: state.status };
                    }
                    return { ...animatingCard, style: state.finalStyle, status: 'stable-moving' };
                }));
            }, 20);

            const maxDelay = cardStates.reduce((max, s) => Math.max(max, parseInt(s.initialStyle.transitionDelay || '0') + parseInt(s.initialStyle.animationDelay || '0')), 0);
            const totalDuration = ANIMATION_DURATION + maxDelay;

            setTimeout(() => {
                setAnimatingCards([]);
                setIsAnimating(false);
            }, totalDuration + 100);
        };
        
        runAnimation(oldPath, newPath, animationType);
        if (navigationAction.current) navigationAction.current = null;

    }, [currentCardId, getCardPath, dimensions, setCurrentCard, navigationAction]);

    return animatingCards;
};

// #endregion

// ================================================================================================
// #region Main CardStack Component
// ================================================================================================

export const CardStack: React.FC<{
  centerY: number;
  availableHeight: number;
  centerAreaWidth: number;
}> = ({ centerY, availableHeight, centerAreaWidth }) => {
  const { addCard, setCurrentCard, getCardPath, deleteCardAndDescendants, setSelectedContent, selectedContent, generateTitle } = useCardStore();
  const { projects, activeProjectId } = useProjectStore();
  const { apiUrl, apiKey, activeModel, globalSystemPrompt, dialogueSystemPrompt } = useSettingsStore();
  
  // NEW: State to track the hovered card ID
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;
  const currentCard = cards.find(c => c.id === currentCardId);
  
  const prevCardId = usePrevious(currentCardId);

  const lastMessageContent = currentCard?.messages?.[currentCard.messages.length - 1]?.content;

  const currentCardRef = useRef<HTMLDivElement>(null);
  const navigationAction = useRef<NavigationAction>(null);
  const [previewState, setPreviewState] = useState({ visible: false, top: 0, left: 0, content: '', isLoading: false, sourceTerm: '' });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const dimensions = useMemo(() => ({
      centerX: centerAreaWidth / 2,
      centerY: centerY,
      availableHeight: availableHeight,
      cardWidth: centerAreaWidth * 0.75,
      cardHeight: availableHeight * 0.75,
  }), [centerAreaWidth, centerY, availableHeight]);

  const animatedCards = useAnimation(currentCardId, getCardPath, dimensions, setCurrentCard, navigationAction);

  useEffect(() => { setPortalRoot(document.getElementById('portal-root')); }, []);
  useEffect(() => {
    if (!currentCardId || !currentCard) return;

    // 如果卡片没有消息，或者已经有了一个不是占位符的有效标题，则不进行生成
    if (currentCard.messages.length === 0 || (currentCard.title && currentCard.title !== '新卡片')) {
        return;
    }
    const timer = setTimeout(() => generateTitle(currentCardId), 3000); // 3 second delay
    return () => clearTimeout(timer);
  }, [currentCardId, currentCard?.messages.length, currentCard?.title, generateTitle, lastMessageContent]);

  const fetchAIForPreview = async (term: string) => {
    if (!apiUrl || !apiKey || !activeModel) {
      setPreviewState((prev) => ({ ...prev, content: "API settings are missing.", isLoading: false }));
      return;
    }
    const userPrompt = `Please provide a concise explanation for the term: "${term}".`;
    const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (systemPromptContent) {
      messages.push({ role: 'system', content: systemPromptContent });
    }
    messages.push({ role: 'user', content: userPrompt });

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: activeModel, messages, stream: true }),
      });

      if (!res.ok || !res.body) {
        throw new Error('API request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiContent = '';

      mainReadLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, boundary).trim();
          buffer = buffer.substring(boundary + 1);

          if (line === '' || !line.startsWith('data: ')) continue;
          
          const data = line.substring(6);
          if (data === '[DONE]') break mainReadLoop;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              aiContent += delta;
              const normalizedContent = normalizeMathDelimiters(aiContent);
              setPreviewState((prev) => ({ ...prev, content: normalizedContent, isLoading: false }));
            }
          } catch (e) {
            console.warn('Stream parsing error:', e);
          }
        }
      }
    } catch (error) {
      console.error("Preview fetch error:", error);
      setPreviewState((prev) => ({ ...prev, content: "Failed to fetch explanation.", isLoading: false }));
    } finally {
      setPreviewState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleTermClick = (term: string, rect: DOMRect) => {
    setPreviewState({ visible: true, isLoading: true, sourceTerm: term, content: '', top: rect.top + rect.height / 2, left: rect.right });
    fetchAIForPreview(term);
  };
  
  const handleCreateCard = (messages: CardMessage[], parentId?: string) => {
    navigationAction.current = 'create';
    addCard(messages, parentId);
  };

  const handleCreateFromPreview = () => {
    if (!previewState.sourceTerm || !previewState.content) return;
    const userMsg: CardMessage = { id: `msg_${Date.now()}_user`, role: 'user', content: previewState.sourceTerm, timestamp: Date.now() };
    const aiMsg: CardMessage = { id: `msg_${Date.now()}_ai`, role: 'ai', content: previewState.content, timestamp: Date.now() };
    handleCreateCard([userMsg, aiMsg], currentCardId || undefined);
    setPreviewState(p => ({...p, visible: false}));
  };

  const handleCreateFromSelection = () => {
    if (!selectedContent) return;
    handleCreateCard([{ id: `msg_${Date.now()}`, role: 'user', content: selectedContent, timestamp: Date.now() }], currentCardId || undefined);
    setSelectedContent(null);
  };
  
  const handleDelete = (id: string) => {
    navigationAction.current = 'delete';
    deleteCardAndDescendants(id);
  };

  const cardsToRender = useMemo(() => {
      if (animatedCards && animatedCards.length > 0) {
          return animatedCards;
      }

      const isTransitioning = currentCardId !== prevCardId;
      const idForStableRender = isTransitioning && prevCardId ? prevCardId : currentCardId;

      const stablePath = idForStableRender ? getCardPath(idForStableRender) : [];
      
      return stablePath.map((card, index) => {
          const depth = stablePath.length - 1 - index;
          const pos = calculateCardPosition(depth, dimensions.centerX, dimensions.centerY, dimensions.availableHeight);
          return {
              id: card.id,
              card: card,
              status: 'stable' as AnimationStatus,
              style: {
                  width: dimensions.cardWidth, height: dimensions.cardHeight,
                  left: pos.x, top: pos.y,
                  transform: `translate(-50%, -50%) rotate(${pos.rotation}deg) scale(${pos.scale})`,
                  filter: `blur(${pos.blur}px) brightness(${pos.brightness})`,
                  opacity: pos.opacity,
                  zIndex: 25 - depth,
                  // REMOVED: Redundant transition property to prevent animation flash.
                  // The '.card-container' class handles this.
              }
          };
      });
  }, [animatedCards, currentCardId, prevCardId, getCardPath, dimensions, cards]);

  return (
    <div className="w-full h-full relative overflow-visible z-0">
      <style>{`
        .card-container {
          position: absolute;
          /* Apply transition to all cards, controlled by JS logic */
          transition: all ${ANIMATION_DURATION}ms ease-in-out;
        }
        
        .card-container.exiting-dissolve { 
          animation: card-dissolve ${ANIMATION_DURATION}ms forwards ease-in-out; 
        }
        @keyframes card-dissolve { 
          to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } 
        }

        .card-container.exiting-fly-right { 
          animation: card-fly-right ${ANIMATION_DURATION}ms forwards ease-in-out; 
        }
        @keyframes card-fly-right { 
          to { opacity: 0; transform: translate(30%, -50%) scale(1); } 
        }
        
        .card-container.exiting-fly-up-right { 
          animation: card-fly-up-right ${ANIMATION_DURATION}ms forwards ease-in-out; 
        }
        @keyframes card-fly-up-right { 
          to { opacity: 0; transform: translate(-40%, -55%) scale(1.2) rotate(5deg); } 
        }
        
        .card-container.exiting-shrink-out { 
          animation: card-shrink-out ${ANIMATION_DURATION}ms forwards ease-in-out; 
        }
        @keyframes card-shrink-out { 
          from { opacity: 0.8; }
          to { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 
        }
      `}</style>
      
      {!currentCard && cardsToRender.length === 0 ? (
        <div className="absolute pointer-events-none" style={{ left: dimensions.centerX, top: dimensions.centerY, transform: 'translate(-50%, -50%)' }}>
          <h1 className="font-bruno-ace font-normal text-center text-[#13E425]" style={{ fontSize: '128px', lineHeight: '128px', textShadow: '0px 0px 24px #13E425' }} >
            Start Explore
          </h1>
        </div>
      ) : (
        cardsToRender.map(ac => {
            const isTopCard = ac.id === currentCardId && animatedCards.length === 0;
            const isHovered = !isTopCard && ac.id === hoveredCardId;

            // Start with the base style
            let finalStyle = { ...ac.style };

            // If the card is a parent card and is being hovered, apply hover styles
            if (isHovered) {
                const baseScaleMatch = /scale\((.*?)\)/.exec(ac.style.transform as string);
                const baseScale = baseScaleMatch ? parseFloat(baseScaleMatch[1]) : 1;
                
                finalStyle = {
                    ...finalStyle,
                    // Apply hover styles: increase size, make fully visible and clear
                    transform: (ac.style.transform as string).replace(/scale\(.*?\)/, `scale(${baseScale * 1.02})`),
                    filter: 'blur(0px) brightness(1)',
                    opacity: 1
                };
            }

            return (
              // The pointer-events logic from the previous fix is still necessary and correct
              <div key={ac.id} className={`card-container ${ac.status}`} style={{ ...finalStyle, pointerEvents: isTopCard ? 'auto' : 'none' }}>
                <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
                  {isTopCard || ac.status === 'entering' || ac.status === 'stable-moving' ? (
                    <CurrentCardDialog
                      card={ac.card}
                      cardRef={isTopCard ? currentCardRef : undefined}
                      onDelete={() => handleDelete(ac.id)}
                      onCreateNew={() => handleCreateCard([], ac.id)}
                      onTextSelection={setSelectedContent}
                      onCreateFromSelection={handleCreateFromSelection}
                      onTermClick={handleTermClick}
                    />
                  ) : (
                    <ParentCard 
                      card={ac.card} 
                      onClick={() => setCurrentCard(ac.id)}
                      // Pass the state setters to the ParentCard
                      onHoverStart={() => setHoveredCardId(ac.id)}
                      onHoverEnd={() => setHoveredCardId(null)}
                    />
                  )}
                </div>
              </div>
            );
        })
      )}
      
      {previewState.visible && portalRoot && ReactDOM.createPortal(
        <PreviewCard
          position={{ top: previewState.top, left: previewState.left }}
          content={previewState.content}
          isLoading={previewState.isLoading}
          onClose={() => setPreviewState(p => ({...p, visible: false}))}
          onCreate={handleCreateFromPreview}
          parentRef={currentCardRef}
        />,
        portalRoot
      )}
    </div>
  );
};