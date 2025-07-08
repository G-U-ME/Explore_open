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
    setApiUrl,
    setApiKey,
    setModels,
  } = useSettingsStore();

  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localModels, setLocalModels] = useState(models);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setLocalApiUrl(apiUrl);
      setLocalApiKey(apiKey);
      setLocalModels(models);
    }
  }, [isSettingsModalOpen, apiUrl, apiKey, models]);

  if (!isSettingsModalOpen) {
    return null;
  }

  const handleSave = () => {
    setApiUrl(localApiUrl);
    setApiKey(localApiKey);
    // Filter out empty model names before saving
    setModels(localModels.filter(m => m.trim() !== ''));
    closeSettingsModal();
  };

  const handleClose = () => {
    closeSettingsModal();
  }

  const handleAddModel = () => {
    setLocalModels([...localModels, '']);
  }

  const handleRemoveModel = (index: number) => {
    setLocalModels(localModels.filter((_, i) => i !== index));
  }

  const handleModelChange = (index: number, value: string) => {
    const newModels = [...localModels];
    newModels[index] = value;
    setLocalModels(newModels);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-[#222222] rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex relative">
        {/* Close Button */}
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        {/* Left Menu */}
        <div className="w-1/4 border-r border-gray-700 p-4">
          <h2 className="text-xl font-bold mb-4">设置</h2>
          <ul>
            <li 
              className={`p-2 rounded cursor-pointer bg-[#4C4C4C]`}
            >
              API 设置
            </li>
          </ul>
        </div>

        {/* Right Content */}
        <div className="w-3/4 p-6 flex flex-col">
          <div className="flex-grow overflow-y-auto pr-2">
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
                <button onClick={handleAddModel} className="mt-2 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Plus size={16} />
                  添加模型
                </button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-auto flex justify-end items-center gap-[10px] pt-4">
            <button
              onClick={handleClose}
              aria-label="恢复"
              title="恢复"
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