'use client';

import { useState, useRef, useEffect } from 'react';

type Props = {
  text: string;
};

export default function HelpTooltip({ text }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // タップ外で閉じる（モバイル対応）
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300 focus:outline-none flex items-center justify-center flex-shrink-0"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        aria-label="ヘルプ"
      >
        ?
      </button>
      {visible && (
        <span className="absolute z-20 left-6 top-0 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}
