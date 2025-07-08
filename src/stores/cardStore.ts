import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useProjectStore } from './projectStore';
import { useSettingsStore } from './settingsStore';

export type MessageRole = 'user' | 'ai'

export interface CardMessage {
  id: string
  role: MessageRole
  content: string
  files?: string[]
  context?: string
  timestamp?: number
}

export interface CardData {
  id: string
  title: string
  messages: CardMessage[]
  position: [number, number, number]
  brightness: number
  parentId?: string
  children: string[]
  depth: number
}

// A helper function to get the active project's data from the project store
const getActiveProjectData = () => {
  const { activeProjectId, projects } = useProjectStore.getState();
  if (!activeProjectId) return { activeProject: null, cards: [], currentCardId: null };
  const activeProject = projects.find(p => p.id === activeProjectId);
  return { 
    activeProject, 
    cards: activeProject?.cards || [], 
    currentCardId: activeProject?.currentCardId || null 
  };
};

// A helper function to update the active project
const updateActiveProject = (updates: Partial<import('./projectStore').Project>) => {
  const { activeProjectId } = useProjectStore.getState();
  if (activeProjectId) {
    useProjectStore.getState().updateProject(activeProjectId, updates);
  }
};


interface CardState {
  // cards and currentCardId are now derived from projectStore
  selectedContent: string | null;
  isTyping: boolean;

  // Actions now operate on the active project's data
  addCard: (messages?: CardMessage[], parentId?: string) => void;
  appendMessage: (cardId: string, message: CardMessage) => void;
  updateMessage: (cardId: string, messageId: string, updates: Partial<CardMessage>) => void;
  updateCard: (id: string, updates: Partial<CardData>) => void;
  deleteCardAndDescendants: (id: string) => void;
  setCurrentCard: (id: string | null) => void;
  setSelectedContent: (content: string | null) => void;
  setIsTyping: (typing: boolean) => void;
  generateTitle: (id: string) => Promise<void>;
  getCardPath: (id: string) => CardData[];
  createCardFromSelection: (selectedText: string, parentId?: string) => void;
}

// 辅助函数 (无变化)
function getDescendantIds(cards: CardData[], id: string): string[] {
  const descendants: string[] = []
  function dfs(cardId: string) {
    cards.filter(c => c.parentId === cardId).forEach(child => {
      descendants.push(child.id)
      dfs(child.id)
    })
  }
  dfs(id)
  return descendants
}

