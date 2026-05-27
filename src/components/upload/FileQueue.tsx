'use client';

import { FileItem } from '@/lib/types';
import { formatBytes, formatSpeed, formatEta } from '@/lib/utils';

interface Props {
  files:    FileItem[];
  onRemove: (id: string) => void;
  onCopy:   (url: string) => void;
}

const STATUS_CONFIG = {
  pending:   { label: '等待中', color: 'var(--text-tertiary)', tint: '' },
  uploading: { label: '上傳中', color: 'var(--tech-blue-300)', tint: 'liquid-tint-blue' },
  success:   { label: '已完成', color: 'var(--ios-green)',     tint: 'liquid-tint-green' },
  error:     { label: '失敗',   color: 'var(--ios-red)',       tint: 'liquid-tint-red' },
};

export default function FileQueue({ files, onRemove, onCopy }: Props) {
  if (!files.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 rounded-full" style={{
            background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))',
          }}/>
          <span className="font-display font-semibold text-[17px] tracking-tight">上傳佇列</span>
        </div>
        <span className="text-[13px] text-tertiary font-display">{files.length} 個檔案</span>
      </div>

      {files.map((f, idx) => {
        const cfg = STATUS_CONFIG[f.status];
        return (
          <div
            key={f.id}
            data-status={f.status}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up relative overflow-hidden"
          >
            <div className="relative flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-ios-md flex items-center justify-center text-lg flex-shrink-0 ${cfg.tint || 'liquid-glass-thin'}`}
                style={{ color: cfg.color }}
              >
                {getFileEmoji(f.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-display font-medium truncate flex-1 text-primary tracking-tight">
                    {f.name}
                  </span>
                  <span
                    className={`liquid-glass-thin ${cfg.tint} px-2.5 py-0.5 rounded-full text-[11px] font-display font-medium flex items-center gap-1.5 flex-shrink-0`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${f.status === 'uploading' ? 'animate-breathe' : ''}`}
                      style={{ background: cfg.color }}
                    />
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[13px] text-tertiary font-display">
                  <span>{formatBytes(f.size)}</span>
                  {f.status === 'uploading' && f.speed !== undefined && (
                    <>
                      <span className="text-quaternary">·</span>
                      <span style={{ color: cfg.color }} className="font-mono font-medium">
                        {formatSpeed(f.speed)}
                      </span>
                      {f.eta !== undefined && (
                        <>
                          <span className="text-quaternary">·</span>
                          <span>剩 {formatEta(f.eta)}</span>
                        </>
                      )}
                    </>
                  )}
                </div>

                {f.error && (
                  <p className="text-[13px] text-ios-red mt-1 font-display">{f.error}</p>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                {f.status === 'success' && f.downloadUrl && (
                  <button
                    onClick={() => onCopy(f.downloadUrl!)}
                    className="liquid-glass-thin liquid-tint-green px-3 py-1.5 rounded-full text-[12px] font-display font-medium liquid-hover"
                  >
                    複製連結
                  </button>
                )}
                {(f.status === 'pending' || f.status === 'error') && (
                  <button
                    onClick={() => onRemove(f.id)}
                    className="liquid-glass-thin w-8 h-8 rounded-full flex items-center justify-center text-tertiary liquid-hover"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 3L9 9M9 3L3 9" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {(f.status === 'uploading' || f.status === 'success') && (
              <div className="relative mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative"
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
                  <span className="text-quaternary">
                    {formatBytes(f.size * f.progress / 100)} / {formatBytes(f.size)}
                  </span>
                  <span className="font-semibold" style={{ color: cfg.color }}>
                    {f.progress}%
                  </span>
                </div>
              </div>
            )}

            {f.status === 'success' && f.downloadUrl && (
              <div className="mt-3 p-3 rounded-ios-md liquid-glass-thin liquid-tint-green">
                <div className="text-[10px] font-display font-medium text-ios-green mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-current" />
                  下載連結
                </div>
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-ios-green hover:underline break-all font-mono"
                >
                  {f.downloadUrl}
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith('video/'))       return '▶';
  if (mimeType.startsWith('audio/'))       return '♪';
  if (mimeType.startsWith('image/'))       return '◐';
  if (mimeType.includes('pdf'))            return '▤';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return '◇';
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return '▦';
  if (mimeType.includes('word') || mimeType.includes('text'))       return '▢';
  return '◯';
}
