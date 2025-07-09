import React, { useEffect, useState, useRef, useCallback } from 'react';
import useCardStore, { CardData } from '../stores/cardStore';
// 1. 导入 FileText 和 Image 用于显示附件，删除了不再使用的 Plus
import { X, ZoomIn, FileText } from 'lucide-react'; 
import { useProjectStore } from '../stores/projectStore';

// 计算卡片位置函数，使用固定角度步长 (无需修改)
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

// 【改动】文本选择创建卡片按钮组件已被删除

// 当前卡片对话框组件
const CurrentCardDialog: React.FC<{ 
  card: CardData; 
  cardRef?: React.RefObject<HTMLDivElement>; 
  maxHeight?: number; 
  maxWidth?: number;
  onDelete: () => void;
  onCreateNew: () => void;
  onTextSelection: (text: string) => void; // 【改动】onTextSelection 不再需要 position
}> = ({ card, cardRef, maxHeight, maxWidth, onDelete, onCreateNew, onTextSelection }) => {
  
  // 【新增】状态来管理文本选择按钮的可见性、位置
  const [selectionButton, setSelectionButton] = useState({
    visible: false,
    top: 0,
    left: 0,
  });

  
  // 【修改】handleTextSelection现在负责更新按钮状态
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      onTextSelection(selectedText); // 仍然更新全局状态

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect(); // 获取选区的位置
      const containerRect = cardRef?.current?.getBoundingClientRect(); // 获取对话框容器的位置

      if (containerRect) {
        // 计算相对于对话框容器的精确位置
        const top = rect.top - containerRect.top;
        const left = rect.right - containerRect.left;
        
        setSelectionButton({ visible: true, top, left });
      }
    } else {
      // 如果没有选择文本或点击了其他地方，则隐藏按钮
      setSelectionButton({ visible: false, top: 0, left: 0 });
    }
  }, [onTextSelection, cardRef]); // 依赖项

  useEffect(() => {
    const handleMouseUp = () => {
      // 使用 setTimeout 确保选区已最终确定
      setTimeout(handleTextSelection, 0); // 可以使用0ms延迟
    };
    
    // 我们只在对话框内部监听 mouseup，避免全局监听的副作用
    const container = cardRef?.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [cardRef, handleTextSelection]); // 【修改】更新依赖项

  // 【新增】当用户点击按钮时，创建新卡片并隐藏按钮
  const handleCreateFromSelection = () => {
    onCreateNew();
    setSelectionButton({ visible: false, top: 0, left: 0 });
  };

  return (
    <div
      ref={cardRef}
      // 【新增】添加 position: relative 使绝对定位的子元素相对于此容器
      className="bg-[#222222] text-white rounded-[24px] shadow-card p-4 flex flex-col items-start justify-start text-left transform scale-100 relative"
      style={{
        width: maxWidth ? maxWidth * 0.75 : '75%',
        height: maxHeight ? maxHeight * 0.75 : '75%',
        maxHeight: maxHeight ? maxHeight * 0.75 : '75%',
        transform: 'scale(1)',
        transformOrigin: 'center center',
        boxShadow: '-4px 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* 【新增】渲染基于文本选择的创建按钮 */}
      {selectionButton.visible && (
        <button
          onClick={handleCreateFromSelection}
          className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center hover:bg-[#5C5C5C] transition-colors absolute z-10"
          title="基于选中内容创建新卡片"
          style={{
            top: `${selectionButton.top}px`,
            left: `${selectionButton.left}px`,
            // 使用 transform 将按钮的中心对准选区的右上角，并向上偏移一点，避免遮挡
            transform: 'translate(-50%, -120%)', 
          }}
        >
          <ZoomIn className="w-5 h-5" color="#13E425" />
        </button>
      )}

      <div className="flex items-center justify-between w-full mb-2 pb-1 border-b border-[#333]">
        <span className="font-normal text-title leading-[36px] flex-1 truncate pr-2">{card.title || '无标题卡片'}</span>
        <div className="flex items-center gap-2">
          {/* 2. 替换为 ZoomIn 图标 (无变化) */}
          <button onClick={onCreateNew} className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center shadow-card hover:bg-[#5C5C5C] transition-colors" title="创建新卡片">
            <ZoomIn className="w-5 h-5" color="#13E425" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full transition-colors" title="删除当前卡片及其所有子孙">
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>
      {/* 【代码修改】滚动条样式已更新 */}
      <div className="w-full flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-[#222222] [&::-webkit-scrollbar-thumb]:bg-[#D9D9D9] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-button]:hidden">
        {card.messages && card.messages.length > 0 ? (
          /* 【代码修改】为内容添加了右内边距，防止与滚动条重叠 */
          <div className="flex flex-col gap-2 pr-4"> 
            {card.messages.map((msg, idx) => (
              msg.role === 'user' ? (
                // 【改动】用户消息渲染逻辑，以支持附件显示
                <div key={msg.id || idx} className="flex justify-end">
                  <div className="w-full flex flex-col items-end gap-2">
                    {/* 渲染选中的文本 (context) */}
                    {msg.context && (
                      <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[80%]">
                        <p className="font-normal text-content leading-[28px] text-white whitespace-pre-wrap">{msg.context}</p>
                      </div>
                    )}
                    {/* 渲染文件附件 */}
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
                      } catch (e) {
                        return null; // 忽略无法解析的旧格式文件
                      }
                    })}
                    {/* 渲染主要输入文本 (仅当有内容时) */}
                    {msg.content.trim() && (
                      <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[100%]">
                        <span className="font-normal text-content leading-[28px] text-white whitespace-pre-wrap">{msg.content}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={msg.id || idx} className="flex justify-start"><span className="font-normal text-content leading-[28px] text-white max-w-[100%] whitespace-pre-wrap">{msg.content}</span></div>
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

// 父卡片组件 (无需修改)
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
        e.currentTarget.style.filter = `blur(0px) brightness(1)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
        e.currentTarget.style.filter = `blur(${blur}px) brightness(${brightness})`;
      }}
    >
      <div className="p-4 h-full flex flex-col text-white">
        <div className="font-normal text-title leading-[36px] mb-2 truncate">{card.title || '无标题卡片'}</div>
        <div className="flex-1 overflow-hidden text-[#888] text-sm">
          {card.messages && card.messages.length > 0 ? (
            <div className="line-clamp-3">{card.messages.map(m => m.content).join(' ') || '暂无内容'}</div>
          ) : ('暂无内容')}
        </div>
      </div>
    </div>
  );
};

interface CardStackProps {
  centerY: number;
  availableHeight: number;
  centerAreaWidth: number;
}

// CardStack 组件
export const CardStack: React.FC<CardStackProps> = ({ centerY, availableHeight, centerAreaWidth }) => {
  const { 
    addCard, 
    setCurrentCard, 
    getCardPath, 
    deleteCardAndDescendants, 
    // 【改动】获取 setSelectedContent 用于处理文本选择
    setSelectedContent,
    generateTitle, 
    isTyping 
  } = useCardStore();
  
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;

  const currentCard = cards.find(c => c.id === currentCardId);
  // 【改动】移除了 selectionState
  // 【新增】为 CurrentCardDialog 创建一个 ref
  const currentCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTyping || !currentCardId || !currentCard || currentCard.messages.length === 0) {
      return;
    }
    const timerId = setTimeout(() => {
      generateTitle(currentCardId);
    }, 3000);
    return () => clearTimeout(timerId);
  }, [currentCardId, currentCard?.messages, isTyping, generateTitle]);

  const centerX = centerAreaWidth / 2;
  const currentCardWidth = centerAreaWidth * 0.75;
  const currentCardHeight = availableHeight * 0.75;
  
  const cardPath = currentCard ? getCardPath(currentCard.id) : [];
  const allParentCards = cardPath.slice(0, -1);

  const MAX_VISIBLE_PARENTS = 24;
  const parentCards = allParentCards.slice(-MAX_VISIBLE_PARENTS);
  const parentCardCount = parentCards.length;

  const handleDelete = () => { if (currentCardId) { deleteCardAndDescendants(currentCardId); } };
  const handleCreateNew = () => { addCard([], currentCardId || undefined); };
  const handleParentCardClick = (cardId: string) => { setCurrentCard(cardId); };
  // 【改动】文本选择现在直接更新全局状态，移除了本地处理逻辑
  const handleTextSelection = (text: string) => { setSelectedContent(text); };
  
  return (
    <div className="w-full h-full relative overflow-visible z-0">
      {!currentCard ? (
        <div
          className="absolute pointer-events-none"
          style={{
            left: centerX,
            top: centerY,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <h1
            className="font-bruno-ace font-normal text-center text-[#13E425]"
            style={{
              fontSize: '128px',
              lineHeight: '128px',
              textShadow: '0px 0px 24px #13E425'
            }}
          >
            Start Explore
          </h1>
        </div>
      ) : (
        <>
          {parentCards.map((card, map_index) => {
            const layerIndex = parentCardCount - map_index;
            const zIndex = map_index + 1;
            return (
              <ParentCard
                key={card.id}
                card={card}
                index={layerIndex}
                zIndex={zIndex}
                centerX={centerX}
                centerY={centerY}
                onClick={() => handleParentCardClick(card.id)}
                currentCardWidth={currentCardWidth}
                currentCardHeight={currentCardHeight}
                availableHeight={availableHeight}
              />
            );
          })}
          
          <div
            className="absolute transition-all duration-300 ease-in-out"
            style={{
              left: centerX,
              top: centerY,
              transform: 'translate(-50%, -50%)',
              zIndex: parentCardCount + 1,
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
            />
          </div>
        </>
      )}
      {/* 【改动】移除了文本选择创建卡片按钮的渲染 */}
    </div>
  );
};