'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const KEY = 'chb-theme';
type Theme = 'dark' | 'light';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  // 初次載入：讀 localStorage 或預設 dark
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(KEY)) as Theme | null;
    const init: Theme = saved ?? 'dark';
    setTheme(init);
    document.documentElement.setAttribute('data-theme', init);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
  };

  return (
    <button
      onClick={toggle}
      title={`切換到${theme === 'dark' ? '淺色' : '深色'}模式`}
      aria-label="切換主題"
      className="liquid-glass-thin rounded-full p-2 flex-shrink-0 text-tertiary hover:text-primary transition-all hover:scale-[1.08]"
    >
      {theme === 'dark' ? <Sun size={14}/> : <Moon size={14}/>}
    </button>
  );
}
