// --- START OF COMPLETE AND MODIFIED FILE InputArea.tsx ---

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, FileText, Image, X, ChevronDown, Globe } from 'lucide-react';
import useCardStore from '../stores/cardStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { CardMessage } from '../stores/cardStore';
import { useProjectStore } from '../stores/projectStore';

interface FilePreview {
  id: string;
  name: string;
  type: string;
  url: string; 
  dataUrl?: string; 
}

// NOTE: The 'normalizeMathDelimiters' function has been moved to CardStack.tsx
// to be shared between the main input and the preview card generation.

export const InputArea: React.FC = () => {
  const { 
    addCard, 
    appendMessage, 
    updateMessage, 
    setIsTyping: setGlobalIsTyping, 
    selectedContent, 
    setSelectedContent,
  } = useCardStore();
  
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;

  const { apiUrl, apiKey, models, activeModel, setActiveModel } = useSettingsStore();

  const [inputText, setInputText] = useState('');
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isTyping, setLocalIsTyping] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentCard = cards.find(card => card.id === currentCardId);

  // This utility function is now defined in CardStack.tsx
  const normalizeMathDelimiters = (content: string): string => {
    let normalized = content.replace(/\\\[(.*?)\\\]/gs, '$$$$$1$$$$');
    normalized = normalized.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
    return normalized;
  };

  useEffect(() => {
    if (models.length > 0 && !models.includes(activeModel)) {
      setActiveModel(models[0]);
    } else if (models.length === 0 && activeModel) {
      setActiveModel('');
    }
  }, [models, activeModel, setActiveModel]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 6 * 24;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText]);

  const handleSend = async () => {
    if (!inputText.trim() && filePreviews.length === 0 && !selectedContent) return;
    if (!apiKey?.trim() || !apiUrl.trim()) {
      alert('请在设置中配置您的 API URL 和 API Key');
      return;
    }
    if (models.length === 0 || !activeModel) {
      alert('请在设置中添加至少一个可用模型');
      return;
    }

    setLocalIsTyping(true);
    setGlobalIsTyping(true);

    try {
      const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      
      const encodedFiles = filePreviews.map(file => JSON.stringify({
        name: file.name,
        type: file.type,
        dataUrl: file.type.startsWith('image/') ? file.dataUrl : undefined,
      }));

      const userMsg: CardMessage = {
        id: userMsgId,
        role: 'user',
        content: inputText,
        files: encodedFiles,
        context: selectedContent || undefined,
        timestamp: Date.now()
      };

      let cardId = currentCardId;
      if (cardId && currentCard) {
        appendMessage(cardId, userMsg);
      } else {
        addCard([userMsg]);
        const state = useProjectStore.getState();
        const activeProj = state.projects.find(p => p.id === state.activeProjectId);
        cardId = activeProj?.currentCardId || null;
      }
      
      setInputText('');
      filePreviews.forEach(f => URL.revokeObjectURL(f.url));
      setFilePreviews([]);
      setSelectedContent(null);
      setTimeout(adjustTextareaHeight, 0);
      
      if (cardId) {
        const finalState = useProjectStore.getState();
        const finalActiveProj = finalState.projects.find(p => p.id === finalState.activeProjectId);
        const finalCurrentCard = finalActiveProj?.cards.find(c => c.id === cardId);
        const history = finalCurrentCard?.messages || [];
        await fetchLLMStream(cardId, history, userMsgId);
      }

    } catch (error) {
      console.error('发送消息时出错:', error);
      alert('发送消息失败，请重试');
    } finally {
      setLocalIsTyping(false);
      setGlobalIsTyping(false);
    }
  };

  const fetchLLMStream = async (cardId: string, history: CardMessage[], userMsgId?: string) => {
    const aiMsgId = userMsgId ? `${userMsgId}_ai` : `msg_${Date.now()}_${Math.random().toString(36).slice(2)}_ai`;
    
    const initialAiMessage: CardMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    };
    appendMessage(cardId, initialAiMessage);

    if (!apiUrl) {
      const errorMessage = 'API URL 未设置。';
      updateMessage(cardId, aiMsgId, { content: errorMessage });
      setLocalIsTyping(false);
      setGlobalIsTyping(false);
      return;
    }

    try {
      const apiMessages = history.map(msg => {
        if (msg.role === 'ai') {
            return { role: 'assistant', content: msg.content };
        }
        let fullContent = msg.content;
        if (msg.context) {
            fullContent = `Context:\n"""\n${msg.context}\n"""\n\nQuestion:\n${msg.content}`;
        }
        const imageContent = (msg.files || [])
            .map(fileString => {
                try {
                    const fileInfo = JSON.parse(fileString);
                    if (fileInfo.type?.startsWith('image/') && fileInfo.dataUrl) {
                        return { type: 'image_url', image_url: { url: fileInfo.dataUrl } };
                    }
                } catch (e) { /* 忽略无法解析的文件 */ }
                return null;
            })
            .filter((item): item is { type: 'image_url', image_url: { url: string } } => item !== null);

        if (imageContent.length > 0) {
            return { role: 'user', content: [ { type: 'text', text: fullContent }, ...imageContent ] };
        } else {
            return { role: 'user', content: fullContent };
        }
      });
      
      const { globalSystemPrompt, dialogueSystemPrompt } = useSettingsStore.getState();
      const systemPromptContent = [globalSystemPrompt, dialogueSystemPrompt].filter(Boolean).join('\n\n');
      
      const messagesForApi = [...apiMessages];
      if (systemPromptContent) {
        messagesForApi.unshift({ role: 'system', content: systemPromptContent });
      }

      const hasImages = apiMessages.some(msg => 
        Array.isArray(msg.content) && msg.content.some(part => (part as any).type === 'image_url')
      );

      const requestBody: any = { 
        model: activeModel, 
        stream: true, 
        messages: messagesForApi
      };
      if (hasImages) { requestBody.max_tokens = 4096; }
      if (isWebSearchEnabled) { 
        requestBody.enable_search = true; 
        requestBody.search_options = { provider: "biying" }; 
      }
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody), 
      });
      
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API请求失败: ${res.status} ${res.statusText} - ${errorBody}`);
      }
      if (!res.body) throw new Error('No response body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiContent = '';
      mainReadLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);
            if (line === '' || !line.startsWith('data: ')) continue;
            const data = line.substring(6);
            if (data === '[DONE]') break mainReadLoop;
            try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    aiContent += delta;
                    const normalizedContent = normalizeMathDelimiters(aiContent);
                    updateMessage(cardId, aiMsgId, { content: normalizedContent });
                }
            } catch (parseError) {
                console.warn('解析流式数据时出错 (已跳过):', parseError, 'in line:', line);
            }
        }
      }
    } catch (error) {
      console.error('LLM API调用失败:', error);
      const errorMessage = 'AI回复失败，请检查模型是否支持视觉、API Key或网络连接。';
      updateMessage(cardId, aiMsgId, { content: errorMessage });
    } finally {
      setLocalIsTyping(false);
      setGlobalIsTyping(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fileUrl = URL.createObjectURL(file);
      const newFilePreview: FilePreview = { id: fileId, name: file.name, type: file.type, url: fileUrl };
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const base64DataUrl = loadEvent.target?.result as string;
          setFilePreviews(prev => prev.map(fp => fp.id === fileId ? { ...fp, dataUrl: base64DataUrl } : fp));
        };
        reader.onerror = (error) => { console.error('FileReader error:', error); removeFile(fileId); };
        reader.readAsDataURL(file);
      }
      setFilePreviews(prev => [...prev, newFilePreview]);
    });
    if (event.target) event.target.value = '';
  };

  const removeFile = (id: string) => {
    setFilePreviews(prev => {
      const file = prev.find(f => f.id === id);
      if (file) URL.revokeObjectURL(file.url);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-transparent p-4 relative z-20"> 
        <div className="bg-[#3A3A3A] rounded-[16px] p-3 flex flex-col gap-3">
        
        {selectedContent !== null && (
          <div className="bg-[#2F2F2F] p-2 rounded-lg relative text-sm border border-dashed border-gray-600">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-grow">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Selected Text (Editable)</p>
                <textarea
                  value={selectedContent}
                  onChange={(e) => setSelectedContent(e.target.value)}
                  className="w-full bg-[#3A3A3A] text-white p-2 rounded text-sm resize-y outline-none min-h-[60px] max-h-32 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent"
                  placeholder="Edit selected text..."
                  rows={3}
                />
              </div>
              <button
                onClick={() => setSelectedContent(null)}
                className="text-gray-400 hover:text-white flex-shrink-0"
                title="Deselect Text"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {filePreviews.length > 0 && (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent">
            <div className="flex gap-2 min-w-max pb-1">
              {filePreviews.map(file => (
                <div key={file.id} className="flex items-center gap-1.5 bg-[#4C4C4C] rounded-md px-2 py-1">
                  {file.type.startsWith('image/') ? (
                    <Image size={14} className="text-white" />
                  ) : (
                    <FileText size={14} className="text-white" />
                  )}
                  <span className="text-white text-xs max-w-[120px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(file.id)} className="text-gray-400 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Input Text..."
            className="w-full bg-transparent text-white text-base leading-6 resize-none outline-none placeholder-gray-500 min-h-[24px] max-h-[144px]"
            rows={1}
          />
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  disabled={models.length === 0}
                  className="flex items-center gap-1 text-sm bg-[#5E5E5E] px-2 py-1 rounded-md hover:bg-opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{activeModel || '无可用模型'}</span>
                  <ChevronDown size={14} className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showModelDropdown && models.length > 0 && (
                  <div className="absolute bottom-full mb-2 w-48 bg-[#2a2a2a] border border-gray-600 rounded-md shadow-lg z-20">
                    {models.map(model => (
                      <div
                        key={model}
                        onClick={() => { setActiveModel(model); setShowModelDropdown(false); }}
                        className="px-3 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer"
                      >
                        {model}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                title={isWebSearchEnabled ? "禁用联网" : "启用联网"}
                className={`p-2 rounded-full hover:bg-[#5E5E5E] transition-colors ${isWebSearchEnabled ? 'text-[#13E425]' : 'text-gray-400'}`}
              >
                <Globe size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-[#5E5E5E] text-gray-400 hover:text-white transition-colors">
                <Paperclip size={18} />
              </button>
              <button
                disabled={isTyping || (!inputText.trim() && filePreviews.length === 0 && !selectedContent)}
                onClick={handleSend}
                className="bg-[#4C4C4C] text-[#13E425] w-9 h-9 flex items-center justify-center rounded-full shadow-[0_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5C5C5C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="发送消息"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept="image/*, .pdf, .doc, .docx, .txt, .md" />
    </div>
  );
};