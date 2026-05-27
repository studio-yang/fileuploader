'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'undo';

interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastCtx {
  push: (t: Omit<ToastItem, 'id'>) => void;
  success: (msg: string) => void;
  error:   (msg: string) => void;
  info:    (msg: string) => void;
  undo:    (msg: string, onUndo: () => void, durationMs?: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be inside <ToastProvider>');
  return v;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, ...t };
    setItems((prev) => [...prev, item]);
    const ms = t.durationMs ?? (t.type === 'undo' ? 5000 : 3000);
    setTimeout(() => remove(id), ms);
  }, [remove]);

  const api: ToastCtx = {
    push,
    success: (m) => push({ type: 'success', message: m }),
    error:   (m) => push({ type: 'error',   message: m }),
    info:    (m) => push({ type: 'info',    message: m }),
    undo:    (m, onUndo, durationMs) => push({
      type: 'undo', message: m, durationMs,
      action: { label: '復原', onClick: onUndo },
    }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Toast container（右下角）*/}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => remove(t.id)} onAction={() => {
            t.action?.onClick();
            remove(t.id);
          }} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onClose, onAction }: {
  item: ToastItem; onClose: () => void; onAction: () => void;
}) {
  const tint = item.type === 'success' ? 'liquid-tint-green'
             : item.type === 'error'   ? 'liquid-tint-red'
             : item.type === 'undo'    ? 'liquid-tint-orange'
             : 'liquid-tint-blue';

  const icon = item.type === 'success' ? '✓'
             : item.type === 'error'   ? '✕'
             : item.type === 'undo'    ? '↺'
             : 'ⓘ';

  return (
    <div
      className={`pointer-events-auto liquid-glass-strong liquid-lensing ${tint} rounded-ios-md px-4 py-3 flex items-center gap-3 min-w-[260px] max-w-[420px] animate-ios-slide-up`}
      style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.40)' }}
    >
      <span className="text-[16px] font-display font-bold">{icon}</span>
      <span className="text-[13px] font-display text-primary flex-1">{item.message}</span>
      {item.action && (
        <button
          onClick={onAction}
          className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display font-semibold text-primary hover:scale-[1.05] transition-transform"
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={onClose}
        className="text-quaternary hover:text-secondary transition-colors text-[14px]"
      >
        ✕
      </button>
    </div>
  );
}
