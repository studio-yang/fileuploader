'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { formatBytes } from '@/lib/utils';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export default function DropZone({ onFiles, disabled }: Props) {
  const t = useTranslations('dropzone');
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
        min-h-[200px] sm:min-h-[320px] flex flex-col items-center justify-center text-center p-6 sm:p-12
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
          relative w-14 h-14 sm:w-20 sm:h-20 rounded-ios-xl flex items-center justify-center mb-4 sm:mb-6
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
        className="font-display font-bold text-[20px] sm:text-[28px] mb-2 tracking-tight"
        style={{ color: isActive ? 'var(--tech-blue-200)' : 'var(--text-primary)' }}
      >
        {isActive ? t('dropActive') : t('dropIdle')}
      </h3>
      <p className="text-secondary text-[13px] sm:text-[15px] mb-4 sm:mb-7 font-display">
        {t('subtitle')}
      </p>

      {/* File type pills */}
      <div className="flex gap-2 flex-wrap justify-center max-w-md">
        {([
          { key: 'typeVideo'   as const, color: 'var(--ios-purple)' },
          { key: 'typeArchive' as const, color: 'var(--ios-orange)' },
          { key: 'typeDoc'     as const, color: 'var(--tech-blue-300)' },
          { key: 'typeImage'   as const, color: 'var(--ios-green)' },
          { key: 'typeOther'   as const, color: 'var(--ios-cyan)' },
        ]).map((item) => (
          <span
            key={item.key}
            className="liquid-glass-thin px-3.5 py-1.5 rounded-full text-[13px] font-display font-medium flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
            <span className="text-secondary">{t(item.key)}</span>
          </span>
        ))}
      </div>

      {/* Size hint */}
      <div className="mt-4 sm:mt-5 liquid-glass-thin px-3 py-1 rounded-full text-[11px] font-mono text-tertiary">
        {t('maxSize', { size: formatBytes(5 * 1024 * 1024 * 1024) })}
      </div>
    </div>
  );
}
