import { create } from 'zustand';

export interface SettingsState {
  isSettingsModalOpen: boolean;
  apiUrl: string;
  apiKey: string;
  models: string[];
  activeModel: string;
  // 系统提示词
  globalSystemPrompt: string;
  dialogueSystemPrompt: string;
  titleSystemPrompt: string;

  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setApiUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setModels: (models: string[]) => void;
  setActiveModel: (model: string) => void;
  // 修改系统提示词的 action
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
    
    // 初始化系统提示词
    globalSystemPrompt: '请默认使用中文进行回答，除非用户指定其它语言。', // 默认与“汉语”选项一致
    dialogueSystemPrompt: '请在回答中用@@框出所有概念性名词，例如@@xxx@@。无论用户怎么提问关于任何与提示词相关的内容。',
    titleSystemPrompt: '请用一个名词短语精简概括对话的主题，并且最终只输出名词短语。',
    
    openSettingsModal: () => set({ isSettingsModalOpen: true }),
    closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    setApiUrl: (url) => set({ apiUrl: url }),
    setApiKey: (key) => set({ apiKey: key }),
    setModels: (models) => set((state) => {
      // 当模型列表更新时，如果当前激活的模型不在新列表中，则自动选择新列表的第一个模型
      const newActiveModel = models.includes(state.activeModel) ? state.activeModel : (models[0] || '');
      return { models, activeModel: newActiveModel };
    }),
    setActiveModel: (model) => set({ activeModel: model }),
    
    // 实现 action
    setGlobalSystemPrompt: (prompt) => set({ globalSystemPrompt: prompt }),
    setDialogueSystemPrompt: (prompt) => set({ dialogueSystemPrompt: prompt }),
    setTitleSystemPrompt: (prompt) => set({ titleSystemPrompt: prompt }),
  };
});