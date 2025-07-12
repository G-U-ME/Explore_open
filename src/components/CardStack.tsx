import React, { useEffect, useState, useRef, useCallback } from 'react';
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



// [THE DEFINITIVE WORKING SOLUTION - STAGE 1: REMARK PLUGIN]
// This plugin now generates raw HTML directly. This is the most robust method
// when data transfer between remark and rehype is failing.
const remarkConceptualTerm = () => {
  return (tree: Node) => {
    visit(tree, 'text', (node: Literal, index: number | undefined, parent: Parent | undefined) => {
      const nodeValue = node.value as string;
      if (typeof nodeValue !== 'string' || !/@@.*?@@/.test(nodeValue)) return;
      if (!parent || !Array.isArray(parent.children) || typeof index !== 'number') return;
      
      const newNodes: (Node | Literal)[] = [];
      let lastIndex = 0;
      const regex = /@@(.*?)@@/g;
      let match;

      while ((match = regex.exec(nodeValue)) !== null) {
        if (match.index > lastIndex) {
          newNodes.push({ type: 'text', value: nodeValue.slice(lastIndex, match.index) });
        }
        
        const term = match[1];
        // THE KEY CHANGE: Create an 'html' node. Its value is the exact HTML string we want.
        // This bypasses all complex data passing.
        newNodes.push({
          type: 'html',
          value: `<span class="conceptual-term">${term}</span>`,
        });

        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < nodeValue.length) {
        newNodes.push({ type: 'text', value: nodeValue.slice(lastIndex) });
      }
      
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
        return ['skip', index + newNodes.length];
      }
    });
  };
};

// We need rehype-raw to parse the HTML string we just created.
import rehypeRaw from 'rehype-raw';


// PreviewCard (No changes needed here)
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

  return (
    <div
      className="fixed bg-[#222222] text-white rounded-[16px] shadow-card p-3 flex flex-col items-start justify-start text-left z-50"
      style={{
        left: position.left,
        top: position.top,
        width: cardWidth,
        height: cardHeight,
        transform: 'translate(10px, -50%)',
      }}
    >
      <div className="flex items-center justify-end w-full mb-1">
        <div className="flex items-center gap-2">
          <button onClick={onCreate} className="w-7 h-7 bg-[#4C4C4C] rounded-full flex items-center justify-center shadow-card hover:bg-[#5C5C5C] transition-colors" title="基于预览创建新卡片">
            <ZoomIn className="w-4 h-4" color="#13E425" />
          </button>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full transition-colors" title="关闭预览">
            <X size={14} className="text-white" />
          </button>
        </div>
      </div>
      <div className="w-full flex-1 overflow-y-auto min-h-0 text-sm [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-[#222222] [&::-webkit-scrollbar-thumb]:bg-[#888] [&::-webkit-scrollbar-thumb]:rounded-full">
        {isLoading && <Loader className="animate-spin text-gray-400 mx-auto mt-4" />}
        <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
        >
            {cleanContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};





// [THE DEFINITIVE WORKING SOLUTION - STAGE 2: SANITIZE SCHEMA]
const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow our specific attributes on the <span> tag.
    span: [
      ...(defaultSchema.attributes?.span || []),
      'className',
    ],
  },
};

// Define props for the span component.
interface CustomSpanProps extends React.HTMLAttributes<HTMLSpanElement> {
    children?: React.ReactNode;
    node?: ExtraProps['node'];
}

