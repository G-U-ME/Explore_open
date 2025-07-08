import { create } from 'zustand';

export interface SettingsState {
  isSettingsModalOpen: boolean;
  apiUrl: string;
  apiKey: string;
  models: string[];
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setApiUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isSettingsModalOpen: false,
  apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  apiKey: '',
  models: ['deepseek-ai/DeepSeek-R1-0528-Qwen3-8B'],
  openSettingsModal: () => set({ isSettingsModalOpen: true }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),
  setApiUrl: (url) => set({ apiUrl: url }),
  setApiKey: (key) => set({ apiKey: key }),
  setModels: (models) => set({ models: models }),
})); 