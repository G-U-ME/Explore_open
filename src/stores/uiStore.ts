import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  isLeftPanelCollapsed: boolean;
  toggleLeftPanel: () => void;
}

/**
 * Manages global UI state, like panel visibility.
 */
export const useUIStore = create<UIState>()(
  // Persist state to localStorage to remember user's choice across sessions
  persist(
    (set) => ({
      isLeftPanelCollapsed: false,
      toggleLeftPanel: () => set((state) => ({ isLeftPanelCollapsed: !state.isLeftPanelCollapsed })),
    }),
    {
      name: 'ui-state-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);