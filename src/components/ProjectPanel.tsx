import React, { useState } from 'react';
import { Plus, Settings, X } from 'lucide-react';
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
          ? 'bg-[#4A4A4A]'
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

export const ProjectPanel: React.FC = () => {
  const { 
    projects, 
    activeProjectId, 
    createProject, 
    deleteProject, 
    setActiveProject,
    updateProject 
  } = useProjectStore();

  const { openSettingsModal } = useSettingsStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      // This feels a bit hacky, but it's the simplest way to update the whole array
      // in the store without adding a specific action for it.
      useProjectStore.setState({ projects: reorderedProjects });
    }
  };

  return (
    // 修改：添加 bg-transparent 强制背景透明
    <div className="h-full flex flex-col bg-transparent text-white relative z-10">
      {/* 上部分 - 项目管理区域 */}
      <div className="flex-1 flex flex-col py-6 px-4">
        {/* 新建项目按钮 (左对齐, 顶对齐) */}
        <button
          onClick={() => setShowNewProject(true)}
          className="p-2.5 mb-6 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors self-start"
        >
          <Plus size={24} />
        </button>

        {/* 项目列表容器 (保持居中) */}
        <div className="w-full max-w-xs space-y-2 self-center">
          {/* 新建项目输入区域 */}
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

          {/* 项目列表 */}
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
      </div>

      {/* 下部分 - 设置区域 (边框已移除) */}
      <div className="p-4 relative z-10">
        <div className="flex items-center justify-between">
          {/* 用户设置按钮 */}
          <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#333] transition-colors">
            <div className="w-7 h-7 rounded-full border-2 border-white" />
            <span className="text-base font-normal text-white">Account</span>
          </button>

          {/* APP设置按钮 */}
          <button className="p-2 rounded-lg hover:bg-[#333] transition-colors" onClick={openSettingsModal}>
            <Settings size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}