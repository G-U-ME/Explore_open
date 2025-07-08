// App.tsx
import { Component, ErrorInfo, ReactNode, useRef, useEffect, useState } from 'react'
import { ProjectPanel } from './components/ProjectPanel'
import { CardStack } from './components/CardStack'
import { TreeNavigation } from './components/TreeNavigation'
import { InputArea } from './components/InputArea'
import SettingsModal from './components/SettingsModal'
import { useProjectStore } from './stores/projectStore'
import { CardData } from './stores/cardStore'

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

const LEFT_PANEL_WIDTH = 280;
const RIGHT_PANEL_WIDTH = 300;

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
  
  const { projects, activeProjectId, setActiveProject, createProject, updateProject } = useProjectStore();

  useEffect(() => {
    // One-time data migration from old format
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
    // If no project is active, activate the most recent one.
    if (!activeProjectId && projects.length > 0) {
      const sortedProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt);
      setActiveProject(sortedProjects[0].id);
    }
  }, [activeProjectId, projects, setActiveProject]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const screenHeight = window.innerHeight;
  const availableHeight = screenHeight - inputAreaHeight;
  const cardCenterY = availableHeight / 2;
  const centerAreaWidth = windowWidth - LEFT_PANEL_WIDTH - RIGHT_PANEL_WIDTH;
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <ErrorBoundary>
      <SettingsModal />
      <div className="h-screen w-screen bg-[#101010] text-white font-inter relative overflow-hidden">
        <div
          className="absolute top-0 bottom-0 z-0"
          style={{
            left: `${LEFT_PANEL_WIDTH}px`,
            right: `${RIGHT_PANEL_WIDTH}px`,
          }}
        >
          {activeProjectId && activeProject ? (
            <CardStack
              key={activeProjectId} // Ensure re-render on project switch
              centerY={cardCenterY}
              availableHeight={availableHeight}
              centerAreaWidth={centerAreaWidth}
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

        {/* Left Panel Container: REMOVED border-r */}
        <div
          className="absolute top-0 left-0 h-full z-10 pointer-events-none"
          style={{ width: `${LEFT_PANEL_WIDTH}px` }}
        >
          <div className="w-full h-full pointer-events-auto">
            <ProjectPanel />
          </div>
        </div>

        {/* Right Panel Container: REMOVED border-l */}
        <div
          className="absolute top-0 right-0 h-full z-10 pointer-events-none"
          style={{ width: `${RIGHT_PANEL_WIDTH}px` }}
        >
          <div className="w-full h-full pointer-events-auto">
            {activeProjectId && <TreeNavigation key={`tree-${activeProjectId}`} />}
          </div>
        </div>

        <div
          ref={inputAreaRef}
          className="absolute bottom-0 z-10"
          style={{
            left: `${LEFT_PANEL_WIDTH}px`,
            right: `${RIGHT_PANEL_WIDTH}px`,
          }}
        >
          {activeProjectId && <InputArea key={`input-${activeProjectId}`} />}
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App;