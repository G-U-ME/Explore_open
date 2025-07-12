import { create } from 'zustand';

export interface SettingsState {
  isSettingsModalOpen: boolean;
  apiUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
  // 【新增】系统提示词
  globalSystemPrompt: string;
  dialogueSystemPrompt: string;
  titleSystemPrompt: string;

  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setApiUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
  setActiveModel: (model: string) => void;
  // 【新增】修改系统提示词的 action
  setGlobalSystemPrompt: (prompt: string) => void;
  setDialogueSystemPrompt: (prompt: string) => void;
  setTitleSystemPrompt: (prompt: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initialModels = ['deepseek-v3-0324', 'deepseek-r1-0528'];
  
  return {
    isSettingsModalOpen: false,
    apiUrl: 'https://api.lkeap.cloud.tencent.com/v1/chat/completions',
    apiKey: '',
    models: initialModels,
    activeModel: initialModels[0] || '',
    // 【新增】初始化系统提示词
    globalSystemPrompt: '请用用户指定的语言或者用户当前使用的语言进行回答。',
    dialogueSystemPrompt: '请在回答中用@@框出所有概念性名词，例如@@xxx@@。',
    titleSystemPrompt: '请用一个名词短语精简概括对话的主题，并且最终只输出名词短语。',
    
    openSettingsModal: () => set({ isSettingsModalOpen: true }),
    closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    setApiUrl: (url) => set({ apiUrl: url }),
    setApiKey: (key) => set({ apiKey: key }),
    setModels: (models) => set((state) => {
      const newActiveModel = models.includes(state.activeModel) ? state.activeModel : (models[0] || '');
      return { models, activeModel: newActiveModel };
    }),
    setActiveModel: (model) => set({ activeModel: model }),
    // 【新增】实现 action
    setGlobalSystemPrompt: (prompt) => set({ globalSystemPrompt: prompt }),
    setDialogueSystemPrompt: (prompt) => set({ dialogueSystemPrompt: prompt }),
    setTitleSystemPrompt: (prompt) => set({ titleSystemPrompt: prompt }),
  };
});