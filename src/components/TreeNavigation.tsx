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

const calculateTreeLayout = (cards: CardData[], viewportHeight: number, containerWidth: number) => {
  const cardMap = new Map(cards.map(card => [card.id, card]))
  const layers: CardData[][] = []
  const cardToDepth = new Map<string, number>()
  
  const buildLayers = (cardId: string, depth: number) => {
    if (cardToDepth.has(cardId) && cardToDepth.get(cardId)! <= depth) return
    const card = cardMap.get(cardId)
    if (!card) return
    if (!layers[depth]) layers[depth] = []
    if (!layers[depth].some(c => c.id === cardId)) {
        layers[depth].push(card)
    }
    cardToDepth.set(cardId, depth)
    card.children.forEach(childId => buildLayers(childId, depth + 1))
  }
  
  const rootCards = cards.filter(card => !card.parentId)
  rootCards.forEach(card => buildLayers(card.id, 0))
  cards.forEach(card => {
    if (!cardToDepth.has(card.id)) {
      let root = card
      while(root.parentId && cardMap.has(root.parentId)) {
        root = cardMap.get(root.parentId)!
      }
      buildLayers(root.id, 0)
    }
  })
  
  const positions = new Map<string, { x: number, y: number }>()
  const layerHeight = 80
  const horizontalPadding = 40
  // As per requirement, max 7 nodes horizontally. This defines the base spacing unit.
  const nodesForSpacingCalculation = 7 
  
  const effectiveContainerWidth = containerWidth > 0 ? containerWidth : 300; 

  const horizontalSpacing = (effectiveContainerWidth - horizontalPadding * 2) / (nodesForSpacingCalculation - 1);

  let maxLayerContentWidth = 0
  layers.forEach(layer => {
    if (layer.length > 1) {
      const currentLayerWidth = (layer.length - 1) * horizontalSpacing;
      maxLayerContentWidth = Math.max(maxLayerContentWidth, currentLayerWidth);
    }
  });

  const svgWidth = Math.max(effectiveContainerWidth, maxLayerContentWidth + (horizontalPadding * 2))
  const verticalPadding = viewportHeight;
  const contentHeight = layers.length > 0 ? (layers.length - 1) * layerHeight : 0;
  const svgHeight = contentHeight + verticalPadding * 2;

  layers.forEach((layer, depth) => {
    const y = svgHeight - (depth * layerHeight + verticalPadding)
    if (layer.length === 0) return
    
    const layerContentWidth = (layer.length - 1) * horizontalSpacing;
    const startX = (svgWidth - layerContentWidth) / 2
    
    layer.forEach((card, index) => {
        const x = startX + index * horizontalSpacing
        positions.set(card.id, { x, y })
    })
  })
  
  return { positions, svgHeight, svgWidth, layerHeight }
}

export const TreeNavigation: React.FC = () => {
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
    if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  const { positions, svgHeight, svgWidth, layerHeight } = useMemo(() => calculateTreeLayout(cards, containerHeight, containerWidth), [cards, containerHeight, containerWidth]);

  const radius = 14

  const autoCenterView = useCallback(() => {
    if (currentCardId && positions.has(currentCardId) && containerRef.current) {
      isAutoScrolling.current = true
      const currentPos = positions.get(currentCardId)!
      const realContainerHeight = containerRef.current.clientHeight
      const targetScroll = currentPos.y - realContainerHeight / 2
      
      containerRef.current.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })
      
      setTimeout(() => {
        isAutoScrolling.current = false
      }, 500)
    }
  }, [currentCardId, positions])

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

  return (
    // 1. Outer container: Defines the viewport boundary and is the anchor for the mask.
    <div className="h-full relative bg-transparent z-10 min-w-0 overflow-hidden">
      
      {/* 2. Inner scroller: This div handles the actual scrolling. */}
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-auto" // Use h-full, not absolute
        onScroll={handleScroll}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          // The SVG is now a direct child of the scroller, no extra wrappers needed.
          // The z-index is lower than the mask's.
          className="relative z-10" 
        >
          {/* SVG content for lines */}
          {cards.map(parent => {
            if (!parent.children || parent.children.length === 0) return null
            const parentPos = positions.get(parent.id)
            if (!parentPos) return null

            return (
              <g key={`group-lines-from-${parent.id}`}>
                {parent.children.map(childId => {
                  const childPos = positions.get(childId)
                  if (!childPos) return null

                  const d = `M ${parentPos.x} ${parentPos.y - radius} C ${parentPos.x} ${parentPos.y - layerHeight / 2} ${childPos.x} ${childPos.y + layerHeight / 2} ${childPos.x} ${childPos.y + radius}`
                  
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

          {/* SVG content for nodes */}
          {cards.map(card => {
            const pos = positions.get(card.id)
            if (!pos) return null
            return <TreeNode key={card.id} card={card} x={pos.x} y={pos.y} onClick={() => handleCardClick(card.id)} isCurrent={card.id === currentCardId} isActive={hoveredCard?.id === card.id} onHover={handleCardHover} />
          })}
        </svg>
      </div>

      {/* 3. The mask: A sibling to the scroller, positioned absolutely over the outer container. */}
      <div 
        className="absolute inset-0 pointer-events-none z-20"
      >
        <div 
          className="h-full"
          style={{ background: 'linear-gradient(180deg, #101010 0%, rgba(16, 16, 16, 0.7) 30%, rgba(16, 16, 16, 0.25) 40%, rgba(16, 16, 16, 0) 50%, rgba(16, 16, 16, 0.25) 60%, rgba(16, 16, 16, 0.7) 70%, #101010 100%)' }}
        />
      </div>

      {/* The hover info box remains outside and on top, which is correct */}
      {hoveredCard && (
        <div className="absolute bottom-2 left-2 right-2 bg-[#4C4C4C] rounded-md p-2 text-white text-xs z-30">
          <div className="font-medium mb-0.5">{hoveredCard.title || '无标题卡片'}</div>
          <div className="text-[#CCC] text-[10px]">{hoveredCard.messages.length} 条消息</div>
        </div>
      )}
    </div>
  )
}