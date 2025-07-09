import { create } from 'zustand';

export interface SettingsState {
  isSettingsModalOpen: boolean;
  apiUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string; // <-- 新增：当前激活的模型
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setApiUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
  setActiveModel: (model: string) => void; // <-- 新增：设置激活模型的 action
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initialModels = ['deepseek-ai/DeepSeek-R1-0528-Qwen3-8B'];
  
  return {
    isSettingsModalOpen: false,
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    models: initialModels,
    activeModel: initialModels[0] || '', // <-- 初始化 activeModel
    openSettingsModal: () => set({ isSettingsModalOpen: true }),
    closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    setApiUrl: (url) => set({ apiUrl: url }),
    setApiKey: (key) => set({ apiKey: key }),
    // 当模型列表更新时，确保 activeModel 仍然有效，如果无效则重置为第一个
    setModels: (models) => set((state) => {
      const newActiveModel = models.includes(state.activeModel) ? state.activeModel : (models[0] || '');
      return { models, activeModel: newActiveModel };
    }),
    setActiveModel: (model) => set({ activeModel: model }), // <-- 实现 action
  };
});