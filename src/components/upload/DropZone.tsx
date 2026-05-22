'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { formatBytes } from '@/lib/utils';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export default function DropZone({ onFiles, disabled }: Props) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length) onFiles(accepted);
    setDragActive(false);
  }, [onFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    multiple: true,
  });

  const isActive = isDragActive || dragActive;

  return (
    <div
      {...getRootProps()}
      className={`
        relative cursor-pointer rounded-ios-xl overflow-hidden
        transition-all duration-500 select-none group liquid-lensing
        ${isActive ? 'liquid-glass-strong scale-[1.01]' : 'liquid-glass liquid-hover'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        min-h-[320px] flex flex-col items-center justify-center text-center p-12
      `}
    >
      <input {...getInputProps()} />

      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(46,125,255,0.25), transparent 60%)',
          }}
        />
      )}

      {/* Icon */}
      <div
        className={`
          relative w-20 h-20 rounded-ios-xl flex items-center justify-center mb-6
          transition-all duration-500
          ${isActive ? 'scale-110 animate-breathe' : 'group-hover:scale-105'}
        `}
        style={{
          background:
            'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
          boxShadow: isActive
            ? '0 12px 40px rgba(46,125,255,0.55), inset 0 1.5px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)'
            : '0 8px 24px rgba(46,125,255,0.40), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 24V8" />
          <path d="M9 15L16 8L23 15" />
          <path d="M6 24h20" opacity={isActive ? 1 : 0.6} />
        </svg>
      </div>

      <h3
        className="font-display font-bold text-[28px] mb-2 tracking-tight"
        style={{ color: isActive ? 'var(--tech-blue-200)' : 'var(--text-primary)' }}
      >
        {isActive ? '放開以選取' : '拖放檔案到這裡'}
      </h3>
      <p className="text-secondary text-[15px] mb-7 font-display">
        或點擊選取 · 支援多檔同時上傳
      </p>

      {/* File type pills */}
      <div className="flex gap-2 flex-wrap justify-center max-w-md">
        {[
          { label: '影片',   color: 'var(--ios-purple)' },
          { label: '壓縮包', color: 'var(--ios-orange)' },
          { label: '文件',   color: 'var(--tech-blue-300)' },
          { label: '圖片',   color: 'var(--ios-green)' },
          { label: '其他',   color: 'var(--ios-cyan)' },
        ].map((t) => (
          <span
            key={t.label}
            className="liquid-glass-thin px-3.5 py-1.5 rounded-full text-[13px] font-display font-medium flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
            <span className="text-secondary">{t.label}</span>
          </span>
        ))}
      </div>

      {/* Size hint */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 liquid-glass-thin px-3 py-1 rounded-full text-[11px] font-mono text-tertiary">
        最大 {formatBytes(5 * 1024 * 1024 * 1024)} / 檔
      </div>
    </div>
  );
}
