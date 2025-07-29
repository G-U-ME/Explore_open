// App.tsx (Optimized Version)
import { Component, ErrorInfo, ReactNode, useRef, useEffect, useState } from 'react'
import { ProjectPanel } from './components/ProjectPanel'
import { CardStack } from './components/CardStack'
import { TreeNavigation } from './components/TreeNavigation'
import { InputArea } from './components/InputArea'
import SettingsModal from './components/SettingsModal'
import { useProjectStore } from './stores/projectStore'
import { CardData } from './stores/cardStore'
import { useUIStore } from './stores/uiStore'

const useInputAreaHeight = () => {
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputAreaHeight, setInputAreaHeight] = useState(120); 

  useEffect(() => {
    const element = inputAreaRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(() => {
      setInputAreaHeight(element.offsetHeight);
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return { inputAreaHeight, inputAreaRef };
};

const RIGHT_PANEL_WIDTH_DESKTOP = 300;
const MOBILE_BREAKPOINT = 600;
const MOBILE_PANEL_WIDTH = 300; 

// ... (ErrorBoundary code is correct and remains unchanged) ...
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React错误边界捕获到错误:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#101010] text-white">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">应用出现错误</h1>
            <p className="text-gray-400 mb-4">请刷新页面重试</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#13E425] text-black rounded-lg font-medium"
            >
              刷新页面
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-gray-400">错误详情</summary>
                <pre className="mt-2 p-4 bg-gray-800 rounded text-sm overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}


function App() {
  const { inputAreaHeight, inputAreaRef } = useInputAreaHeight();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  
  const { projects, activeProjectId, setActiveProject, createProject, updateProject } = useProjectStore();
  const { isLeftPanelCollapsed, toggleLeftPanel } = useUIStore();

  const isMobile = windowWidth < MOBILE_BREAKPOINT;

  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState(isLeftPanelCollapsed ? -MOBILE_PANEL_WIDTH : 0);
  const dragStartX = useRef(0);
  const panelInitialPosition = useRef(0);

  // --- CHANGE: Handler to close panel on outside click ---
  const handleOutsidePanelClick = () => {
    // Only applies to mobile when the panel is open
    if (isMobile && !isLeftPanelCollapsed) {
      toggleLeftPanel();
    }
  };

  useEffect(() => {
    if (isMobile && !isLeftPanelCollapsed) {
      toggleLeftPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]); 
  
  useEffect(() => {
    if (isMobile) {
      const targetPosition = isLeftPanelCollapsed ? -MOBILE_PANEL_WIDTH : 0;
      setPanelPosition(targetPosition);
    }
  }, [isLeftPanelCollapsed, isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const target = e.target as HTMLElement;

    // Prevent panel drag on specific elements
    if (target.closest('[data-dnd-item="true"]')) {
      return;
    }
    if (isLeftPanelCollapsed && target.closest('[data-no-panel-drag="true"]')) {
      return;
    }

    dragStartX.current = e.touches[0].clientX;
    panelInitialPosition.current = panelPosition;
    setIsDragging(false); // Reset dragging state
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || dragStartX.current === 0) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - dragStartX.current;
    
    // Only set isDragging to true after a certain threshold to avoid accidental drags
    if (!isDragging && Math.abs(deltaX) > 10) {
        setIsDragging(true);
    }
    
    // If we are not dragging, don't update position
    if (!isDragging) return;

    let newPos = panelInitialPosition.current + deltaX;
    newPos = Math.max(-MOBILE_PANEL_WIDTH, Math.min(newPos, 0));
    setPanelPosition(newPos);
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    
    // Only snap if we were actually dragging
    if (isDragging) {
        const SNAP_THRESHOLD = 80;
        const currentPosition = panelPosition;

        if (isLeftPanelCollapsed) {
            if (currentPosition - (-MOBILE_PANEL_WIDTH) > SNAP_THRESHOLD) {
                toggleLeftPanel(); // Snap open
            } else {
                setPanelPosition(-MOBILE_PANEL_WIDTH); // Snap back closed
            }
        } else {
            if (Math.abs(currentPosition) > SNAP_THRESHOLD) {
                toggleLeftPanel(); // Snap closed
            } else {
                setPanelPosition(0); // Snap back open
            }
        }
    }

    setIsDragging(false);
    dragStartX.current = 0;
  };
  
  // (Data migration and other effects remain unchanged)
  useEffect(() => {
    const oldDataRaw = localStorage.getItem('ai-card-tree-storage');
    if (oldDataRaw) {
      try {
        const oldData = JSON.parse(oldDataRaw);
        if (oldData.state && oldData.state.cards && oldData.state.cards.length > 0) {
          const newProject = createProject('Imported Project');
          updateProject(newProject.id, {
            cards: oldData.state.cards as CardData[],
            currentCardId: oldData.state.currentCardId || null
          });
          setActiveProject(newProject.id);
        }
      } catch (e) {
        console.error("Failed to parse or migrate old data:", e);
      } finally {
        localStorage.removeItem('ai-card-tree-storage');
      }
    }
  }, [createProject, updateProject, setActiveProject]);
  
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      const sortedProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt);
      setActiveProject(sortedProjects[0].id);
    }
  }, [activeProjectId, projects, setActiveProject]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const COLLAPSED_WIDTH = 56;
  const expandedWidth = windowWidth < 1080 ? 200 : 300;
  const leftPanelWidth = isLeftPanelCollapsed ? COLLAPSED_WIDTH : expandedWidth;
  const topNavHeightMobile = isMobile ? inputAreaHeight : 0;
  const centerAreaWidth = isMobile ? windowWidth : windowWidth - leftPanelWidth - RIGHT_PANEL_WIDTH_DESKTOP;
  const availableHeight = windowHeight - topNavHeightMobile - inputAreaHeight;
  const cardStackContainerTop = topNavHeightMobile;
  const cardCenterY = availableHeight / 2;
  const activeProject = projects.find(p => p.id === activeProjectId);

  const transitionClasses = !isDragging ? 'transition-all duration-300 ease-in-out' : '';

  return (
    <ErrorBoundary>
      <SettingsModal />
      <div 
        className="h-screen w-screen bg-[#101010] text-white font-inter relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleOutsidePanelClick} // --- CHANGE: Added onClick to the main container ---
      >
        
        {isMobile && activeProjectId && (
          <div
            data-no-panel-drag="true"
            className="absolute top-0 z-10 pointer-events-none"
            style={{
              left: '0px',
              right: '0px',
              height: `${topNavHeightMobile}px`,
            }}
          >
            <div className="w-full h-full pointer-events-auto">
              <TreeNavigation key={`tree-mobile-${activeProjectId}`} layoutMode="horizontal" />
            </div>
          </div>
        )}

        {/* Card Stack Area */}
        <div
          className={`absolute z-0 ${transitionClasses}`}
          style={{
            top: `${cardStackContainerTop}px`,
            bottom: `${inputAreaHeight}px`,
            left: isMobile ? '0px' : `${leftPanelWidth}px`,
            right: isMobile ? '0px' : `${RIGHT_PANEL_WIDTH_DESKTOP}px`,
          }}
        >
          {activeProjectId && activeProject ? (
            <CardStack
              key={activeProjectId}
              centerY={cardCenterY}
              availableHeight={availableHeight}
              centerAreaWidth={centerAreaWidth}
              isMobile={isMobile}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <h2 className="text-2xl font-bold">Welcome to Explore</h2>
                <p className="mt-2">Select a project on the left, or create a new one to begin.</p>
              </div>
            </div>
          )}
        </div>

        {/* Left Panel Container */}
        <div
          className={`absolute top-0 left-0 h-full ${transitionClasses}`}
          style={{
            width: isMobile ? `${MOBILE_PANEL_WIDTH}px` : `${leftPanelWidth}px`,
            transform: isMobile ? `translateX(${panelPosition}px)` : 'none',
            zIndex: 40,
          }}
          onClick={(e) => e.stopPropagation()} // --- CHANGE: Stop clicks inside the panel from closing it ---
        >
          <div className={`w-full h-full pointer-events-auto ${isMobile ? 'bg-black/80' : 'bg-transparent'}`}>
            <ProjectPanel isMobile={isMobile} />
          </div>
        </div>

        {/* Right Panel Container (Desktop Only) */}
        {!isMobile && (
          <div
            className="absolute top-0 right-0 h-full z-10 pointer-events-none"
            style={{ width: `${RIGHT_PANEL_WIDTH_DESKTOP}px` }}
          >
            <div className="w-full h-full pointer-events-auto">
              {activeProjectId && <TreeNavigation key={`tree-desktop-${activeProjectId}`} layoutMode="vertical" />}
            </div>
          </div>
        )}

        {/* InputArea Container */}
        <div
          ref={inputAreaRef}
          className={`absolute bottom-0 z-10 ${transitionClasses}`}
          style={{
            left: isMobile ? '0px' : `${leftPanelWidth}px`,
            right: isMobile ? '0px' : `${RIGHT_PANEL_WIDTH_DESKTOP}px`,
          }}
        >
          {activeProjectId && <InputArea key={`input-${activeProjectId}`} />}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App;