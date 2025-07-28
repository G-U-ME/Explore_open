import React, { useState } from 'react';
import { Plus, Settings, X, Sidebar } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore, Project } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';

const SortableProjectItem: React.FC<{
  project: Project;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRename: (project: Project) => void;
  renamingProjectId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  handleRenameProject: () => void;
}> = ({
  project,
  isActive,
  onSwitch,
  onDelete,
  onStartRename,
  renamingProjectId,
  renameValue,
  setRenameValue,
  handleRenameProject,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      key={project.id}
      onClick={() => onSwitch(project.id)}
      onContextMenu={e => {
        e.preventDefault();
        onStartRename(project);
      }}
      className={`group p-3 rounded-xl cursor-pointer transition-colors relative ${
        isActive
          ? 'bg-[#5A5A5A]'
          : 'bg-[#3A3A3A] hover:bg-[#4A4A4A]'
      }`}
    >
      <div className="flex items-center justify-center">
        {renamingProjectId === project.id ? (
          <input
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleRenameProject}
            onKeyPress={e => {
              if (e.key === 'Enter') handleRenameProject();
            }}
            className="w-full p-0 bg-transparent text-center text-white text-base font-normal border-b border-white focus:outline-none"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-base font-normal text-white">
            {project.name}
          </span>
        )}
      </div>
      <button
        onPointerDown={e => {
          e.stopPropagation();
          onDelete(project.id);
        }}
        className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-full text-white bg-transparent hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={16} color="#FFFFFF" />
      </button>
    </div>
  );
};


export const ProjectPanel: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const { 
    projects, 
    activeProjectId, 
    createProject, 
    deleteProject, 
    setActiveProject,
    updateProject 
  } = useProjectStore();

  const { openSettingsModal } = useSettingsStore();
  const { isLeftPanelCollapsed, toggleLeftPanel } = useUIStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // On mobile, content is always shown. On desktop, it depends on the collapsed state.
  const shouldShowContent = isMobile || !isLeftPanelCollapsed;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      const newProject = createProject(newProjectName);
      setActiveProject(newProject.id);
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const handleSwitchProject = (id: string) => {
    if (renamingProjectId) return;
    setActiveProject(id);
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
  };

  const handleStartRename = (project: Project) => {
    setRenamingProjectId(project.id);
    setRenameValue(project.name);
  };

  const handleRenameProject = () => {
    if (renamingProjectId && renameValue.trim()) {
      updateProject(renamingProjectId, { name: renameValue });
    }
    setRenamingProjectId(null);
    setRenameValue('');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex(item => item.id === active.id);
      const newIndex = projects.findIndex(item => item.id === over.id);
      const reorderedProjects = arrayMove(projects, oldIndex, newIndex);
      useProjectStore.setState({ projects: reorderedProjects });
    }
  };

  const handlePanelClick = () => {
    // On desktop, clicking the collapsed panel should expand it.
    if (!isMobile && isLeftPanelCollapsed) {
      toggleLeftPanel();
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLeftPanel();
  };

  return (
    <div 
      className={`h-full flex flex-col text-white relative z-10 overflow-hidden ${
        // Replicate old design: transparent on desktop. Mobile BG is handled by parent.
        !isMobile ? 'bg-transparent' : ''
      } ${(isLeftPanelCollapsed && !isMobile) ? 'cursor-pointer' : ''}`}
      onClick={handlePanelClick}
    >
      <div className={`flex-1 flex flex-col py-6 transition-all duration-300 ${(!isMobile && isLeftPanelCollapsed) ? 'px-3' : 'px-4'}`}>
        <div className={`flex items-center self-start ${(!isMobile && isLeftPanelCollapsed) ? 'mb-0' : 'mb-6'} ${shouldShowContent ? 'space-x-2' : ''}`}>
          <button
            onClick={handleToggleClick}
            className="p-2.5 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors flex-shrink-0"
          >
            <Sidebar size={24} />
          </button>
          {shouldShowContent && (
            <button
              onClick={() => setShowNewProject(true)}
              className="p-2.5 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors"
            >
              <Plus size={24} />
            </button>
          )}
        </div>

        {shouldShowContent && (
          <div className="w-full max-w-xs space-y-2 self-center">
            {showNewProject && (
              <div className="p-3 bg-[#4C4C4C] rounded-xl mb-4">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="Project Name"
                  className="w-full p-2 bg-[#333] rounded border border-[#555] text-white text-sm"
                  onKeyPress={e => e.key === 'Enter' && handleCreateProject()}
                  autoFocus
                />
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={handleCreateProject}
                    className="px-3 py-1 bg-white text-black rounded text-sm font-medium"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewProject(false)}
                    className="px-3 py-1 bg-[#666] text-white rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={projects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {projects.map(project => (
                    <SortableProjectItem
                      key={project.id}
                      project={project}
                      isActive={project.id === activeProjectId}
                      onSwitch={handleSwitchProject}
                      onDelete={handleDeleteProject}
                      onStartRename={handleStartRename}
                      renamingProjectId={renamingProjectId}
                      renameValue={renameValue}
                      setRenameValue={setRenameValue}
                      handleRenameProject={handleRenameProject}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            
            {projects.length === 0 && !showNewProject && (
              <div className="text-center text-gray-400 mt-8">
                <p>No projects yet.</p>
                <p>Click the '+' button to create one.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {shouldShowContent && (
        <div className="p-4 relative z-10">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#333] transition-colors">
              <div className="w-7 h-7 rounded-full border-2 border-white" />
              <span className="text-base font-normal text-white">Account</span>
            </button>

            <button className="p-2 rounded-lg hover:bg-[#333] transition-colors" onClick={openSettingsModal}>
              <Settings size={24} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}