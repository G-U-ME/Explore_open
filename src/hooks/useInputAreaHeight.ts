import { useState, useEffect, useRef } from 'react';

export const useInputAreaHeight = () => {
  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (inputAreaRef.current) {
        const height = inputAreaRef.current.offsetHeight;
        setInputAreaHeight(height);
      }
    };

    // 初始更新
    updateHeight();

    // 创建ResizeObserver来监听高度变化
    const resizeObserver = new ResizeObserver(updateHeight);
    if (inputAreaRef.current) {
      resizeObserver.observe(inputAreaRef.current);
    }

    // 监听窗口大小变化
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return { inputAreaHeight, inputAreaRef };
}; 