// [THE DEFINITIVE WORKING SOLUTION - STAGE 3: REACT RENDERER]
const MarkdownRenderer: React.FC<{ 
  content: string; 
  onTermClick: (term: string, rect: DOMRect) => void;
}> = React.memo(({ content, onTermClick }) => {
  const customComponents: Components = {
    // The renderer now only needs to handle the final, parsed <span>.
    span: ({ node, children, ...props }: CustomSpanProps) => {
      // Check for the class and data-term attribute.
      if (props.className === 'conceptual-term') {
        const term = React.Children.toArray(children).join('');
        
        return (
          <span
            {...props} // Spread the props (which includes className and data-term)
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onTermClick(term, rect);
            }}
          >
            {children}
          </span>
        );
      }
      // For any other <span>, render it normally.
      return <span {...props}>{children}</span>;
    },
  };

  return (
    <div className="markdown-content w-full">
      <ReactMarkdown
        // The remark plugin order remains the same.
        remarkPlugins={[remarkGfm, remarkConceptualTerm, remarkMath]}
        // [CRITICAL] The rehype pipeline now uses rehype-raw.
        rehypePlugins={[
            rehypeRaw, // 1. IMPORTANT: This plugin parses the HTML string from our remark plugin.
            rehypeKatex, 
            [rehypeSanitize, customSanitizeSchema] // 2. Sanitize the result.
        ]}
        components={customComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});