function deduplicateMessages(messages: CardMessage[]): CardMessage[] {
  const seen = new Set<string>();
  return messages.filter(message => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

function deduplicateCards(cards: CardData[]): CardData[] {
  const seen = new Set<string>();
  return cards.map(card => ({
    ...card,
    position: [0, 100, 0] as [number, number, number],
    messages: deduplicateMessages(card.messages),
    children: card.children || []
  })).filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}


// 从环境变量获取API URL
const SILICONFLOW_API_URL = import.meta.env.VITE_SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';

/**
 * 根据消息记录调用AI API生成标题。
 * @param messages 卡片中的消息数组
 * @param apiKey 从Store中获取的API Key
 * @returns AI生成的标题或备用标题
 */
async function generateTitleFromMessages(messages: CardMessage[], apiKey: string | null): Promise<string> {
  if (messages.length === 0) return '新卡片';

  // 构建prompt
  const recentMessages = messages.slice(-10);
  const conversationContent = recentMessages
    .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
    .join('\n');
  const prompt = `请用一个名词短语精简概括以下对话的主题，并且最终只输出名词短语：\n\n${conversationContent}`;

  // 检查传入的apiKey
  if (!apiKey) {
    console.warn('用于生成标题的API Key未配置，将使用备用方案。');
    const fallbackContent = messages.slice(-1)[0]?.content || '新卡片';
    return fallbackContent.substring(0, 15);
  }

  try {
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // 使用传入的apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
        stream: false,
        messages: [{ role: 'user', content: prompt }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();

    if (title) {
      return title.replace(/^"|"$/g, '').replace(/^标题：/, '').trim();
    } else {
      throw new Error('从API响应中无法解析出标题。');
    }

  } catch (error) {
    console.error('调用AI生成标题失败:', error);
    const fallbackContent = messages.slice(-1)[0]?.content || '新卡片';
    return fallbackContent.substring(0, 15);
  }
}

const useCardStore = create<CardState>()(
  devtools( // Removed persist from here, as projectStore handles persistence
    (set, get) => ({
      // cards and currentCardId are removed from the initial state
      selectedContent: null,
      isTyping: false,

      addCard: (messages = [], parentId) => {
        const { cards } = getActiveProjectData();
        const parentDepth = parentId ? (cards.find(c => c.id === parentId)?.depth || 0) : -1;

        const newCard: CardData = {
          id: `card_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          title: '新卡片',
          messages,
          position: [0, 100, 0],
          brightness: 1.0,
          parentId,
          children: [],
          depth: parentDepth + 1
        }
        
        let newCards = deduplicateCards([...cards, newCard]);

        if (parentId) {
          newCards = newCards.map(card =>
            card.id === parentId
              ? { ...card, children: [...(card.children || []), newCard.id] }
              : card
          );
        }

        updateActiveProject({ cards: newCards, currentCardId: newCard.id });
      },

      appendMessage: (cardId, message) => {
        const { cards } = getActiveProjectData();
        const newCards = deduplicateCards(cards.map(card => {
          if (card.id !== cardId) return card;
          
          const existingMessage = card.messages.find(m => m.id === message.id);
          if (existingMessage) {
            return card; 
          }
          
          return { ...card, messages: deduplicateMessages([...card.messages, message]) };
        }));
        updateActiveProject({ cards: newCards });
      },
      
      updateMessage: (cardId, messageId, updates) => {
        const { cards } = getActiveProjectData();
        const newCards = cards.map((card) => {
          if (card.id !== cardId) {
            return card;
          }
          const updatedMessages = card.messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
          return { ...card, messages: updatedMessages };
        });
        updateActiveProject({ cards: newCards });
      },

      updateCard: (id, updates) => {
        const { cards } = getActiveProjectData();
        const newCards = cards.map(card =>
          card.id === id ? { ...card, ...updates } : card
        );
        updateActiveProject({ cards: newCards });
      },

      deleteCardAndDescendants: (id) => {
        const { cards, currentCardId } = getActiveProjectData();
        const idsToDelete = [id, ...getDescendantIds(cards, id)];
        const parentOfDeleted = cards.find(c => c.id === id)?.parentId;
        const newCurrentId = idsToDelete.includes(currentCardId!) 
          ? parentOfDeleted || null 
          : currentCardId;

        const updatedCards = cards
          .filter(card => !idsToDelete.includes(card.id))
          .map(card => {
            if (card.id === parentOfDeleted) {
              return {
                ...card,
                children: card.children.filter(childId => childId !== id)
              }
            }
            return card;
          });
          
        updateActiveProject({ cards: updatedCards, currentCardId: newCurrentId });
      },

      setCurrentCard: (id) => {
        updateActiveProject({ currentCardId: id });
      },

      setSelectedContent: (content) => set({ selectedContent: content }),

      setIsTyping: (typing) => set({ isTyping: typing }),

      generateTitle: async (id) => {
        const { cards } = getActiveProjectData();
        const card = cards.find(c => c.id === id)
        if (!card) return;

        // Get the latest API key directly from settingsStore
        const { apiKey } = useSettingsStore.getState();
        const title = await generateTitleFromMessages(card.messages, apiKey);
        get().updateCard(id, { title });
      },

      getCardPath: (id) => {
        const { cards } = getActiveProjectData();
        const path: CardData[] = []
        let currentCard = cards.find(c => c.id === id)
        while (currentCard) {
          path.unshift(currentCard)
          currentCard = cards.find(c => c.id === currentCard!.parentId)
        }
        return path
      },

      createCardFromSelection: (selectedText, parentId) => {
        const { currentCardId } = getActiveProjectData();
        const effectiveParentId = parentId || currentCardId;
        if (!effectiveParentId) return;

        get().addCard(
          [{ id: `msg_${Date.now()}`, role: 'user', content: selectedText }],
          effectiveParentId
        );
      }
    }),
    {
      name: 'explore-card-storage',
      // The old storage key. We can remove the whole persist middleware now.
    }
  )
);

export default useCardStore;