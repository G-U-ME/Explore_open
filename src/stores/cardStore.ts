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
  tool_calls?: any[];
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

/**
 * 【修改】根据消息记录调用AI API生成标题。
 * 此函数现在直接从 settingsStore 获取配置，并使用独立的系统提示词。
 * @param messages 卡片中的消息数组
 * @returns AI生成的标题或备用标题
 */
async function generateTitleFromMessages(messages: CardMessage[]): Promise<string> {
  if (messages.length === 0) return '新卡片';

  const fallback = () => {
    const fallbackContent = messages.slice(-1)[0]?.content || '新卡片';
    return fallbackContent.substring(0, 15);
  };

  // 【修改】从 settingsStore 获取所有需要的配置
  const { apiKey, apiUrl, activeModel, globalSystemPrompt, titleSystemPrompt } = useSettingsStore.getState();

  // 检查所有必要的配置
  if (!apiKey || !apiUrl || !activeModel) {
    console.warn('用于生成标题的 API Key, API URL 或模型未配置，将使用备用方案。');
    return fallback();
  }

  // 构建对话历史
  const conversationContent = messages
    .slice(-10) // 同样只取最近10条
    .map(msg => {
      // 【关键修复】在拼接前，先移除AI回复中的@@标记
      const cleanedContent = msg.content.replace(/@@(.*?)@@/g, '$1'); 
      return `${msg.role === 'user' ? '用户' : 'AI'}: ${cleanedContent}`;
    })
    .join('\n');
    
  // 【修改】组合系统提示词
  const systemPrompt = [globalSystemPrompt, titleSystemPrompt].filter(Boolean).join('\n\n');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: activeModel,
        stream: false,
        // 【修改】使用 system 和 user 角色来发送请求，而不是拼接字符串
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conversationContent }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API请求失败: ${response.status} - ${errorText}`);
      throw new Error(`API请求失败: ${response.status}`);
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
    return fallback();
  }
}


const useCardStore = create<CardState>()(
  devtools(
    (set, get) => ({
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
          // If it's not the card we're looking for, return it as is.
          if (card.id !== cardId) {
            return card;
          }
      
          // For the correct card, map over its messages to find the one to update.
          const updatedMessages = card.messages.map((msg) => {
            // If it's not the message we're looking for, return it as is.
            if (msg.id !== messageId) {
              return msg;
            }
      
            // This is the message to update.
            // Create a new message object by spreading the existing message `msg` 
            // and then spreading the `updates` over it. This merges the properties.
            // If `updates` only contains `content`, the existing `tool_calls` from `msg` will be preserved.
            // If `updates` only contains `tool_calls`, the existing `content` from `msg` will be preserved.
            return { ...msg, ...updates };
          });
      
          // Return the card with the newly updated messages array.
          return { ...card, messages: updatedMessages };
        });
      
        // Update the project state with the new array of cards.
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

        // 【修改】调用新的辅助函数，它会自己从 store 获取配置
        const title = await generateTitleFromMessages(card.messages);
        
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
    }
  )
);

export default useCardStore;