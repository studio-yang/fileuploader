'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Command {
  id:     string;
  icon:   string;
  label:  string;
  desc:   string;
  action: () => void;
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  isAdmin:  boolean;
  onTab:    (tab: 'upload' | 'download') => void;
  onLogout: () => void;
}

export function CommandPalette({ open, onClose, isAdmin, onTab, onLogout }: Props) {
  const router   = useRouter();
  const [query,  setQuery]  = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all: Command[] = [
    { id: 'upload',   icon: '↑', label: '切換到上傳',     desc: 'Upload',       action: () => { onTab('upload');   onClose(); } },
    { id: 'download', icon: '↓', label: '切換到下載中心',  desc: 'Download',     action: () => { onTab('download'); onClose(); } },
    ...(isAdmin ? [{ id: 'admin', icon: '⚙', label: '白名單管理', desc: 'Admin', action: () => { router.push('/admin'); onClose(); } }] : []),
    { id: 'logout',   icon: '↩', label: '登出',            desc: 'Logout',       action: () => { onLogout(); onClose(); } },
    { id: 'theme',    icon: '◑', label: '切換深/淺色主題',  desc: 'Toggle theme', action: () => {
      const d = document.documentElement;
      d.setAttribute('data-theme', d.getAttribute('data-theme') === 'light' ? '' : 'light');
      onClose();
    }},
  ];

  const list = query.trim()
    ? all.filter((c) => c.label.includes(query) || c.desc.toLowerCase().includes(query.toLowerCase()))
    : all;

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  const run = useCallback(() => { list[active]?.action(); }, [list, active]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, list.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); run(); }
      if (e.key === 'Escape')    { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, list.length, active, run, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-start justify-center pt-[18vh]"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="liquid-glass-strong liquid-lensing rounded-ios-xl w-full max-w-[520px] mx-4 animate-ios-pop overflow-hidden"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.60)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-quaternary flex-shrink-0">
            <circle cx="7" cy="7" r="5"/><path d="M13 13L10 10"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入指令…"
            className="flex-1 bg-transparent outline-none text-[15px] font-display text-primary placeholder:text-quaternary"
          />
          <kbd className="liquid-glass-thin rounded-md px-2 py-0.5 text-[11px] font-mono text-quaternary flex-shrink-0">ESC</kbd>
        </div>

        {/* Commands */}
        <div className="py-1.5" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {list.length === 0 && (
            <p className="px-5 py-5 text-[13px] text-tertiary font-display text-center">找不到「{query}」</p>
          )}
          {list.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={c.action}
              className={`w-full px-5 py-3 flex items-center gap-3.5 transition-colors duration-100 ${
                i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <span className="w-7 h-7 rounded-ios-sm liquid-glass-thin flex items-center justify-center text-[14px] flex-shrink-0">
                {c.icon}
              </span>
              <span className="flex-1 text-[14px] font-display font-medium text-primary text-left">{c.label}</span>
              <span className="text-[11px] text-quaternary font-display">{c.desc}</span>
              {i === active && (
                <kbd className="liquid-glass-thin rounded px-1.5 py-0.5 text-[10px] font-mono text-quaternary">↵</kbd>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-2.5 flex items-center gap-4 text-[11px] text-quaternary font-display"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span>↑↓ 選擇</span>
          <span>↵ 執行</span>
          <span className="ml-auto">⌘K 開關</span>
        </div>
      </div>
    </div>
  );
}
