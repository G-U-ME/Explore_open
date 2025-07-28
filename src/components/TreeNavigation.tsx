import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import useCardStore, { CardData } from '../stores/cardStore'
import { useProjectStore } from '../stores/projectStore'

interface TreeNodeProps {
  card: CardData
  x: number
  y: number
  onClick: () => void
  isCurrent: boolean
  isActive: boolean
  onHover: (show: boolean, card: CardData) => void
}

const TreeNode: React.FC<TreeNodeProps> = ({ 
  card, 
  x, 
  y, 
  onClick, 
  isCurrent, 
  isActive, 
  onHover 
}) => {
  const radius = 14
  
  const styles = {
    default: {
      fill: 'transparent',
      stroke: '#999999',
      strokeWidth: '2',
      filter: 'none'
    },
    current: {
      fill: '#FFFFFF',
      stroke: '#FFFFFF',
      strokeWidth: '2',
      filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.9))'
    },
    active: {
      fill: 'transparent',
      stroke: '#13E425',
      strokeWidth: '4',
      filter: 'drop-shadow(0 0 6px #13E425)'
    }
  }

  const currentStyle = isCurrent ? styles.current : isActive ? styles.active : styles.default

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => onHover(true, card)}
      onMouseLeave={() => onHover(false, card)}
    >
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={currentStyle.fill}
        stroke={currentStyle.stroke}
        strokeWidth={currentStyle.strokeWidth}
        className="transition-all duration-200"
        style={{ filter: currentStyle.filter }}
      />
      
      <title>{card.title || '无标题卡片'}</title>
    </g>
  )
}

interface TreeNavigationProps {
  layoutMode?: 'vertical' | 'horizontal';
}


const calculateTreeLayout = (
  cards: CardData[],
  containerHeight: number,
  containerWidth: number,
  layoutMode: 'vertical' | 'horizontal'
) => {
  const cardMap = new Map(cards.map(card => [card.id, card]));
  const layers: CardData[][] = [];
  const cardToDepth = new Map<string, number>();

  const buildLayers = (cardId: string, depth: number) => {
    if (cardToDepth.has(cardId) && cardToDepth.get(cardId)! <= depth) return;
    const card = cardMap.get(cardId);
    if (!card) return;
    if (!layers[depth]) layers[depth] = [];
    if (!layers[depth].some(c => c.id === cardId)) {
      layers[depth].push(card);
    }
    cardToDepth.set(cardId, depth);
    card.children.forEach(childId => buildLayers(childId, depth + 1));
  };

  const rootCards = cards.filter(card => !card.parentId);
  rootCards.forEach(card => buildLayers(card.id, 0));
  cards.forEach(card => {
    if (!cardToDepth.has(card.id)) {
      let root = card;
      while (root.parentId && cardMap.has(root.parentId)) {
        root = cardMap.get(root.parentId)!;
      }
      buildLayers(root.id, 0);
    }
  });

  const positions = new Map<string, { x: number; y: number }>();

  if (layoutMode === 'horizontal') {
    const layerWidth = 100;
    const verticalPadding = 20;
    const verticalSpacing = 40;

    let maxLayerContentHeight = 0;
    layers.forEach(layer => {
      if (layer.length > 1) {
        maxLayerContentHeight = Math.max(maxLayerContentHeight, (layer.length - 1) * verticalSpacing);
      }
    });

    const svgHeight = Math.max(containerHeight > 0 ? containerHeight : 100, maxLayerContentHeight + verticalPadding * 2);
    const horizontalPadding = containerWidth;
    const contentWidth = layers.length > 0 ? (layers.length - 1) * layerWidth : 0;
    const svgWidth = contentWidth + horizontalPadding * 2;

    layers.forEach((layer, depth) => {
      const x = horizontalPadding + depth * layerWidth;
      const layerContentHeight = (layer.length - 1) * verticalSpacing;
      const startY = (svgHeight - layerContentHeight) / 2;
      layer.forEach((card, index) => {
        positions.set(card.id, { x, y: startY + index * verticalSpacing });
      });
    });
    return { positions, svgHeight, svgWidth, layerHeight: verticalSpacing, layerWidth };
  }

  // Vertical layout (original logic)
  const layerHeight = 80;
  const horizontalPadding = 40;
  const nodesForSpacingCalculation = 7;
  const effectiveContainerWidth = containerWidth > 0 ? containerWidth : 300;
  const horizontalSpacing = (effectiveContainerWidth - horizontalPadding * 2) / (nodesForSpacingCalculation - 1);

  let maxLayerContentWidth = 0;
  layers.forEach(layer => {
    if (layer.length > 1) {
      maxLayerContentWidth = Math.max(maxLayerContentWidth, (layer.length - 1) * horizontalSpacing);
    }
  });

  const svgWidth = Math.max(effectiveContainerWidth, maxLayerContentWidth + horizontalPadding * 2);
  const verticalPadding = containerHeight;
  const contentHeight = layers.length > 0 ? (layers.length - 1) * layerHeight : 0;
  const svgHeight = contentHeight + verticalPadding * 2;

  layers.forEach((layer, depth) => {
    const y = svgHeight - (depth * layerHeight + verticalPadding);
    const layerContentWidth = (layer.length - 1) * horizontalSpacing;
    const startX = (svgWidth - layerContentWidth) / 2;
    layer.forEach((card, index) => {
      positions.set(card.id, { x: startX + index * horizontalSpacing, y });
    });
  });
  return { positions, svgHeight, svgWidth, layerHeight, layerWidth: horizontalSpacing };
};