// CurrentCardDialog (No changes needed here, as it uses the fixed MarkdownRenderer)
const CurrentCardDialog: React.FC<{ 
  card: CardData; 
  cardRef?: React.RefObject<HTMLDivElement>; 
  maxHeight?: number; 
  maxWidth?: number;
  onDelete: () => void;
  onCreateNew: () => void;
  onTextSelection: (text: string) => void;
  onCreateFromSelection: () => void;
  onTermClick: (term: string, rect: DOMRect) => void;
}> = ({ card, cardRef, maxHeight, maxWidth, onDelete, onCreateNew, onTextSelection, onCreateFromSelection, onTermClick }) => {
  
  const [selectionButton, setSelectionButton] = useState({ visible: false, top: 0, left: 0 });

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      onTextSelection(selectedText); 
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = cardRef?.current?.getBoundingClientRect();
      if (containerRect) {
        const top = rect.top - containerRect.top;
        const left = rect.right - containerRect.left;
        setSelectionButton({ visible: true, top, left });
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
      className="bg-[#222222] text-white rounded-[24px] shadow-card p-4 flex flex-col items-start justify-start text-left transform scale-100 relative"
      style={{
        width: maxWidth ? maxWidth * 0.75 : '75%',
        height: maxHeight ? maxHeight * 0.75 : '75%',
        maxHeight: maxHeight ? maxHeight * 0.75 : '75%',
        boxShadow: '-4px 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <style>{`
        .conceptual-term { 
          display: inline;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
          color: #FFFFFF;
          font-weight: 500;
          border-bottom: 1px dotted #888;
        }
        .conceptual-term:hover { 
          border-bottom: 1px solid #FFF;
        }
      `}</style>
      
      {selectionButton.visible && (
        <button
          onClick={handleCreateFromSelectionClick}
          className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center hover:bg-[#5C5C5C] transition-colors absolute z-10"
          title="基于选中内容创建新卡片并提问"
          style={{ top: `${selectionButton.top}px`, left: `${selectionButton.left}px`, transform: 'translate(-50%, -120%)' }}
        >
            <ZoomIn className="w-5 h-5" color="#13E425" />
        </button>
      )}

      <div className="flex items-center justify-between w-full mb-2 pb-1 border-b border-[#333]">
        <span className="font-normal text-title leading-[36px] flex-1 truncate pr-2">{card.title || '无标题卡片'}</span>
        <div className="flex items-center gap-2">
          <button onClick={onCreateNew} className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center shadow-card hover:bg-[#5C5C5C] transition-colors" title="创建新卡片">
            <ZoomIn className="w-5 h-5" color="#13E425" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full transition-colors" title="删除当前卡片及其所有子孙">
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>
      <div className="w-full flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#222222] [&::-webkit-scrollbar-thumb]:bg-[#D9D9D9] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-button]:hidden">
        {card.messages && card.messages.length > 0 ? (
          <div className="flex flex-col gap-2 pr-4"> 
            {card.messages.map((msg, idx) => (
              msg.role === 'user' ? (
                <div key={msg.id || idx} className="flex justify-end">
                  <div className="w-full flex flex-col items-end gap-2">
                    {msg.context && (
                        <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[80%]">
                            <p className="font-normal text-content leading-[28px] text-white whitespace-pre-wrap">{msg.context}</p>
                        </div>
                    )}
                    {msg.files && msg.files.map((fileString, fileIdx) => {
                      try {
                        const fileInfo = JSON.parse(fileString);
                        return (
                          <div key={fileIdx} className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] p-2 max-w-[80%] w-fit">
                            {fileInfo.type?.startsWith('image/') && fileInfo.dataUrl ? (
                                <img src={fileInfo.dataUrl} alt={fileInfo.name} className="max-w-full max-h-80 rounded-lg object-contain" />
                            ) : (
                                <div className="flex items-center gap-2 p-1">
                                    <FileText size={20} className="text-white flex-shrink-0" />
                                    <span className="font-normal text-sm text-white truncate">{fileInfo.name}</span>
                                </div>
                            )}
                          </div>
                        );
                      } catch (e) { return null; }
                    })}
                    {msg.content.trim() && (
                        <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[100%]">
                            <span className="font-normal text-content leading-[28px] text-white whitespace-pre-wrap">{msg.content}</span>
                        </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={msg.id || idx} className="flex justify-start text-white text-content leading-[28px] max-w-full">
                  <MarkdownRenderer content={msg.content} onTermClick={onTermClick} />
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="text-center text-[#888] text-lg leading-[28px] py-4">Start Explore</div>
        )}
      </div>
    </div>
  );
};


// ParentCard (No changes needed)
const ParentCard: React.FC<{
  card: CardData;
  index: number;
  zIndex: number;
  centerX: number;
  centerY: number;
  onClick: () => void;
  currentCardWidth: number;
  currentCardHeight: number;
  availableHeight: number;
}> = ({ card, index, zIndex, centerX, centerY, onClick, currentCardWidth, currentCardHeight, availableHeight }) => {
  const { x, y } = calculateCardPosition(index, centerX, centerY, availableHeight);
  const scale = 0.96 - ((index - 1) * 0.04);
  const blur = index * 0.5;
  const brightness = Math.max(0.8, 1 - (index * 0.05));
  const rotation = -5 * index;

  return (
    <div
      className="absolute cursor-pointer transition-all duration-300 ease-in-out"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        filter: `blur(${blur}px) brightness(${brightness})`,
        width: currentCardWidth,
        height: currentCardHeight,
        background: '#222222',
        borderRadius: '24px',
        boxShadow: '-4px 8px 24px rgba(0, 0, 0, 0.3)',
        opacity: 0.8,
        zIndex: zIndex,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale * 1.05})`;
        e.currentTarget.style.filter = 'blur(0px) brightness(1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
        e.currentTarget.style.filter = `blur(${blur}px) brightness(${brightness})`;
      }}
    >
      <div className="p-4 h-full flex flex-col text-white">
        <div className="font-normal text-title leading-[36px] mb-2 truncate">
          {card.title || '无标题卡片'}
        </div>
        <div className="flex-1 overflow-hidden text-[#888] text-sm">
          {card.messages && card.messages.length > 0 ? (
            <div className="line-clamp-3">
              {card.messages.map(m => m.content).join(' ') || '暂无内容'}
            </div>
          ) : (
            '暂无内容'
          )}
        </div>
      </div>
    </div>
  );
};

// calculateCardPosition (No changes needed)
const calculateCardPosition = (
  index: number,
  centerX: number,
  centerY: number,
  availableHeight: number
) => {
  if (availableHeight <= centerY) {
    return { x: centerX, y: centerY + index * 20 };
  }
  const chordLength = availableHeight - centerY;
  const R = chordLength / Math.sqrt(3);
  const circleCenterY = (centerY + availableHeight) / 2;
  const distToCenter = R * 0.5;
  const circleCenterX = centerX + distToCenter;
  const startAngle = Math.PI / 3;
  const fixedAngleStep = (5 * Math.PI) / 180;
  const cardAngle = startAngle - index * fixedAngleStep;
  const x = circleCenterX - R * Math.cos(cardAngle);
  const y = circleCenterY - R * Math.sin(cardAngle);
  return { x, y };
};


