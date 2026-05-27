'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileItem } from '@/lib/types';
import { formatBytes, formatSpeed, formatEta } from '@/lib/utils';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  files:      FileItem[];
  onRemove:   (id: string) => void;
  onCopy:     (url: string) => void;
  onReorder?: (newFiles: FileItem[]) => void;
}

interface CtxMenu {
  id: string; x: number; y: number;
  status: FileItem['status']; downloadUrl?: string;
}

export default function FileQueue({ files, onRemove, onCopy, onReorder }: Props) {
  const t = useTranslations('fileQueue');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const STATUS_CONFIG = {
    pending:   { label: t('statusPending'),   color: 'var(--text-tertiary)', tint: '' },
    uploading: { label: t('statusUploading'), color: 'var(--tech-blue-300)', tint: 'liquid-tint-blue' },
    success:   { label: t('statusSuccess'),   color: 'var(--ios-green)',     tint: 'liquid-tint-green' },
    error:     { label: t('statusError'),     color: 'var(--ios-red)',       tint: 'liquid-tint-red' },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = files.findIndex((f) => f.id === active.id);
      const newIdx = files.findIndex((f) => f.id === over.id);
      onReorder?.(arrayMove(files, oldIdx, newIdx));
    }
  }

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctxMenu]);

  if (!files.length) return null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <span className="w-1 h-5 rounded-full" style={{
                background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))',
              }}/>
              <span className="font-display font-semibold text-[17px] tracking-tight">{t('title')}</span>
            </div>
            <span className="text-[13px] text-tertiary font-display">{t('fileCount', { count: files.length })}</span>
          </div>

          <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {files.map((f, idx) => (
              <SortableRow
                key={f.id}
                f={f}
                idx={idx}
                statusConfig={STATUS_CONFIG}
                t={t}
                onRemove={onRemove}
                onCopy={onCopy}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ id: f.id, x: e.clientX, y: e.clientY, status: f.status, downloadUrl: f.downloadUrl });
                }}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {/* 右鍵選單 */}
      {ctxMenu && (
        <div
          className="fixed z-[9999] liquid-glass-strong rounded-ios-md py-1 min-w-[160px] animate-ios-pop"
          style={{ left: ctxMenu.x, top: ctxMenu.y, boxShadow: '0 12px 32px rgba(0,0,0,0.50)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.status === 'success' && ctxMenu.downloadUrl && (
            <CtxItem icon="⎘" label={t('ctxCopyLink')} onClick={() => { onCopy(ctxMenu.downloadUrl!); setCtxMenu(null); }} />
          )}
          {(ctxMenu.status === 'pending' || ctxMenu.status === 'error') && (
            <CtxItem icon="✕" label={t('ctxRemove')} danger onClick={() => { onRemove(ctxMenu.id); setCtxMenu(null); }} />
          )}
          {ctxMenu.status === 'uploading' && (
            <CtxItem icon="⌛" label={t('ctxUploading')} onClick={() => setCtxMenu(null)} />
          )}
        </div>
      )}
    </>
  );
}

/* ── 可拖曳列 ── */
type StatusConfig = Record<FileItem['status'], { label: string; color: string; tint: string }>;

