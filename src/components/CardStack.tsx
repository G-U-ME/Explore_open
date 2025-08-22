import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import useCardStore, { CardData, CardMessage } from '../stores/cardStore';
import { X, ZoomIn, Loader, ChevronUp, ChevronDown } from 'lucide-react';
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
const STAGGER_DELAY_MS = 50; // ms, used for the "old" animation style

type AnimationStatus =
  | 'stable'
  | 'stable-moving'
  | 'entering' // Generic entering for old animation style
  | 'entering-from-top' // Specific for new animation style
  | 'entering-from-left' // Specific for new animation style
  | 'exiting-dissolve'
  | 'exiting-fly-right'
  | 'exiting-fly-up-right'
  | 'exiting-shrink-out'
  | 'exiting-up-and-grow'; //  <-- 新增的删除动画状态

type NavigationAction = 'create' | 'delete' | null;

interface AnimatedCard {
  id: string;
  card: CardData;
  status: AnimationStatus;
  style: React.CSSProperties;
}

type Dimensions = {
    centerX: number;
    centerY: number;
    availableHeight: number;
    cardWidth: number;
    cardHeight: number;
};


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
    if (depth > 24) {
        return { x: centerX, y: centerY + availableHeight, scale: 0, rotation: -90, blur: 20, brightness: 0.5, opacity: 0 };
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

const getFullCardStyle = (depth: number, dimensions: Dimensions) => {
  const pos = calculateCardPosition(depth, dimensions.centerX, dimensions.centerY, dimensions.availableHeight);
  return {
      width: dimensions.cardWidth, height: dimensions.cardHeight,
      left: pos.x, top: pos.y, zIndex: 25 - depth,
      transform: `translate(-50%, -50%) rotate(${pos.rotation}deg) scale(${pos.scale})`,
      filter: `blur(${pos.blur}px) brightness(${pos.brightness})`,
      opacity: pos.opacity,
  };
};
// #endregion

// ================================================================================================
// #region Markdown and Rendering Components
// ================================================================================================
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
  // MODIFICATION: Memoize the customComponents object.
  // It will only be recalculated if onTermClick changes.
  const customComponents: Components = useMemo(() => ({
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
  }), [onTermClick]); // Dependency array includes onTermClick

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
  toolCalls: any[];
  isLoading: boolean;
  onClose: () => void;
  onCreate: () => void;
  parentRef: React.RefObject<HTMLDivElement>;
}> = ({ position, content, toolCalls, isLoading, onClose, onCreate, parentRef }) => {
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
        {isLoading && toolCalls.length === 0 && !content && <Loader className="animate-spin text-gray-400 mx-auto mt-4" />}
        {toolCalls.length > 0 && (
          <ToolCallDisplay toolCalls={toolCalls} isStreaming={isLoading} />
        )}
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, [rehypeSanitize, customSanitizeSchema]]}>
            {normalizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const ToolCallDisplay: React.FC<{ toolCalls: any[]; isStreaming: boolean }> = ({ toolCalls, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start a new timer if streaming starts
    if (isStreaming) {
      const startTime = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      // Clear interval if it exists and streaming stops
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup on unmount or if isStreaming changes
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming]);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  // Process all tool call arguments to be rendered as Markdown.
  // This handles the reasoning/thinking text specifically.
  const allArguments = toolCalls
    .map(call => call.function?.arguments || '')
    .join('\n\n');

  const cleanContent = allArguments.replace(/@@(.*?)@@/g, '$1');
  const normalizedContent = useMemo(() => normalizeMathDelimiters(cleanContent), [cleanContent]);

  return (
    <div className="bg-[#2C2C2C] rounded-lg p-2.5 my-2">
      <div className="flex justify-between items-center text-sm mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{isStreaming ? 'Thinking' : 'Thinking Completed'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{elapsedTime}s</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-6 h-6 bg-[#4C4C4C] rounded-full flex items-center justify-center hover:bg-[#5C5C5C]"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="text-[#B4B4B4] text-xs bg-[#222222] p-2 rounded-md overflow-x-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, [rehypeSanitize, customSanitizeSchema]]}
          >
            {normalizedContent}
          </ReactMarkdown>
        </div>
      )}
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
  isMobile?: boolean;
}> = ({ card, cardRef, onDelete, onCreateNew, onTextSelection, onCreateFromSelection, onTermClick, isMobile = false }) => {
  const [selectionButton, setSelectionButton] = useState({ visible: false, top: 0, left: 0 });
  const { isTyping: isGlobalTyping } = useCardStore();

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
        <span className={`font-normal flex-1 truncate pr-2 ${isMobile ? 'text-lg leading-8' : 'text-title leading-9'}`}>{card.title || 'Untitled Card'}</span>
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
            {card.messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id || idx} className="flex justify-end">
                    <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[90%]">
                      <span className={`${isMobile ? 'text-base' : 'text-content'} whitespace-pre-wrap`}>{msg.content}</span>
                    </div>
                  </div>
                );
              } else { // AI Message
                const isLastMessage = idx === card.messages.length - 1;
                const isStreaming = isGlobalTyping && isLastMessage;
                const toolCalls = (msg.tool_calls && Array.isArray(msg.tool_calls)) ? msg.tool_calls : [];

                return (
                  <div key={msg.id || idx} className={`${isMobile ? 'text-base' : 'text-content'} max-w-full`}>
                    {toolCalls.length > 0 && (
                      <ToolCallDisplay toolCalls={toolCalls} isStreaming={isStreaming} />
                    )}
                    <MarkdownRenderer content={msg.content} onTermClick={onTermClick} />
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <div className={`text-center text-[#888] py-4 ${isMobile ? 'text-base' : 'text-lg'}`}>Start Exploring</div>
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
  isMobile?: boolean;
}> = ({ card, onClick, onHoverStart, onHoverEnd, isMobile = false }) => {
  return (
    <div
      className="absolute top-0 left-0 w-full h-full cursor-pointer transition-all duration-300 ease-in-out bg-[#222222] rounded-[24px] shadow-card"
      onClick={() => {
        onHoverEnd();
        onClick();
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div className="p-4 h-full flex flex-col text-white overflow-hidden pointer-events-none">
        <div className={`font-normal mb-2 pb-1 border-b border-[#333] truncate ${isMobile ? 'text-base leading-7' : 'text-title leading-9'}`}>
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
                      <span className={`${isMobile ? 'text-sm' : 'text-content'} whitespace-pre-wrap`}>{msg.content}</span>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id || idx} className={`${isMobile ? 'text-sm' : 'text-content'} max-w-full`}>
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
// #region Combined Animation Hook
// ================================================================================================

// ================================================================================================
// #region Combined Animation Hook
// ================================================================================================

const useAnimation = (
    currentCardId: string | null,
    cards: CardData[],
    getCardPath: (id: string) => CardData[],
    dimensions: Dimensions,
    navigationAction: React.MutableRefObject<NavigationAction>
) => {
    const [animatingCards, setAnimatingCards] = useState<AnimatedCard[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const prevCardId = usePrevious(currentCardId);
    const prevCards = usePrevious(cards);
    const animationSleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runNewStyleAnimation = useCallback(async (
        oldPath: CardData[], 
        newPath: CardData[],
        animationType: string
    ) => {
        try {
            if (animationType === 'DELETE_CARD') {
                const deletedCard = oldPath[oldPath.length - 1];
                let currentAnimatingCards = oldPath.map((card, index) => ({
                    id: card.id, card, status: 'stable-moving' as AnimationStatus,
                    style: getFullCardStyle(oldPath.length - 1 - index, dimensions),
                }));
                setAnimatingCards(currentAnimatingCards);
                await animationSleep(20);

                setAnimatingCards(current => current.map(ac => {
                    if (ac.id === deletedCard.id) {
                        return { ...ac, status: 'exiting-up-and-grow' as AnimationStatus };
                    }
                    const newIdx = newPath.findIndex(c => c.id === ac.id);
                    if (newIdx !== -1) {
                        const newDepth = newPath.length - 1 - newIdx;
                        return { ...ac, style: getFullCardStyle(newDepth, dimensions) };
                    }
                    return ac;
                }));
                await animationSleep(ANIMATION_DURATION);
            } else if (animationType === 'SWITCH_TO_PARENT') {
                const cardsToRemoveInOrder = oldPath.slice(newPath.length).reverse();
                let currentAnimatingCards = oldPath.map((card, index) => ({
                    id: card.id, card, status: 'stable-moving' as AnimationStatus,
                    style: getFullCardStyle(oldPath.length - 1 - index, dimensions),
                }));
                setAnimatingCards(currentAnimatingCards);
                await animationSleep(20);

                let currentVisiblePath = oldPath;
                for (const cardToRemove of cardsToRemoveInOrder) {
                    const nextVisiblePath = currentVisiblePath.filter(c => c.id !== cardToRemove.id);
                    setAnimatingCards(current => current.map(ac => {
                        if (ac.id === cardToRemove.id) return { ...ac, status: 'exiting-fly-up-right' as AnimationStatus };
                        const newIdx = nextVisiblePath.findIndex(c => c.id === ac.id);
                        if (newIdx !== -1) {
                            const newDepth = nextVisiblePath.length - 1 - newIdx;
                            return { ...ac, style: getFullCardStyle(newDepth, dimensions) };
                        }
                        return ac;
                    }));
                    await animationSleep(ANIMATION_DURATION);
                    currentVisiblePath = nextVisiblePath;
                }
            } else if (animationType === 'CREATE_CHILD') {
                 const initialAnimatingCards = oldPath.map((card, index) => ({
                    id: card.id, card, status: 'stable-moving' as AnimationStatus,
                    style: getFullCardStyle(oldPath.length - 1 - index, dimensions),
                }));
                
                const enteringCardState: AnimatedCard = {
                   id: newPath[newPath.length-1].id, card: newPath[newPath.length-1], status: 'entering-from-top',
                   style: {
                       ...getFullCardStyle(0, dimensions),
                       transform: `translate(-50%, -150%) scale(1.2)`,
                       filter: 'blur(0px) brightness(1)', opacity: 0, zIndex: 26,
                   }
                };
                
                setAnimatingCards([...initialAnimatingCards, enteringCardState]);
                await animationSleep(20);

                const finalStates = newPath.map(card => {
                    const depth = newPath.length - 1 - newPath.findIndex(p => p.id === card.id);
                    return { id: card.id, card, status: 'stable-moving' as AnimationStatus, style: getFullCardStyle(depth, dimensions) };
                });
                setAnimatingCards(finalStates);
                await animationSleep(ANIMATION_DURATION);
            } else if (animationType === 'SWITCH_TO_CHILD') {
                const cardsToEnter = newPath.slice(oldPath.length);
                let currentVisiblePath = oldPath;
                let currentAnimatingCards = oldPath.map((card, index) => ({
                    id: card.id, card, status: 'stable-moving' as AnimationStatus,
                    style: getFullCardStyle(currentVisiblePath.length - 1 - index, dimensions),
                }));
                setAnimatingCards(currentAnimatingCards);
                await animationSleep(20);

                for (const cardToEnter of cardsToEnter) {
                    const nextPath = [...currentVisiblePath, cardToEnter];
                    const enteringCardState: AnimatedCard = {
                       id: cardToEnter.id, card: cardToEnter, status: 'stable-moving',
                       style: {
                           ...getFullCardStyle(0, dimensions),
                           transform: `translate(-40%, -55%) scale(1.04) rotate(5deg)`,
                           filter: 'blur(0px) brightness(1)', opacity: 0, zIndex: 26,
                       }
                    };
                    setAnimatingCards(current => [...current, enteringCardState]);
                    await animationSleep(20);

                    const stepTargetStates = nextPath.map(card => {
                        const depth = nextPath.length - 1 - nextPath.findIndex(p => p.id === card.id);
                        return { id: card.id, card, status: 'stable-moving' as AnimationStatus, style: getFullCardStyle(depth, dimensions) };
                    });
                    setAnimatingCards(stepTargetStates);
                    await animationSleep(ANIMATION_DURATION);
                    currentVisiblePath = nextPath;
                }
            } else if (animationType === 'SWITCH_SIBLING') {
                const parentPath = oldPath.slice(0, -1);
                const initialStates: AnimatedCard[] = parentPath.map((card, index) => {
                     const depth = newPath.length - 1 - index;
                     return { id: card.id, card, status: 'stable-moving', style: getFullCardStyle(depth, dimensions) };
                });
                
                initialStates.push({ id: prevCardId!, card: oldPath[oldPath.length-1], status: 'stable-moving', style: getFullCardStyle(0, dimensions) });
                
                const newCard = newPath[newPath.length-1];
                initialStates.push({
                    id: newCard.id, card: newCard, status: 'entering-from-left',
                    style: { ...getFullCardStyle(0, dimensions), transform: `translate(-150%, -50%) scale(1)`, opacity: 0 }
                });
                
                setAnimatingCards(initialStates);
                await animationSleep(20);

                setAnimatingCards(current => current.map(ac => {
                    if (ac.id === prevCardId) return { ...ac, status: 'exiting-fly-right' };
                    if (ac.id === newCard.id) return { ...ac, style: getFullCardStyle(0, dimensions) };
                    return ac; // Parents don't move
                }));
                await animationSleep(ANIMATION_DURATION);
            
            } else { // Generic case for others, e.g. delete, or unrelated without common ancestor
                const finalStates = oldPath.map((card, index) => ({
                    id: card.id, card, status: 'exiting-dissolve' as AnimationStatus,
                    style: getFullCardStyle(oldPath.length - 1 - index, dimensions)
                }));
                setAnimatingCards(finalStates);
                await animationSleep(ANIMATION_DURATION);
            }
        } finally {
            // Cleanup happens in the main effect
        }
    }, [dimensions, getCardPath, prevCardId]);

    const runOldStyleAnimation = useCallback((
        fromPath: CardData[],
        toPath: CardData[],
        type: string
    ) => {
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
            
            if (type === 'SWITCH_TO_PARENT') {
                const exitingCardCount = fromPath.length - toPath.length;
                const maxExitStaggerDelay = Math.max(0, (exitingCardCount - 1) * STAGGER_DELAY_MS);
                
                if (isExiting) {
                    status = 'exiting-fly-up-right';
                    const exitRank = oldDepth;
                    delay = `${exitRank * STAGGER_DELAY_MS}ms`;
                } else { 
                    const lastRemainingCardOldIdx = toPath.length - 1;
                    const delaySteps = lastRemainingCardOldIdx - oldIdx;
                    const moveStaggerDelay = delaySteps * STAGGER_DELAY_MS;
                    delay = `${maxExitStaggerDelay + moveStaggerDelay}ms`;
                }
            } else if (type === 'SWITCH_TO_CHILD') {
                if (isEntering) {
                    status = 'entering';
                    const enterRank = newIdx - fromPath.length;
                    delay = `${enterRank * STAGGER_DELAY_MS}ms`;
                    initialTransform = `translate(-40%, -55%) scale(1.2) rotate(5deg)`;
                } else {
                    delay = '0ms'; 
                }
            } else {
                const numSteps = fromPath.length - toPath.length;
                let exitPhaseDuration = 0;
                if (numSteps > 0) {
                    const exitingCardCount = numSteps;
                    const maxExitStaggerDelay = Math.max(0, (exitingCardCount - 1) * STAGGER_DELAY_MS);
                    exitPhaseDuration = maxExitStaggerDelay;
                }

                if (isEntering) {
                    status = 'entering';
                    const baseDelay = toPath.length > fromPath.length ? fromPath.length : 0;
                    delay = `${(newIdx - baseDelay) * STAGGER_DELAY_MS}ms`;
                    initialTransform = `translate(-40%, -55%) scale(1.2) rotate(5deg)`;
                } else if (isExiting) {
                    status = 'exiting-fly-up-right';
                    const exitRank = oldDepth;
                    delay = `${exitRank * STAGGER_DELAY_MS}ms`;
                } else {
                    let moveStaggerDelay = 0;
                    if (numSteps > 0) {
                        const lastRemainingCardOldIdx = toPath.length - 1;
                        const delaySteps = lastRemainingCardOldIdx - oldIdx;
                        moveStaggerDelay = delaySteps * STAGGER_DELAY_MS;
                    }
                    delay = `${exitPhaseDuration + moveStaggerDelay}ms`;
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
            const finalStyle: React.CSSProperties = { ...initialStyle, left: finalPos.x, top: finalPos.y, transform: `translate(-50%, -50%) rotate(${finalPos.rotation}deg) scale(${finalPos.scale})`, filter: `blur(${finalPos.blur}px) brightness(${finalPos.brightness})`, opacity: finalPos.opacity, zIndex: 25 - newDepth };
            
            return { id, card: cardData, status, initialStyle, finalStyle, isExiting };
        });

        setAnimatingCards(cardStates.map(s => ({ id: s.id, card: s.card, status: s.status, style: s.initialStyle })));
        
        setTimeout(() => {
            setAnimatingCards(current => current.map(animatingCard => {
                const state = cardStates.find(s => s.id === animatingCard.id);
                if (!state) return animatingCard;
                if (state.isExiting) return { ...animatingCard, status: state.status };
                return { ...animatingCard, style: state.finalStyle, status: 'stable-moving' };
            }));
        }, 20);

        const maxDelay = cardStates.reduce((max, s) => Math.max(max, parseInt(s.initialStyle.transitionDelay || '0') + parseInt(s.initialStyle.animationDelay || '0')), 0);
        return ANIMATION_DURATION + maxDelay + 100;
    }, [dimensions]);
    
    useEffect(() => {
        if (isAnimating || currentCardId === prevCardId) {
            return;
        }

        if (!prevCardId && currentCardId) {
            (async () => {
                const newPath = getCardPath(currentCardId);
                const initialCards = newPath.map((card, index) => ({ id: card.id, card, status: 'stable' as AnimationStatus, style: { ...getFullCardStyle(newPath.length - 1 - index, dimensions), opacity: 0 } }));
                setIsAnimating(true);
                setAnimatingCards(initialCards);
                await animationSleep(20);
                setAnimatingCards(current => current.map(c => {
                    const depth = newPath.length - 1 - newPath.findIndex(p => p.id === c.id);
                    return {...c, style: {...c.style, opacity: getFullCardStyle(depth, dimensions).opacity}};
                }));
                await animationSleep(ANIMATION_DURATION);
                setIsAnimating(false);
                setAnimatingCards([]);
            })();
            return;
        }

        if (!prevCardId || !currentCardId) {
            return;
        }


        const getPathFromCardList = (id: string, allCards: CardData[] | undefined): CardData[] => {
            const path: CardData[] = [];
            if (!allCards) return path;

            let currentCard: CardData | undefined = allCards.find(c => c.id === id);

            while (currentCard) {
                path.unshift(currentCard);
                const parentId = currentCard.parentId;
                if (!parentId) {
                    break;
                }
                currentCard = allCards.find(c => c.id === parentId);
            }
            
            return path;
        };

        const oldPath = getPathFromCardList(prevCardId, prevCards || []);
        const newPath = getCardPath(currentCardId);
        
        const isPrefix = (shortPath: CardData[], longPath: CardData[]) => shortPath.length < longPath.length && shortPath.every((card, index) => card.id === longPath[index]?.id);

        let animationType: string;
        // 关键修改：优先判断删除动作
        if (navigationAction.current === 'delete') animationType = 'DELETE_CARD';
        else if (navigationAction.current === 'create') animationType = 'CREATE_CHILD';
        else if (isPrefix(oldPath, newPath)) animationType = 'SWITCH_TO_CHILD';
        else if (isPrefix(newPath, oldPath)) animationType = 'SWITCH_TO_PARENT';
        else if (oldPath.length > 0 && newPath.length > 0 && oldPath[oldPath.length - 1].parentId === newPath[newPath.length - 1].parentId) animationType = 'SWITCH_SIBLING';
        else animationType = 'SWITCH_UNRELATED';
        
        navigationAction.current = null;
        
        const runAnimation = async () => {
            setIsAnimating(true);
            try {
                if (animationType === 'SWITCH_UNRELATED') {
                    const commonAncestorId = findCommonAncestorId(oldPath, newPath);
                    const ancestorPath = commonAncestorId ? getCardPath(commonAncestorId) : [];
                    const distance = commonAncestorId ? (oldPath.length - ancestorPath.length) + (newPath.length - ancestorPath.length) : 99;

                    if (!commonAncestorId) {
                        await runNewStyleAnimation(oldPath, [], 'DELETE');
                    } else {
                        const useOldStyle = distance > 3;

                        if (useOldStyle) {
                            const duration = runOldStyleAnimation(oldPath, ancestorPath, 'SWITCH_TO_PARENT');
                            await animationSleep(duration);
                        } else {
                            await runNewStyleAnimation(oldPath, ancestorPath, 'SWITCH_TO_PARENT');
                        }

                        if (useOldStyle) {
                            const duration = runOldStyleAnimation(ancestorPath, newPath, 'SWITCH_TO_CHILD');
                            await animationSleep(duration);
                        } else {
                            await runNewStyleAnimation(ancestorPath, newPath, 'SWITCH_TO_CHILD');
                        }
                    }
                } else {
                    const distance = Math.abs(newPath.length - oldPath.length);
                    const useOldStyle = distance > 3 && animationType.startsWith('SWITCH');

                    if (useOldStyle) {
                        const totalDuration = runOldStyleAnimation(oldPath, newPath, animationType);
                        await animationSleep(totalDuration);
                    } else {
                        await runNewStyleAnimation(oldPath, newPath, animationType);
                    }
                }
            } finally {
                setIsAnimating(false);
                setAnimatingCards([]);
            }
        };

        runAnimation();

    }, [currentCardId, cards, getCardPath, dimensions, navigationAction, isAnimating, prevCardId, prevCards, runNewStyleAnimation, runOldStyleAnimation]);

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
  isMobile?: boolean;
}> = ({ centerY, availableHeight, centerAreaWidth, isMobile = false }) => {
  const { addCard, setCurrentCard, getCardPath, deleteCardAndDescendants, setSelectedContent, selectedContent, generateTitle, appendMessage, updateMessage } = useCardStore();
  const { projects, activeProjectId } = useProjectStore();
  const { apiUrl, apiKey, activeModel, globalSystemPrompt, dialogueSystemPrompt, isWebSearchEnabled } = useSettingsStore();

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;
  const currentCard = cards.find(c => c.id === currentCardId);

  const prevCards = usePrevious(cards);

  const lastMessageContent = currentCard?.messages?.[currentCard.messages.length - 1]?.content;
  const prevCardId = usePrevious(currentCardId);

  const currentCardRef = useRef<HTMLDivElement>(null); 
  const streamTargetRef = useRef<{type: 'preview' | 'card', cardId?: string, messageId?: string} | null>(null);
  const lettingStreamContinueRef = useRef(false);

  const navigationAction = useRef<NavigationAction>(null);
  const [previewState, setPreviewState] = useState({ visible: false, top: 0, left: 0, content: '', isLoading: false, sourceTerm: '', toolCalls: [] as any[] });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  const getPathFromCardList = (id: string, allCards: CardData[] | undefined): CardData[] => {
      const path: CardData[] = [];
      if (!allCards) return path;

      let currentCard: CardData | undefined = allCards.find(c => c.id === id);

      while (currentCard) {
          path.unshift(currentCard);
          const parentId = currentCard.parentId;
          if (!parentId) {
              break;
          }
          currentCard = allCards.find(c => c.id === parentId);
      }
      
      return path;
  };

  const dimensions = useMemo<Dimensions>(() => {
    const scaleFactor = isMobile ? 0.90 : 0.75;
    return {
        centerX: centerAreaWidth / 2,
        centerY: centerY,
        availableHeight: availableHeight,
        cardWidth: centerAreaWidth * scaleFactor,
        cardHeight: availableHeight * scaleFactor,
    };
  }, [centerAreaWidth, centerY, availableHeight, isMobile]);

  const animatedCards = useAnimation(currentCardId, cards, getCardPath, dimensions, navigationAction);

  useEffect(() => { setPortalRoot(document.getElementById('portal-root')); }, []);
  useEffect(() => {
    if (!currentCardId || !currentCard) return;
    if (currentCard.messages.length === 0 || (currentCard.title && currentCard.title !== '新卡片')) {
        return;
    }
    const timer = setTimeout(() => generateTitle(currentCardId), 2000);
    return () => clearTimeout(timer);
  }, [currentCardId, currentCard?.messages.length, currentCard?.title, generateTitle, lastMessageContent]);
  
  const fetchAIForPreview = async (term: string) => {
    const controller = new AbortController();
    streamAbortControllerRef.current = controller;

    if (!apiUrl || !apiKey || !activeModel) {
      setPreviewState((prev) => ({ ...prev, content: "API settings are missing.", isLoading: false }));
      return;
    }
    
    const currentCard = cards.find(c => c.id === currentCardId);
    const backgroundTopic = currentCard?.title;

    let userPrompt = `Please provide a concise explanation for the term: "${term}".`;
    if (backgroundTopic && backgroundTopic !== '新卡片') {
        userPrompt = `Background Topic: "${backgroundTopic}"\n\nPlease provide a concise explanation for the term: "${term}".`;
    }

    const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (systemPromptContent) {
      messages.push({ role: 'system', content: systemPromptContent });
    }
    messages.push({ role: 'user', content: userPrompt });

    let isHandedOff = false;
    let handedOffTarget: { cardId: string; messageId: string } | null = null;

    try {
      const requestBody: any = { model: activeModel, messages, stream: true };
      if (isWebSearchEnabled) {
        requestBody.enable_search = true;
        requestBody.search_options = { provider: "biying" };
      }
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error('API request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiContent = '';
      const toolCalls: any[] = [];

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
            const delta = json.choices?.[0]?.delta;

            if (!delta) continue;
            if (controller.signal.aborted) break mainReadLoop;

            let updateNeeded = false;
            let newContentPayload: string | undefined;
            let newToolCallsPayload: any[] | undefined;

            if (delta.content) {
              aiContent += delta.content;
              newContentPayload = normalizeMathDelimiters(aiContent);
              updateNeeded = true;
            }

            if (json.choices?.[0]?.delta?.reasoning_content) {
                const reasoningChunk = json.choices[0].delta.reasoning_content;
                let reasoningCall = toolCalls.find(call => call.id === 'deepseek_reasoning');
                if (!reasoningCall) {
                    reasoningCall = { id: 'deepseek_reasoning', type: 'function', function: { name: 'Reasoning', arguments: '' } };
                    toolCalls.push(reasoningCall);
                }
                reasoningCall.function.arguments += reasoningChunk;
                newToolCallsPayload = JSON.parse(JSON.stringify(toolCalls));
                updateNeeded = true;
            }

            if (delta.tool_calls) {
                for (const chunk of delta.tool_calls) {
                    while (toolCalls.length <= chunk.index) { toolCalls.push({}); }
                    const current = toolCalls[chunk.index];
                    if (chunk.id) current.id = chunk.id;
                    if (chunk.type) current.type = chunk.type;
                    if (chunk.function) {
                        if (!current.function) current.function = {};
                        if (chunk.function.name) current.function.name = chunk.function.name;
                        if (chunk.function.arguments) {
                            if (!current.function.arguments) current.function.arguments = "";
                            current.function.arguments += chunk.function.arguments;
                        }
                    }
                }
                newToolCallsPayload = JSON.parse(JSON.stringify(toolCalls));
                updateNeeded = true;
            }
            
            if (updateNeeded) {
              if (isHandedOff && handedOffTarget) {
                  const updatePayload: Partial<CardMessage> = {};
                  if (newContentPayload !== undefined) updatePayload.content = newContentPayload;
                  if (newToolCallsPayload !== undefined) updatePayload.tool_calls = newToolCallsPayload;
                  updateMessage(handedOffTarget.cardId, handedOffTarget.messageId, updatePayload);
              }
              else if (streamTargetRef.current?.type === 'preview') {
                  setPreviewState(prev => ({
                      ...prev,
                      ...(newContentPayload !== undefined && { content: newContentPayload }),
                      ...(newToolCallsPayload !== undefined && { toolCalls: newToolCallsPayload }),
                  }));
              }
              else if (streamTargetRef.current?.type === 'card') {
                  isHandedOff = true;
                  handedOffTarget = { cardId: streamTargetRef.current.cardId!, messageId: streamTargetRef.current.messageId! };
                  const updatePayload: Partial<CardMessage> = {};
                  if (newContentPayload !== undefined) updatePayload.content = newContentPayload;
                  if (newToolCallsPayload !== undefined) updatePayload.tool_calls = newToolCallsPayload;
                  updateMessage(handedOffTarget.cardId, handedOffTarget.messageId, updatePayload);
              }
            }
          } catch (e) {
            console.warn('Stream parsing error:', e);
          }
        }
      }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.log('Preview fetch was aborted.');
        } else {
            console.error("Preview fetch error:", error);
            if (!controller.signal.aborted && !isHandedOff) {
                setPreviewState((prev) => ({ ...prev, content: "Failed to fetch explanation."}));
            }
        }
    } finally {
        if (!isHandedOff) {
            setPreviewState(prev => ({ ...prev, isLoading: false }));
        }
    }
  };

  const fetchLLMStreamForNewCard = useCallback(async (
    cardId: string, 
    history: CardMessage[], 
    targetMessageInfo?: { aiMessageIdToContinue: string } | { userMessageId: string },
    backgroundTopic?: string
  ) => {
    if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    streamAbortControllerRef.current = controller;

    let aiMsgId: string;
    let initialContent = '';

    if (targetMessageInfo && 'aiMessageIdToContinue' in targetMessageInfo) {
        aiMsgId = targetMessageInfo.aiMessageIdToContinue;
        const existingMsg = history.find(m => m.id === aiMsgId);
        if (existingMsg) {
            initialContent = existingMsg.content;
        }
    } else {
        const userMsgId = targetMessageInfo?.userMessageId;
        aiMsgId = userMsgId ? `${userMsgId}_ai` : `msg_${Date.now()}_ai`;
        appendMessage(cardId, { id: aiMsgId, role: 'ai', content: '', timestamp: Date.now() });
    }
    
    streamTargetRef.current = { type: 'card', cardId, messageId: aiMsgId };

    if (!apiUrl || !apiKey || !activeModel) {
        updateMessage(cardId, aiMsgId, { content: "API settings are missing." });
        return;
    }

    try {
        const apiMessages = history.map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content
        }));

        if (backgroundTopic && backgroundTopic !== '新卡片') {
            const userMessage = apiMessages.find(m => m.role === 'user');
            if (userMessage) {
                userMessage.content = `Background Topic: "${backgroundTopic}"\n\nQuestion:\n${userMessage.content}`;
            }
        }
        
        const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
        const messagesForApi: any[] = [...apiMessages];
        if (systemPromptContent) {
            messagesForApi.unshift({ role: 'system', content: systemPromptContent });
        }

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: activeModel, stream: true, messages: messagesForApi }),
            signal: controller.signal,
        });

        if (!res.ok || !res.body) {
            const errorText = await res.text();
            throw new Error(`API request failed: ${res.status} ${errorText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiContent = initialContent;
        mainReadLoop: while (true) {
            if (controller.signal.aborted) break;
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
                        updateMessage(cardId, aiMsgId, { content: normalizedContent });
                    }
                } catch (e) {
                    console.warn('Stream parsing error:', e, 'in line:', line);
                }
            }
        }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
          console.log('LLM fetch for card was aborted.');
      } else {
          console.error("LLM fetch error:", error);
          if (!controller.signal.aborted) {
            updateMessage(cardId, aiMsgId, { content: initialContent + "\n\nFailed to fetch AI response." });
          }
      }
    } finally {
        if (streamAbortControllerRef.current === controller) {
            streamAbortControllerRef.current = null;
            streamTargetRef.current = null;
        }
    }
  }, [apiUrl, apiKey, activeModel, globalSystemPrompt, dialogueSystemPrompt, appendMessage, updateMessage]);

  const handleTermClick = useCallback((term: string, rect: DOMRect) => {
    const previewCardWidth = currentCardRef.current ? currentCardRef.current.offsetWidth / 2 : 300;
    const screenWidth = window.innerWidth;
    const horizontalOffset = 10;
    const screenPadding = 16;

    let finalLeft = rect.right;
    const projectedRightEdge = finalLeft + horizontalOffset + previewCardWidth;

    if (projectedRightEdge > screenWidth - screenPadding) {
      finalLeft = screenWidth - screenPadding - previewCardWidth - horizontalOffset;
    }

    const finalTop = rect.top + rect.height / 2;
    
    setPreviewState(prevState => {
      if (prevState.sourceTerm === term && prevState.visible) {
        return { ...prevState, visible: false, sourceTerm: '' };
      }
      return { 
        visible: true, 
        isLoading: true, 
        sourceTerm: term, 
        content: '', 
        toolCalls: [],
        top: finalTop, 
        left: finalLeft 
      };
    });
  }, [currentCardRef]);
  
  const handleClosePreview = () => {
    setPreviewState(p => ({...p, visible: false, sourceTerm: ''}));
  };
  
  const handleCreateCard = (messages: CardMessage[], parentId?: string) => {
    navigationAction.current = 'create';
    addCard(messages, parentId);
  };

  const handleCreateFromPreview = () => {
    if (!previewState.sourceTerm) return;

    lettingStreamContinueRef.current = true;
    
    navigationAction.current = 'create';
    const userMsg: CardMessage = { id: `msg_${Date.now()}_user`, role: 'user', content: previewState.sourceTerm, timestamp: Date.now() };
    const aiMsg: CardMessage = { 
        id: `msg_${Date.now()}_ai`, 
        role: 'ai', 
        content: previewState.content, 
        tool_calls: previewState.toolCalls,
        timestamp: Date.now() 
    };
    
    addCard([userMsg, aiMsg], currentCardId || undefined);
    
    setPreviewState(p => ({...p, visible: false}));

    const { projects, activeProjectId } = useProjectStore.getState();
    const activeProject = projects.find(p => p.id === activeProjectId);
    const newCardId = activeProject?.currentCardId;

    if (newCardId) {
      streamTargetRef.current = { type: 'card', cardId: newCardId, messageId: aiMsg.id };
    } else {
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
        streamAbortControllerRef.current = null;
      }
    }
  };

  const handleCreateFromSelection = () => {
    if (!selectedContent) return;
    navigationAction.current = 'create';

    const userMsg: CardMessage = { 
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`, 
      role: 'user', 
      content: selectedContent, 
      timestamp: Date.now() 
    };

    const originalCard = cards.find(c => c.id === currentCardId);
    const backgroundTopic = originalCard?.title;
    
    addCard([userMsg], currentCardId || undefined);
    setSelectedContent(null);

    const { projects, activeProjectId } = useProjectStore.getState();
    const activeProject = projects.find(p => p.id === activeProjectId);
    const newCardId = activeProject?.currentCardId;
    const newCard = activeProject?.cards.find(c => c.id === newCardId);

    if (newCardId && newCard) {
      fetchLLMStreamForNewCard(newCardId, newCard.messages, { userMessageId: userMsg.id }, backgroundTopic);
    }
  };
  
  const handleDelete = (id: string) => {
    navigationAction.current = 'delete';

    if (streamTargetRef.current?.type === 'card' && streamTargetRef.current.cardId === id) {
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
        streamAbortControllerRef.current = null;
      }
      streamTargetRef.current = null;
    }
    
    deleteCardAndDescendants(id);
  };


  const cardsToRender = useMemo(() => {
      if (animatedCards && animatedCards.length > 0) {
          return animatedCards;
      }
      
      const isTransitioning = (currentCardId !== prevCardId) && prevCardId;
      const idToRender = isTransitioning ? prevCardId : currentCardId;
      
      if (!idToRender) return [];

      const listToSearch = isTransitioning ? prevCards : cards;
      const stablePath = getPathFromCardList(idToRender, listToSearch);

      if (isTransitioning && stablePath.length === 0) {
          return [];
      }

      return stablePath.map((card, index) => {
          const depth = stablePath.length - 1 - index;
          return {
              id: card.id,
              card: card,
              status: 'stable' as AnimationStatus,
              style: getFullCardStyle(depth, dimensions),
          };
      });
  }, [animatedCards, currentCardId, prevCardId, cards, prevCards, getCardPath, dimensions]);

  useEffect(() => {
    if (!previewState.visible || !previewState.sourceTerm) {
      return;
    }

    streamTargetRef.current = { type: 'preview' };
    fetchAIForPreview(previewState.sourceTerm);

    return () => {
      if (lettingStreamContinueRef.current) {
        lettingStreamContinueRef.current = false;
        return;
      }
      
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
        streamAbortControllerRef.current = null;
      }
    };
  }, [previewState.visible, previewState.sourceTerm]);

  return (
    <div className="w-full h-full relative overflow-visible z-0">
      <style>{`
        .card-container {
          position: absolute;
          transition: all ${ANIMATION_DURATION}ms ease-in-out;
        }
        
        .card-container.exiting-dissolve { animation: card-dissolve ${ANIMATION_DURATION}ms forwards ease-in-out; }
        @keyframes card-dissolve { to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }

        .card-container.exiting-fly-right { animation: card-fly-right ${ANIMATION_DURATION}ms forwards ease-in-out; }
        @keyframes card-fly-right { to { opacity: 0; transform: translate(30%, -50%) scale(1); } }
        
        .card-container.exiting-fly-up-right { animation: card-fly-up-right ${ANIMATION_DURATION}ms forwards ease-in-out; }
        @keyframes card-fly-up-right { to { opacity: 0; transform: translate(-40%, -55%) scale(1.04) rotate(5deg); } }
        
        .card-container.exiting-shrink-out { animation: card-shrink-out ${ANIMATION_DURATION}ms forwards ease-in-out; }
        @keyframes card-shrink-out { from { opacity: 0.8; } to { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } }

        .card-container.exiting-up-and-grow { animation: card-exit-up-and-grow ${ANIMATION_DURATION}ms forwards ease-in-out; }
        @keyframes card-exit-up-and-grow {
          to {
            opacity: 0;
            transform: translate(-50%, -150%) scale(1.2);
          }
        }
      `}</style>
      
      {!currentCardId && cardsToRender.length === 0 ? (
              <div className="absolute pointer-events-none" style={{ left: dimensions.centerX, top: dimensions.centerY, transform: 'translate(-50%, -50%)' }}>
                <h1 className="font-bruno-ace font-normal text-center text-[#13E425]" style={{ 
                  fontSize: isMobile ? '72px' : (centerAreaWidth < 480 ? '96px' : '128px'), 
                  lineHeight: isMobile ? '72px' : (centerAreaWidth < 480 ? '96px' : '128px'), 
                  textShadow: '0px 0px 24px #13E425' 
                }} >
                  Start Explore
                </h1>
              </div>
            ) : (
              cardsToRender.map(ac => {
                  const isAnimating = animatedCards.length > 0;
                  const isTopCard = !isAnimating && ac.id === currentCardId;
                  const isHovered = !isTopCard && !isAnimating && ac.id === hoveredCardId;

                  let finalStyle = { ...ac.style };

                  if (isHovered) {
                      const baseScaleMatch = /scale\((.*?)\)/.exec(ac.style.transform as string);
                      const baseScale = baseScaleMatch ? parseFloat(baseScaleMatch[1]) : 1;
                      
                      finalStyle = {
                          ...finalStyle,
                          transform: (ac.style.transform as string).replace(/scale\(.*?\)/, `scale(${baseScale * 1.02})`),
                          filter: 'blur(0px) brightness(1)',
                          opacity: 1
                      };
                  }
                  
                  const zIndex = ac.style.zIndex;
                  const showCurrentDialog = isTopCard || (isAnimating && typeof zIndex === 'number' && zIndex >= 25);
                  
                  return (
                    <div key={ac.id} className={`card-container ${ac.status}`} style={{ ...finalStyle, pointerEvents: isTopCard ? 'auto' : 'none' }}>
                      <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
                        {showCurrentDialog ? (
                          <CurrentCardDialog
                            card={ac.card}
                            cardRef={isTopCard ? currentCardRef : undefined}
                            onDelete={() => handleDelete(ac.id)}
                            onCreateNew={() => handleCreateCard([], ac.id)}
                            onTextSelection={setSelectedContent}
                            onCreateFromSelection={handleCreateFromSelection}
                            onTermClick={handleTermClick}
                            isMobile={isMobile}
                          />
                        ) : (
                          <ParentCard 
                            card={ac.card} 
                            onClick={() => !isAnimating && setCurrentCard(ac.id)}
                            onHoverStart={() => setHoveredCardId(ac.id)}
                            onHoverEnd={() => setHoveredCardId(null)}
                            isMobile={isMobile}
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
          toolCalls={previewState.toolCalls}
          isLoading={previewState.isLoading}
          onClose={handleClosePreview}
          onCreate={handleCreateFromPreview}
          parentRef={currentCardRef}
        />,
        portalRoot
      )}
    </div>
  );
};