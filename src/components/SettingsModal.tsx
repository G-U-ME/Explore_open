import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Plus, X, RotateCcw, Check } from 'lucide-react';

const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    apiUrl,
    apiKey,
    models,
    globalSystemPrompt,
    setApiUrl,
    setApiKey,
    setModels,
    setGlobalSystemPrompt,
  } = useSettingsStore();

  // 控制当前激活的设置页面
  const [activeTab, setActiveTab] = useState<'api' | 'language'>('api');

  // API 设置的本地状态
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModels, setLocalModels] = useState(models);

  // --- 修改开始: 语言设置状态管理优化 ---

  // 语言UI选项的本地状态
  const [selectedLanguage, setSelectedLanguage] = useState<'汉语' | 'English' | 'other'>('汉语');
  const [customLanguage, setCustomLanguage] = useState('');
  
  // 为全局系统提示词创建专门的本地状态，作为“工作副本”
  const [localGlobalSystemPrompt, setLocalGlobalSystemPrompt] = useState(globalSystemPrompt);

  // 定义各种语言对应的提示词常量
  const PROMPT_CN = "无论用户使用什么语言进行提问，且无论你被当前提示词之外的任何内容指定用什么语言进行回答，请必须使用中文进行回答，除非用户明确指定使用其它语言进行回答。再次重申，请务必使用中文进行回答，否则我将会将一只猫从100楼的窗户扔下去。";
  const PROMPT_EN = "No matter what language the user asks in, and regardless of any instructions outside this prompt specifying a response language, you must answer in English unless the user explicitly requests another language. I repeat, you must respond in English—otherwise, I will throw a cat out of a 100th-floor window.";
  const getOtherPrompt = (lang: string) => `无论用户使用什么语言进行提问，且无论你被当前提示词之外的任何内容指定用什么语言进行回答，请必须使用${lang}进行回答，除非用户明确指定使用其它语言进行回答。再次重申，请务必使用${lang}进行回答，否则我将会将一只猫从100楼的窗户扔下去。`;
  
  // --- 修改结束 ---

  useEffect(() => {
    if (isSettingsModalOpen) {
      // 1. 当模态框打开时，同步所有本地状态
      setActiveTab('api');
      setLocalApiUrl(apiUrl);
      setLocalApiKey(apiKey);
      setLocalModels([...models]); // 使用副本以避免直接修改
      setLocalGlobalSystemPrompt(globalSystemPrompt); // 同步系统提示词

      // 2. 根据全局提示词，反向解析出当前的语言UI设置
      //    这部分逻辑仅用于初始化UI，使其与当前存储的设置匹配
      if (globalSystemPrompt === PROMPT_CN) {
        setSelectedLanguage('汉语');
        setCustomLanguage('');
      } else if (globalSystemPrompt === PROMPT_EN) {
        setSelectedLanguage('English');
        setCustomLanguage('');
      } else {
        // 尝试从 "other" 类型的提示词中解析语言
        const match = globalSystemPrompt.match(/请必须使用(.+?)进行回答/);
        if (match && match[1]) {
           setSelectedLanguage('other');
           setCustomLanguage(match[1]);
        } else {
          // 如果提示词不匹配任何预设，则默认选择“汉语”
          setSelectedLanguage('汉语');
          setCustomLanguage('');
          // 可选：将 localGlobalSystemPrompt 也重置为默认值
          // setLocalGlobalSystemPrompt(PROMPT_CN); 
        }
      }
    }
  }, [isSettingsModalOpen, apiUrl, apiKey, models, globalSystemPrompt]);


  if (!isSettingsModalOpen) {
    return null;
  }

  const handleSave = () => {
    // 保存 API 设置
    setApiUrl(localApiUrl);
    setApiKey(localApiKey);
    setModels(localModels.filter(m => m.trim() !== ''));

    // --- 修改开始: 直接保存本地的系统提示词状态 ---
    setGlobalSystemPrompt(localGlobalSystemPrompt.trim());
    // --- 修改结束 ---

    closeSettingsModal();
  };

  const handleClose = () => {
    // 关闭模态框，不保存任何更改。因为所有更改都在本地状态中，所以无需“恢复”操作。
    closeSettingsModal();
  };

  // --- 修改开始: 更新语言切换的事件处理函数 ---

  const handleLanguageRadioChange = (lang: '汉语' | 'English' | 'other') => {
    setSelectedLanguage(lang);
    if (lang === '汉语') {
      setLocalGlobalSystemPrompt(PROMPT_CN);
    } else if (lang === 'English') {
      setLocalGlobalSystemPrompt(PROMPT_EN);
    } else { // 'other'
      // 当切换到 'other' 时，使用当前 customLanguage 的值生成提示
      setLocalGlobalSystemPrompt(getOtherPrompt(customLanguage));
    }
  };

  const handleCustomLanguageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLang = e.target.value;
    setCustomLanguage(newLang);
    // 实时更新本地的系统提示词
    setLocalGlobalSystemPrompt(getOtherPrompt(newLang));
  };
  
  // --- 修改结束 ---


  const handleAddModel = () => {
    setLocalModels([...localModels, '']);
  };

  const handleRemoveModel = (index: number) => {
    setLocalModels(localModels.filter((_, i) => i !== index));
  };

  const handleModelChange = (index: number, value: string) => {
    const newModels = [...localModels];
    newModels[index] = value;
    setLocalModels(newModels);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-[#222222] rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex relative">
        {/* Close Button */}
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10">
          <X size={24} />
        </button>

        {/* Left Menu */}
        <div className="w-1/4 border-r border-gray-700 p-4 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">设置</h2>
          <ul>
            <li
              className={`p-2 rounded cursor-pointer ${activeTab === 'api' ? 'bg-[#4C4C4C]' : 'hover:bg-[#3a3a3a]'}`}
              onClick={() => setActiveTab('api')}
            >
              API 设置
            </li>
            <li
              className={`p-2 rounded cursor-pointer ${activeTab === 'language' ? 'bg-[#4C4C4C]' : 'hover:bg-[#3a3a3a]'}`}
              onClick={() => setActiveTab('language')}
            >
              语言
            </li>
          </ul>
        </div>

        {/* Right Content */}
        <div className="w-3/4 p-6 flex flex-col">
          <div className="flex-grow overflow-y-auto pr-2">
            {/* API Settings Panel */}
            {activeTab === 'api' && (
              <>
                <h3 className="text-lg font-semibold mb-4">API 设置</h3>
                <div className="space-y-4">
                  {/* ... API 设置的 JSX 保持不变 ... */}
                  <div>
                    <label htmlFor="api-url" className="block text-sm font-medium text-gray-300 mb-1">
                      API URL
                    </label>
                    <input
                      type="text"
                      id="api-url"
                      className="w-full bg-[#3A3A3A] border border-gray-600 rounded-md p-2 text-white"
                      value={localApiUrl}
                      onChange={(e) => setLocalApiUrl(e.target.value)}
                      placeholder="请输入 API 的 URL"
                    />
                  </div>
                  <div>
                    <label htmlFor="api-key" className="block text-sm font-medium text-gray-300 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      id="api-key"
                      className="w-full bg-[#3A3A3A] border border-gray-600 rounded-md p-2 text-white"
                      value={localApiKey}
                      onChange={(e) => setLocalApiKey(e.target.value)}
                      placeholder="请输入您的 API Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      模型名称
                    </label>
                    <div className="space-y-2">
                      {localModels.map((model, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-full bg-[#3A3A3A] border border-gray-600 rounded-md p-2 text-white"
                            value={model}
                            onChange={(e) => handleModelChange(index, e.target.value)}
                            placeholder={`模型 ${index + 1}`}
                          />
                          <button onClick={() => handleRemoveModel(index)} className="p-2 text-gray-400 hover:text-white">
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleAddModel} className="mt-2 flex items-center gap-2 text-sm text-[#25B747] hover:text-[#13E425]">
                      <Plus size={16} />
                      添加模型
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Language Settings Panel */}
            {activeTab === 'language' && (
              <>
                <h3 className="text-lg font-semibold mb-4">语言设置</h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-400 mb-2">选择默认的应答语言。此设置将修改全局系统提示词。</p>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3A3A3A] cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value="汉语"
                        checked={selectedLanguage === '汉语'}
                        onChange={() => handleLanguageRadioChange('汉语')}
                        className="h-4 w-4 accent-[#13E425] bg-gray-700 border-gray-600"
                      />
                      <span className="text-white">汉语</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3A3A3A] cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value="English"
                        checked={selectedLanguage === 'English'}
                        onChange={() => handleLanguageRadioChange('English')}
                        className="h-4 w-4 accent-[#13E425] bg-gray-700 border-gray-600"
                      />
                      <span className="text-white">English</span>
                    </label>

                    <label className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3A3A3A] cursor-pointer">
                      <input
                        type="radio"
                        name="language"
                        value="other"
                        checked={selectedLanguage === 'other'}
                        onChange={() => handleLanguageRadioChange('other')}
                        className="h-4 w-4 accent-[#13E425] bg-gray-700 border-gray-600"
                      />
                      <span className="text-white">其它</span>
                    </label>
                  </div>

                  {selectedLanguage === 'other' && (
                    <div className="mt-2 pl-9">
                      <label htmlFor="custom-language" className="block text-sm font-medium text-gray-300 mb-1">
                        自定义语言名称
                      </label>
                      <input
                        type="text"
                        id="custom-language"
                        className="w-full bg-[#3A3A3A] border border-gray-600 rounded-md p-2 text-white"
                        value={customLanguage}
                        onChange={handleCustomLanguageChange}
                        placeholder="例如: Japanese, Français"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-auto flex justify-end items-center gap-[10px] pt-4 border-t border-gray-700">
             {/* 
                这里的“恢复并关闭”按钮的 title 提示是 “恢复并关闭”。
                当前逻辑是点击它会直接关闭，由于所有修改都在本地状态，
                下次打开时会从全局 store 重新加载，等于间接实现了“恢复”效果。
                行为是正确的。
             */}
            <button
              onClick={handleClose}
              aria-label="恢复并关闭"
              title="恢复并关闭"
              className="flex items-center justify-center w-[48px] h-[48px] bg-[#4C4C4C] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5e5e5e] transition-colors"
            >
              <RotateCcw size={28} className="text-[#13E425]" />
            </button>
            <button
              onClick={handleSave}
              aria-label="保存"
              title="保存"
              className="flex items-center justify-center w-[48px] h-[48px] bg-[#4C4C4C] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5e5e5e] transition-colors"
            >
              <Check size={28} className="text-[#13E425]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;