export const TreeNavigation: React.FC<TreeNavigationProps> = ({ layoutMode = 'vertical' }) => {
  const { setCurrentCard } = useCardStore()
  const { projects, activeProjectId } = useProjectStore();
  
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;

  const [hoveredCard, setHoveredCard] = useState<CardData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const isAutoScrolling = useRef(false)
  const [containerHeight, setContainerHeight] = useState(800)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        setContainerHeight(container.clientHeight);
        setContainerWidth(container.clientWidth);
      });
      resizeObserver.observe(container);
      // Initial set
      setContainerHeight(container.clientHeight);
      setContainerWidth(container.clientWidth);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const { positions, svgHeight, svgWidth, layerHeight, layerWidth } = useMemo(() => calculateTreeLayout(cards, containerHeight, containerWidth, layoutMode), [cards, containerHeight, containerWidth, layoutMode]);

  const radius = 14

  const autoCenterView = useCallback(() => {
    if (currentCardId && positions.has(currentCardId) && containerRef.current) {
      isAutoScrolling.current = true
      const currentPos = positions.get(currentCardId)!
      
      if (layoutMode === 'horizontal') {
        const realContainerWidth = containerRef.current.clientWidth;
        const targetScroll = currentPos.x - realContainerWidth / 2;
        containerRef.current.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
      } else {
        const realContainerHeight = containerRef.current.clientHeight;
        const targetScroll = currentPos.y - realContainerHeight / 2;
        containerRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
      
      setTimeout(() => { isAutoScrolling.current = false }, 500)
    }
  }, [currentCardId, positions, layoutMode])

  useEffect(() => {
    autoCenterView()
  }, [currentCardId, autoCenterView])

  const handleScroll = () => {
    if (isAutoScrolling.current) return
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(autoCenterView, 3000)
  }

  const handleCardClick = (cardId: string) => setCurrentCard(cardId)
  const handleCardHover = (show: boolean, card: CardData) => setHoveredCard(show ? card : null)

  const maskStyle = layoutMode === 'horizontal'
    ? { background: 'linear-gradient(90deg, #101010 0%, rgba(16, 16, 16, 0.7) 15%, rgba(16, 16, 16, 0.25) 30%, rgba(16, 16, 16, 0) 50%, rgba(16, 16, 16, 0.25) 70%, rgba(16, 16, 16, 0.7) 85%, #101010 100%)' }
    : { background: 'linear-gradient(180deg, #101010 0%, rgba(16, 16, 16, 0.7) 30%, rgba(16, 16, 16, 0.25) 40%, rgba(16, 16, 16, 0) 50%, rgba(16, 16, 16, 0.25) 60%, rgba(16, 16, 16, 0.7) 70%, #101010 100%)' };

  return (
    <div className="h-full relative bg-transparent z-10 min-w-0 overflow-hidden">
      <div 
        ref={containerRef}
        className="h-full w-full overflow-auto"
        onScroll={handleScroll}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          className="relative z-10" 
        >
          {cards.map(parent => {
            if (!parent.children || parent.children.length === 0) return null
            const parentPos = positions.get(parent.id)
            if (!parentPos) return null

            return (
              <g key={`group-lines-from-${parent.id}`}>
                {parent.children.map(childId => {
                  const childPos = positions.get(childId)
                  if (!childPos) return null

                  const d = layoutMode === 'horizontal'
                    ? `M ${parentPos.x + radius} ${parentPos.y} C ${parentPos.x + layerWidth! / 2} ${parentPos.y} ${childPos.x - layerWidth! / 2} ${childPos.y} ${childPos.x - radius} ${childPos.y}`
                    : `M ${parentPos.x} ${parentPos.y - radius} C ${parentPos.x} ${parentPos.y - layerHeight / 2} ${childPos.x} ${childPos.y + layerHeight / 2} ${childPos.x} ${childPos.y + radius}`;
                  
                  return (
                    <path 
                      key={`line-${parent.id}-${childId}`}
                      d={d}
                      fill="none"
                      stroke="rgba(217, 217, 217, 0.6)" 
                      strokeWidth="1.5"
                    />
                  )
                })}
              </g>
            )
          })}

          {cards.map(card => {
            const pos = positions.get(card.id)
            if (!pos) return null
            return <TreeNode key={card.id} card={card} x={pos.x} y={pos.y} onClick={() => handleCardClick(card.id)} isCurrent={card.id === currentCardId} isActive={hoveredCard?.id === card.id} onHover={handleCardHover} />
          })}
        </svg>
      </div>

      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="h-full" style={maskStyle} />
      </div>

      {hoveredCard && (
        <div className="absolute bottom-2 left-2 right-2 bg-[#4C4C4C] rounded-md p-2 text-white text-xs z-30">
          <div className="font-medium mb-0.5">{hoveredCard.title || '无标题卡片'}</div>
          <div className="text-[#CCC] text-[10px]">{hoveredCard.messages.length} 条消息</div>
        </div>
      )}
    </div>
  )
}