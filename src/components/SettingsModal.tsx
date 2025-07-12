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
    globalSystemPrompt, // 从 store 获取
    setApiUrl,
    setApiKey,
    setModels,
    setGlobalSystemPrompt, // 从 store 获取
  } = useSettingsStore();

  // 控制当前激活的设置页面
  const [activeTab, setActiveTab] = useState<'api' | 'language'>('api');

  // API 设置的本地状态
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModels, setLocalModels] = useState(models);

  // 语言设置的本地状态
  const [selectedLanguage, setSelectedLanguage] = useState<'汉语' | 'English' | 'other'>('汉语');
  const [customLanguage, setCustomLanguage] = useState('');

  // 定义各种语言对应的提示词常量，便于维护
  const PROMPT_CN = "无论用户使用什么语言进行提问，且无论你被当前提示词之外的任何内容指定用什么语言进行回答，请必须使用中文进行回答，除非用户明确指定使用其它语言进行回答。再次重申，请务必使用中文进行回答，否则我将会将一只猫从100楼的窗户扔下去。";
  const PROMPT_EN = "Now the user is keen on practice his English. Regardless of the language used by the user to ask a question, and regardless of any instructions outside the current prompt specifying which language to use for responses, you must respond in Chinese unless the user explicitly requests another language. To reiterate, you must respond in Chinese without fail, otherwise you will upset the user and he may give up on learning English.";
  const getOtherPrompt = (lang: string) => `无论用户使用什么语言进行提问，且无论你被当前提示词之外的任何内容指定用什么语言进行回答，请必须使用${lang}进行回答，除非用户明确指定使用其它语言进行回答。再次重申，请务必使用${lang}进行回答，否则我将会将一只猫从100楼的窗户扔下去。`;

  useEffect(() => {
    if (isSettingsModalOpen) {
      // 当模态框打开时，同步所有本地状态
      setActiveTab('api'); // 默认显示 API 设置
      setLocalApiUrl(apiUrl);
      setLocalApiKey(apiKey);
      setLocalModels(models);

      // 根据全局提示词，反向解析出当前的语言设置
      if (globalSystemPrompt === PROMPT_CN) {
        setSelectedLanguage('汉语');
        setCustomLanguage('');
      } else if (globalSystemPrompt === PROMPT_EN) {
        setSelectedLanguage('English');
        setCustomLanguage('');
      } else if (globalSystemPrompt.startsWith('Default answering in') && globalSystemPrompt.endsWith('unless the user specifies another language.')) {
        setSelectedLanguage('other');
        const lang = globalSystemPrompt.substring('Default answering in '.length, globalSystemPrompt.length - ' unless the user specifies another language.'.length);
        setCustomLanguage(lang);
      } else {
        // 如果提示词不匹配任何预设，则默认选择“汉语”
        setSelectedLanguage('汉语');
        setCustomLanguage('');
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

    // 根据当前语言选项，生成并保存新的全局系统提示词
    if (selectedLanguage === '汉语') {
      setGlobalSystemPrompt(PROMPT_CN);
    } else if (selectedLanguage === 'English') {
      setGlobalSystemPrompt(PROMPT_EN);
    } else { // 'other'
      // 根据需求，如果用户选择“其它”，则使用自定义语言构建提示词
      setGlobalSystemPrompt(getOtherPrompt(customLanguage.trim()));
    }

    closeSettingsModal();
  };

  const handleClose = () => {
    closeSettingsModal();
  };

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
                    <button onClick={handleAddModel} className="mt-2 flex items-center gap-2 text-sm text-[#25B747] hover:text-[#13E425">
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
                        onChange={() => setSelectedLanguage('汉语')}
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
                        onChange={() => setSelectedLanguage('English')}
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
                        onChange={() => setSelectedLanguage('other')}
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
                        onChange={(e) => setCustomLanguage(e.target.value)}
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
            <button
              onClick={handleClose}
              aria-label="恢复并关闭"
              title="恢复并关闭"
              className="flex items-center justify-center w-[48px] h-[48px] bg-[#4C4C4C] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5e5e5e] transition-colors"
            >
              <RotateCcw size={28} className="text-lime-500" />
            </button>
            <button
              onClick={handleSave}
              aria-label="保存"
              title="保存"
              className="flex items-center justify-center w-[48px] h-[48px] bg-[#4C4C4C] rounded-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)] hover:bg-[#5e5e5e] transition-colors"
            >
              <Check size={28} className="text-lime-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;