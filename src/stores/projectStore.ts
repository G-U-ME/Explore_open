import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CardData } from './cardStore';

export interface Project {
  id: string;
  name: string;
  cards: CardData[];
  currentCardId: string | null;
  createdAt: number;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (name: string) => Project;
  deleteProject: (projectId: string) => void;
  setActiveProject: (projectId: string | null) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  getProject: (projectId: string) => Project | undefined;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      
      createProject: (name) => {
        const newProject: Project = {
          id: `project_${Date.now()}`,
          name,
          cards: [],
          currentCardId: null,
          createdAt: Date.now(),
        };
        set((state) => ({
          projects: [...state.projects, newProject],
        }));
        return newProject;
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        }));
      },

      setActiveProject: (projectId) => {
        const { projects } = get();
        const projectExists = projects.some(p => p.id === projectId);
        if (projectExists || projectId === null) {
            set({ activeProjectId: projectId });
        } else {
            console.warn(`Project with id "${projectId}" not found.`);
        }
      },

      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        }));
      },

      getProject: (projectId) => {
        return get().projects.find(p => p.id === projectId);
      }
    }),
    {
      name: 'explore-projects-storage',
    }
  )
); 