// CardStack (No changes needed)
interface CardStackProps {
  centerY: number;
  availableHeight: number;
  centerAreaWidth: number;
}

export const CardStack: React.FC<CardStackProps> = ({ centerY, availableHeight, centerAreaWidth }) => {
  // Zustand Store Hooks
  const {
    addCard,
    setCurrentCard,
    getCardPath,
    deleteCardAndDescendants,
    setSelectedContent,
    selectedContent,
    generateTitle,
    isTyping,
    appendMessage,
    updateMessage,
    setIsTyping: setGlobalIsTyping
  } = useCardStore();
  const { projects, activeProjectId } = useProjectStore();
  const { apiUrl, apiKey, activeModel, globalSystemPrompt, dialogueSystemPrompt } = useSettingsStore();

  // Derived State from Stores
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;
  const currentCard = cards.find(c => c.id === currentCardId);

  // Refs and Component State
  const currentCardRef = useRef<HTMLDivElement>(null);
  type PreviewState = {
    visible: boolean;
    top: number;
    left: number;
    content: string;
    isLoading: boolean;
    sourceTerm: string;
  };
  const [previewState, setPreviewState] = useState<PreviewState>({
    visible: false,
    top: 0,
    left: 0,
    content: '',
    isLoading: false,
    sourceTerm: ''
  });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // Effects
  useEffect(() => {
    setPortalRoot(document.getElementById('portal-root'));
  }, []);

  useEffect(() => {
    if (isTyping || !currentCardId || !currentCard || currentCard.messages.length === 0) {
      return;
    }
    const timerId = setTimeout(() => {
      generateTitle(currentCardId);
    }, 3000);
    return () => clearTimeout(timerId);
  }, [currentCardId, currentCard?.messages, isTyping, generateTitle]);

  const fetchAIForPreview = async (term: string) => {
    if (!apiUrl || !apiKey || !activeModel) {
      setPreviewState((prev) => ({ ...prev, content: "API settings are missing.", isLoading: false }));
      return;
    }

    const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (systemPromptContent) {
      messages.push({ role: 'system', content: systemPromptContent });
    }
    messages.push({ role: 'user', content: term });

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
              setPreviewState((prev) => ({ ...prev, content: prev.content + delta, isLoading: false }));
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

  const triggerAIForCard = async (cardId: string, history: CardMessage[]) => {
    setGlobalIsTyping(true);
    const aiMsgId = `msg_${Date.now()}_ai`;
    appendMessage(cardId, { id: aiMsgId, role: 'ai', content: '', timestamp: Date.now() });

    try {
      const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
      const apiMessages = history.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
      }));

      if (systemPromptContent) {
        apiMessages.unshift({ role: 'system', content: systemPromptContent });
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: activeModel, messages: apiMessages, stream: true }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API Error: ${res.statusText}`);
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
              updateMessage(cardId, aiMsgId, { content: aiContent });
            }
          } catch (e) {
            console.warn('Stream parsing error:', e);
          }
        }
      }
    } catch (error) {
      console.error('AI call failed:', error);
      updateMessage(cardId, aiMsgId, { content: 'AI response failed.' });
    } finally {
      setGlobalIsTyping(false);
    }
  };

  const handleTermClick = (term: string, rect: DOMRect) => {
    setPreviewState({
      visible: true,
      isLoading: true,
      sourceTerm: term,
      content: '',
      top: rect.top + rect.height / 2,
      left: rect.right,
    });
    fetchAIForPreview(term);
  };

  const handlePreviewClose = () => {
    setPreviewState({ ...previewState, visible: false });
  };

  const handlePreviewCreate = () => {
    const userMsg: CardMessage = { id: `msg_${Date.now()}_user`, role: 'user', content: previewState.sourceTerm, timestamp: Date.now() };
    const aiMsg: CardMessage = { id: `msg_${Date.now()}_ai`, role: 'ai', content: previewState.content.replace(/@@(.*?)@@/g, '$1'), timestamp: Date.now() };
    addCard([userMsg, aiMsg], currentCardId || undefined);
    handlePreviewClose();
  };

  const handleCreateFromSelection = () => {
    if (!selectedContent) return;

    const userMsg: CardMessage = { id: `msg_${Date.now()}_user`, role: 'user', content: selectedContent, timestamp: Date.now() };
    addCard([userMsg], currentCardId || undefined);
    setSelectedContent(null);
    
    // Trigger AI response for the newly created card
    setTimeout(() => {
      const state = useProjectStore.getState();
      const project = state.projects.find(p => p.id === state.activeProjectId);
      const newCardId = project?.currentCardId;
      const newCard = project?.cards.find(c => c.id === newCardId);
      if (newCardId && newCard?.messages) {
        triggerAIForCard(newCardId, newCard.messages);
      }
    }, 0);
  };

  // Simple event handlers
  const handleDelete = () => {
    if (currentCardId) {
      deleteCardAndDescendants(currentCardId);
    }
  };
  const handleCreateNew = () => {
    addCard([], currentCardId || undefined);
  };
  const handleParentCardClick = (cardId: string) => {
    setCurrentCard(cardId);
  };
  const handleTextSelection = (text: string) => {
    setSelectedContent(text);
  };

  // Render Logic
  const centerX = centerAreaWidth / 2;
  const currentCardWidth = centerAreaWidth * 0.75;
  const currentCardHeight = availableHeight * 0.75;
  const cardPath = currentCard ? getCardPath(currentCard.id) : [];
  const allParentCards = cardPath.slice(0, -1);
  const parentCards = allParentCards.slice(-24); // Limit to a reasonable number for performance/visuals
  const parentCardCount = parentCards.length;

  return (
    <div className="w-full h-full relative overflow-visible z-0">
      {!currentCard ? (
        // Initial state when no card is selected
        <div
          className="absolute pointer-events-none"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}
        >
          <h1
            className="font-bruno-ace font-normal text-center text-[#13E425]"
            style={{ fontSize: '128px', lineHeight: '128px', textShadow: '0px 0px 24px #13E425' }}
          >
            Start Explore
          </h1>
        </div>
      ) : (
        // Main view with current card and parent cards
        <>
          {parentCards.map((card, map_index) => (
            <ParentCard
              key={card.id}
              card={card}
              index={parentCardCount - map_index}
              zIndex={map_index + 1}
              centerX={centerX}
              centerY={centerY}
              onClick={() => handleParentCardClick(card.id)}
              currentCardWidth={currentCardWidth}
              currentCardHeight={currentCardHeight}
              availableHeight={availableHeight}
            />
          ))}
          <div
            className="absolute transition-all duration-300 ease-in-out"
            style={{
              left: centerX,
              top: centerY,
              transform: 'translate(-50%, -50%)',
              zIndex: parentCardCount + 1
            }}
            ref={currentCardRef}
          >
            <CurrentCardDialog
              card={currentCard}
              cardRef={currentCardRef}
              maxHeight={availableHeight}
              maxWidth={centerAreaWidth}
              onDelete={handleDelete}
              onCreateNew={handleCreateNew}
              onTextSelection={handleTextSelection}
              onCreateFromSelection={handleCreateFromSelection}
              onTermClick={handleTermClick}
            />
            {previewState.visible && portalRoot && ReactDOM.createPortal(
              <PreviewCard
                position={{ top: previewState.top, left: previewState.left }}
                content={previewState.content}
                isLoading={previewState.isLoading}
                onClose={handlePreviewClose}
                onCreate={handlePreviewCreate}
                parentRef={currentCardRef}
              />,
              portalRoot
            )}
          </div>
        </>
      )}
    </div>
  );
};