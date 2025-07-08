import React, { useEffect, useState } from 'react';
import useCardStore, { CardData } from '../stores/cardStore';
import { X, Plus, ZoomIn } from 'lucide-react'; // 1. 导入 ZoomIn
import { useProjectStore } from '../stores/projectStore';

// 计算卡片位置函数，使用固定角度步长
const calculateCardPosition = (
  index: number, // 父卡片在路径中的索引（1-based, 1=直接父卡片）
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

  const startAngle = Math.PI / 3; // 圆弧顶部的起始角度 (60°)
  
  // 固定的 5° 间隔
  const fixedAngleStep = (5 * Math.PI) / 180; // 5 degrees in radians

  // 根据固定步长计算卡片角度
  const cardAngle = startAngle - index * fixedAngleStep;

  const x = circleCenterX - R * Math.cos(cardAngle);
  const y = circleCenterY - R * Math.sin(cardAngle);
  return { x, y };
};

// 文本选择创建卡片按钮组件 (无需修改)
const SelectionCreateButton: React.FC<{
  selectedText: string;
  position: { x: number; y: number };
  onCreateCard: () => void;
  onClose: () => void;
}> = ({ selectedText, position, onCreateCard, onClose }) => {
  return (
    <div
      className="absolute z-50 bg-[#4C4C4C] rounded-lg p-2 shadow-lg border border-[#666]"
      style={{
        left: position.x,
        top: position.y - 40,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateCard}
          className="w-6 h-6 bg-[#13E425] rounded-full flex items-center justify-center hover:bg-[#11C020] transition-colors"
          title="从选中文本创建新卡片"
        >
          <Plus size={12} className="text-black" />
        </button>
        <button
          onClick={onClose}
          className="w-6 h-6 bg-[#666] rounded-full flex items-center justify-center hover:bg-[#777] transition-colors"
          title="取消"
        >
          <X size={12} className="text-white" />
        </button>
      </div>
      <div className="text-xs text-white mt-1 max-w-[200px] truncate">
        {selectedText}
      </div>
    </div>
  );
};


// 当前卡片对话框组件
const CurrentCardDialog: React.FC<{ 
  card: CardData; 
  cardRef?: React.RefObject<HTMLDivElement>; 
  maxHeight?: number; 
  maxWidth?: number;
  onDelete: () => void;
  onCreateNew: () => void;
  onTextSelection: (text: string, position: { x: number; y: number }) => void;
}> = ({ card, cardRef, maxHeight, maxWidth, onDelete, onCreateNew, onTextSelection }) => {
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelection(selection.toString().trim(), {
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 100);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div
      ref={cardRef}
      className="bg-[#222222] text-white rounded-[24px] shadow-card p-4 flex flex-col items-start justify-start text-left transform scale-100"
      style={{
        width: maxWidth ? maxWidth * 0.75 : '75%',
        height: maxHeight ? maxHeight * 0.75 : '75%',
        maxHeight: maxHeight ? maxHeight * 0.75 : '75%',
        transform: 'scale(1)',
        transformOrigin: 'center center',
        boxShadow: '-4px 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex items-center justify-between w-full mb-2 pb-1 border-b border-[#333]">
        <span className="font-normal text-title leading-[36px] flex-1 truncate pr-2">{card.title || '无标题卡片'}</span>
        <div className="flex items-center gap-2">
          {/* 2. 替换为 ZoomIn 图标 */}
          <button onClick={onCreateNew} className="w-9 h-9 bg-[#4C4C4C] rounded-full flex items-center justify-center shadow-card hover:bg-[#5C5C5C] transition-colors" title="创建新卡片">
            <ZoomIn className="w-5 h-5" color="#13E425" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center hover:bg-[#3C3C3C] rounded-full transition-colors" title="删除当前卡片及其所有子孙">
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>
      <div className="w-full flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-thin scrollbar-thumb-[#D9D9D9] scrollbar-track-[#222222]">
        {card.messages && card.messages.length > 0 ? (
          <div className="flex flex-col gap-2">
            {card.messages.map((msg, idx) => (
              msg.role === 'user' ? (
                <div key={msg.id || idx} className="flex justify-end">
                  <div className="bg-[#4C4C4C] rounded-[16px_4px_16px_16px] px-3 py-2 max-w-[80%]"><span className="font-normal text-content leading-[28px] text-white">{msg.content}</span></div>
                </div>
              ) : (
                <div key={msg.id || idx} className="flex justify-start"><span className="font-normal text-content leading-[28px] text-white max-w-[80%] whitespace-pre-wrap">{msg.content}</span></div>
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
  index: number; // 层级索引 (1 = 直接父卡片, 2 = 祖父卡片, ...)
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
    createCardFromSelection, 
    generateTitle, 
    isTyping 
  } = useCardStore();
  
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;

  const currentCard = cards.find(c => c.id === currentCardId);
  const [selectionState, setSelectionState] = useState<{ text: string; position: { x: number; y: number; }; } | null>(null);

  // 【改动】移除了自动创建初始卡片的 useEffect

  // 延时10秒自动生成卡片标题
  useEffect(() => {
    if (isTyping || !currentCardId || !currentCard || currentCard.messages.length === 0) {
      return;
    }

    const timerId = setTimeout(() => {
      generateTitle(currentCardId);
    }, 10000); // 10秒延时

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
  const handleTextSelection = (text: string, position: { x: number; y: number }) => { setSelectionState({ text, position }); };
  const handleCreateFromSelection = () => { if (selectionState) { createCardFromSelection(selectionState.text, currentCardId || undefined); setSelectionState(null); window.getSelection()?.removeAllRanges(); } };
  const handleCloseSelection = () => { setSelectionState(null); window.getSelection()?.removeAllRanges(); };

  return (
    <div className="w-full h-full relative overflow-visible z-0">
      {/* 【改动】根据是否存在 currentCard 来决定显示内容 */}
      {!currentCard ? (
        // 当没有卡片时，显示 "Start Explore"
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
        // 当存在卡片时，显示卡片堆
        <>
          {/* 父卡片堆叠 */}
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
          
          {/* 当前卡片 */}
          <div
            className="absolute transition-all duration-300 ease-in-out"
            style={{
              left: centerX,
              top: centerY,
              transform: 'translate(-50%, -50%)',
              zIndex: parentCardCount + 1,
            }}
          >
            <CurrentCardDialog card={currentCard} maxHeight={availableHeight} maxWidth={centerAreaWidth} onDelete={handleDelete} onCreateNew={handleCreateNew} onTextSelection={handleTextSelection} />
          </div>
        </>
      )}

      {/* 文本选择创建卡片按钮 */}
      {selectionState && (
        <SelectionCreateButton selectedText={selectionState.text} position={selectionState.position} onCreateCard={handleCreateFromSelection} onClose={handleCloseSelection} />
      )}
    </div>
  );
};