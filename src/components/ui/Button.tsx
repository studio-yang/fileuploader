'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  icon?:    ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * 共用 Button 元件 — 統一所有按鈕的樣式、尺寸、狀態
 *
 * 用法：
 *   <Button variant="primary">點我</Button>
 *   <Button variant="danger" icon={<Trash2 size={12}/>} size="sm">刪除</Button>
 *   <Button variant="ghost" loading>處理中</Button>
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', icon, loading, fullWidth, children, className = '', disabled, style, ...rest }, ref
) {
  const sizeCls = size === 'sm' ? 'px-3 py-1.5 text-[12px]'
               : size === 'lg' ? 'px-6 py-3 text-[15px]'
               : 'px-4 py-2 text-[13px]';

  const base = `rounded-full font-display font-semibold inline-flex items-center justify-center gap-1.5 transition-all hover:scale-[1.03] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 ${sizeCls} ${fullWidth ? 'w-full' : ''}`;

  const variantStyle: React.CSSProperties =
    variant === 'primary' ? {
      background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
      color: 'white',
      boxShadow: 'var(--elev-2), inset 0 1px 0 rgba(255,255,255,0.30)',
    }
    : variant === 'danger' ? {
      background: 'linear-gradient(135deg, #ff453a, #d70015)',
      color: 'white',
      boxShadow: 'var(--elev-2)',
    }
    : variant === 'success' ? {
      background: 'linear-gradient(135deg, #30d158, #28a745)',
      color: 'white',
      boxShadow: 'var(--elev-2)',
    }
    : variant === 'warning' ? {
      background: 'linear-gradient(135deg, #ff9500, #ff6a00)',
      color: 'white',
      boxShadow: 'var(--elev-2)',
    }
    : {};   // secondary / ghost 用 className

  const variantCls = variant === 'secondary'
      ? 'liquid-glass-thin text-secondary hover:text-primary'
    : variant === 'ghost'
      ? 'text-tertiary hover:text-primary hover:bg-white/[0.05]'
    : '';

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variantCls} ${className}`}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {loading ? <Spinner/> : icon}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>
  );
}
