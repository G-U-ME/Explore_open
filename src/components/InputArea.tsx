import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, FileText, Image, X, ChevronDown } from 'lucide-react'
import useCardStore from '../stores/cardStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { CardMessage } from '../stores/cardStore'
import { useProjectStore } from '../stores/projectStore'

interface FilePreview {
  id: string
  name: string
  type: string
  url: string
}

export const InputArea: React.FC = () => {
  const { 
    addCard, 
    appendMessage, 
    updateMessage, 
    setIsTyping: setGlobalIsTyping, 
    selectedContent, 
    setSelectedContent,
  } = useCardStore()
  
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const cards = activeProject?.cards || [];
  const currentCardId = activeProject?.currentCardId || null;

  const { apiUrl, apiKey, models } = useSettingsStore();

  const [inputText, setInputText] = useState('')
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [isTyping, setLocalIsTyping] = useState(false)
  const [currentModel, setCurrentModel] = useState(models[0] || '');
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentCard = cards.find(card => card.id === currentCardId)

  useEffect(() => {
    if (models.length > 0 && !models.includes(currentModel)) {
      setCurrentModel(models[0]);
    } else if (models.length === 0) {
      setCurrentModel('');
    }
  }, [models, currentModel]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 6 * 24
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputText])

  const handleSend = async () => {
    const combinedPrompt = selectedContent
      ? `Context:\n"""\n${selectedContent}\n"""\n\nQuestion:\n${inputText}`
      : inputText

    if (!combinedPrompt.trim() && filePreviews.length === 0) return

    if (!apiKey?.trim() || !apiUrl.trim()) {
      alert('请在设置中配置您的 API URL 和 API Key');
      return
    }

    if(models.length === 0 || !currentModel) {
      alert('请在设置中添加至少一个模型');
      return;
    }

    setLocalIsTyping(true)
    setGlobalIsTyping(true)

    try {
      const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const userMsg: CardMessage = {
        id: userMsgId,
        role: 'user',
        content: inputText,
        files: filePreviews.map(f => f.name),
        context: selectedContent || undefined,
        timestamp: Date.now()
      }

      let cardId = currentCardId
      if (cardId && currentCard) {
        appendMessage(cardId, userMsg)
      } else {
        addCard([userMsg])
        // After addCard, the new cardId is in the project store
        const { projects, activeProjectId } = useProjectStore.getState();
        cardId = projects.find(p => p.id === activeProjectId)?.currentCardId || null;
      }

      setInputText('')
      setFilePreviews([])
      setSelectedContent(null)

      setTimeout(adjustTextareaHeight, 0)
      
      if (cardId) {
        await fetchLLMStream(cardId, combinedPrompt, userMsgId)
      }

    } catch (error) {
      console.error('发送消息时出错:', error)
      alert('发送消息失败，请重试')
    } finally {
      setLocalIsTyping(false)
      setGlobalIsTyping(false)
    }
  }

  const fetchLLMStream = async (cardId: string, prompt: string, userMsgId?: string) => {
    const aiMsgId = userMsgId ? `${userMsgId}_ai` : `msg_${Date.now()}_${Math.random().toString(36).slice(2)}_ai`;
    let aiContent = ''
    
    const initialAiMessage: CardMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: Date.now()
    }
    appendMessage(cardId, initialAiMessage)

    if (!apiUrl) {
      console.error('API URL not found in settings');
      const errorMessage = 'API URL 未设置。';
      updateMessage(cardId, aiMsgId, { content: errorMessage });
      setLocalIsTyping(false);
      setGlobalIsTyping(false);
      return;
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          stream: true,
          messages: [{ role: 'user', content: prompt }]
        }),
      })
      
      if (!res.ok) {
        const errorBody = await res.text();
        console.error('API Error:', res.status, res.statusText, errorBody);
        throw new Error(`API请求失败: ${res.status} ${res.statusText}`)
      }
      
      if (!res.body) throw new Error('No response body')
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      
      let buffer = '';

      mainReadLoop: while (true) {
        const { value, done } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        let boundary;
        while ((boundary = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, boundary).trim();
            buffer = buffer.substring(boundary + 1);

            if (line === '' || !line.startsWith('data: ')) {
                continue;
            }
            
            const data = line.substring(6);

            if (data === '[DONE]') {
                break mainReadLoop;
            }

            try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    aiContent += delta;
                    updateMessage(cardId, aiMsgId, { content: aiContent });
                }
            } catch (parseError) {
                console.warn('解析流式数据时出错 (已跳过):', parseError, 'in line:', line);
            }
        }
      }

      if (buffer.length > 0) {
        const line = buffer.trim();
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            const data = line.substring(6);
            try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    aiContent += delta;
                    updateMessage(cardId, aiMsgId, { content: aiContent });
                }
            } catch (parseError) {
                console.warn('解析流末尾数据时出错 (已跳过):', parseError, 'in final buffer:', buffer);
            }
        }
      }

    } catch (error) {
      console.error('LLM API调用失败:', error)
      const errorMessage = 'AI回复失败，请检查API Key或网络连接。';
      updateMessage(cardId, aiMsgId, { content: errorMessage });
    } finally {
      setLocalIsTyping(false);
      setGlobalIsTyping(false);
    }
  }


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const fileUrl = URL.createObjectURL(file)
      
      setFilePreviews(prev => [...prev, {
        id: fileId,
        name: file.name,
        type: file.type,
        url: fileUrl
      }])
    })
    if(event.target) event.target.value = '';
  }

  const removeFile = (id: string) => {
    setFilePreviews(prev => {
      const file = prev.find(f => f.id === id)
      if (file) URL.revokeObjectURL(file.url)
      return prev.filter(f => f.id !== id)
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const availableModels = models;

  return (
    // 修改：添加 bg-transparent 强制背景透明
    <div className="bg-transparent p-4 relative z-10">
      <div className="bg-[#3A3A3A] rounded-[16px] p-3 flex flex-col gap-3">
        
        {selectedContent && (
          <div className="bg-[#3A3A3A] p-2 rounded-lg relative text-sm">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-grow">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Selected Text</p>
                <p className="text-white whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{selectedContent}</p>
              </div>
              <button
                onClick={() => setSelectedContent(null)}
                className="text-gray-400 hover:text-white flex-shrink-0"
                title="清除选择"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {filePreviews.length > 0 && (
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {filePreviews.map(file => (
                <div key={file.id} className="flex items-center gap-1.5 bg-[#3A3A3A] rounded-md px-2 py-1">
                  {file.type.startsWith('image/') ? (
                    <Image size={14} className="text-white" />
                  ) : (
                    <FileText size={14} className="text-white" />
                  )}
                  <span className="text-white text-xs max-w-xs truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
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
          {/* Bottom buttons */}
          <div className="flex justify-between items-center h-10">
            {/* Left buttons: Model selection and file upload */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  disabled={availableModels.length === 0}
                  className="flex items-center gap-1 text-sm bg-[#5E5E5E] px-2 py-1 rounded-md hover:bg-opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{currentModel || '无可用模型'}</span>
                  <ChevronDown size={14} className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showModelDropdown && availableModels.length > 0 && (
                  <div className="absolute bottom-full mb-2 w-48 bg-[#2a2a2a] border border-gray-600 rounded-md shadow-lg">
                    {availableModels.map(model => (
                      <div
                        key={model}
                        onClick={() => {
                          setCurrentModel(model);
                          setShowModelDropdown(false);
                        }}
                        className="px-3 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer"
                      >
                        {model}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right button: Send */}
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-[#5E5E5E] transition-colors">
                <Paperclip size={18} />
              </button>

              <button
                onClick={handleSend}
                disabled={isTyping || (!inputText.trim() && filePreviews.length === 0 && !selectedContent)}
                className="bg-[#4C4C4C] text-[#13E425] w-9 h-9 flex items-center justify-center rounded-full shadow-[0_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5C5C5C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="发送消息"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  )
}