function SortableRow({ f, idx, statusConfig, t, onRemove, onCopy, onContextMenu }: {
  f: FileItem; idx: number;
  statusConfig: StatusConfig;
  t: ReturnType<typeof useTranslations<'fileQueue'>>;
  onRemove: (id: string) => void;
  onCopy:   (url: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: f.id });
  const cfg = statusConfig[f.status];

  return (
    <div
      ref={setNodeRef}
      data-status={f.status}
      onContextMenu={onContextMenu}
      style={{
        animationDelay: `${idx * 60}ms`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex:  isDragging ? 50 : undefined,
      }}
      className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up relative overflow-hidden"
    >
      <div className="relative flex items-start gap-3">

        {/* 拖曳把手（僅等待中） */}
        {f.status === 'pending' && (
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-2 cursor-grab active:cursor-grabbing text-quaternary hover:text-tertiary touch-none select-none"
            title={t('dragHandle')}
            aria-label={t('dragHandle')}
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="2.5" cy="2.5"  r="1.5"/><circle cx="7.5" cy="2.5"  r="1.5"/>
              <circle cx="2.5" cy="7"    r="1.5"/><circle cx="7.5" cy="7"    r="1.5"/>
              <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
            </svg>
          </button>
        )}

        <div
          className={`w-11 h-11 rounded-ios-md flex items-center justify-center text-lg flex-shrink-0 ${cfg.tint || 'liquid-glass-thin'}`}
          style={{ color: cfg.color }}
        >
          {getFileEmoji(f.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[15px] font-display font-medium truncate flex-1 text-primary tracking-tight"
              title={f.name}
            >
              {f.name}
            </span>
            <span className={`liquid-glass-thin ${cfg.tint} px-2.5 py-0.5 rounded-full text-[11px] font-display font-medium flex items-center gap-1.5 flex-shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${f.status === 'uploading' ? 'animate-breathe' : ''}`} style={{ background: cfg.color }}/>
              {cfg.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-tertiary font-display">
            <span>{formatBytes(f.size)}</span>
            {f.status === 'uploading' && f.speed !== undefined && (
              <>
                <span className="text-quaternary">·</span>
                <span style={{ color: cfg.color }} className="font-mono font-medium">{formatSpeed(f.speed)}</span>
                {f.eta !== undefined && (
                  <><span className="text-quaternary">·</span><span>{t('etaRemaining', { eta: formatEta(f.eta) })}</span></>
                )}
              </>
            )}
          </div>
          {f.error && <p className="text-[13px] text-ios-red mt-1 font-display">{f.error}</p>}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {f.status === 'success' && f.downloadUrl && (
            <button
              onClick={() => onCopy(f.downloadUrl!)}
              className="liquid-glass-thin liquid-tint-green px-3 py-1.5 rounded-full text-[12px] font-display font-medium liquid-hover"
            >
              {t('copyLink')}
            </button>
          )}
          {(f.status === 'pending' || f.status === 'error') && (
            <button
              onClick={() => onRemove(f.id)}
              className="liquid-glass-thin w-8 h-8 rounded-full flex items-center justify-center text-tertiary liquid-hover"
              aria-label={t('remove')}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3L9 9M9 3L3 9"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {(f.status === 'uploading' || f.status === 'success') && (
        <div className="relative mt-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${f.progress}%`,
                background: f.status === 'success'
                  ? 'linear-gradient(90deg, var(--ios-green), var(--ios-mint))'
                  : 'linear-gradient(90deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                backgroundSize: '200% 100%',
                animation: f.status === 'uploading' ? 'shimmerGlass 2.5s ease-in-out infinite' : 'none',
                boxShadow: `0 2px 12px ${f.status === 'success' ? 'rgba(48,209,88,0.45)' : 'rgba(10,132,255,0.50)'}`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-display mt-1.5">
            <span className="text-quaternary">{formatBytes(f.size * f.progress / 100)} / {formatBytes(f.size)}</span>
            <span className="font-semibold" style={{ color: cfg.color }}>{f.progress}%</span>
          </div>
        </div>
      )}

      {f.status === 'success' && f.downloadUrl && (
        <div className="mt-3 p-3 rounded-ios-md liquid-glass-thin liquid-tint-green">
          <div className="text-[10px] font-display font-medium text-ios-green mb-1 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-1 h-1 rounded-full bg-current"/> {t('downloadLink')}
          </div>
          <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
            className="text-[12px] text-ios-green hover:underline break-all font-mono">
            {f.downloadUrl}
          </a>
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-[13px] font-display font-medium hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 ${danger ? 'text-ios-red' : 'text-primary'}`}
    >
      <span className="text-[12px]">{icon}</span>{label}
    </button>
  );
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith('video/'))   return '▶';
  if (mimeType.startsWith('audio/'))   return '♪';
  if (mimeType.startsWith('image/'))   return '◐';
  if (mimeType.includes('pdf'))        return '▤';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return '◇';
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return '▦';
  if (mimeType.includes('word') || mimeType.includes('text')) return '▢';
  return '◯';
}
