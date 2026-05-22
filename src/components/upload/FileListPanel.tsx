'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '@/lib/utils';

interface FileEntry {
  name:        string;
  size:        number;
  downloadUrl: string;
  date?:       string;
}

interface Props {
  provider: string;
  refresh:  number;
}

type SortKey = 'date' | 'name' | 'size';

export default function FileListPanel({ provider, refresh }: Props) {
  const [files,    setFiles]    = useState<FileEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState<string | null>(null);
  const [query,    setQuery]    = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('date');

  // 載入清單
  useEffect(() => {
    setLoading(true);
    fetch(`/api/files?provider=${provider}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = data[provider] ?? [];
        setFiles(
          raw.map((f: any) => ({
            name:        f.name,
            size:        Number(f.size) || 0,
            downloadUrl: f.downloadUrl,
            date:        f.updated ?? f.modifiedTime ?? f.createdAt,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [provider, refresh]);

  // 篩選與排序
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'size') return b.size - a.size;
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });
  }, [files, query, sortKey]);

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  // 統計總容量
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 rounded-full" style={{
            background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))',
          }}/>
          <span className="font-display font-semibold text-[17px] tracking-tight">
            下載中心
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="liquid-glass-thin liquid-tint-blue rounded-full px-3 py-1 text-[12px] font-display font-medium">
            {files.length} 個檔案
          </div>
          <div className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display font-medium text-secondary">
            {formatBytes(totalSize)}
          </div>
        </div>
      </div>

      {/* Search + sort bar */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap animate-ios-slide-up">
          <div className="liquid-glass-thin rounded-full px-4 py-2.5 flex items-center gap-2.5 flex-1 min-w-[200px]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-tertiary flex-shrink-0">
              <circle cx="6" cy="6" r="4.5"/>
              <path d="M9.5 9.5L12 12"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋檔名…"
              className="bg-transparent outline-none border-none text-[14px] font-display flex-1 text-primary placeholder:text-quaternary"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-quaternary hover:text-secondary transition-colors text-[12px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort buttons */}
          <div className="liquid-glass-thin rounded-full p-1 flex gap-0.5">
            {([
              { id: 'date', label: '時間' },
              { id: 'name', label: '名稱' },
              { id: 'size', label: '大小' },
            ] as { id: SortKey; label: string }[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSortKey(s.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-display font-medium transition-all duration-200 ${
                  sortKey === s.id
                    ? 'liquid-tint-blue'
                    : 'text-tertiary hover:text-secondary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="liquid-glass rounded-ios-lg p-8 text-center animate-ios-fade">
          <div className="inline-flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-tech-blue-300 border-t-transparent animate-spin"
                 style={{ borderColor: 'var(--tech-blue-300)', borderTopColor: 'transparent' }}/>
            <span className="text-secondary text-[14px]">正在載入檔案清單…</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && files.length === 0 && (
        <div className="liquid-glass liquid-lensing rounded-ios-2xl text-center py-20 px-6 animate-ios-fade">
          <div
            className="w-20 h-20 mx-auto mb-5 rounded-ios-xl liquid-glass-thin liquid-tint-blue flex items-center justify-center"
            style={{ boxShadow: '0 8px 24px rgba(46,125,255,0.20)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H7a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10z"/>
              <path d="M21 4v6h6"/>
            </svg>
          </div>
          <h3 className="text-[18px] font-display font-semibold text-primary mb-2">此儲存體尚無檔案</h3>
          <p className="text-tertiary text-[14px] font-display">切換到「上傳」分頁，開始放入你的第一份檔案</p>
        </div>
      )}

      {/* Empty search */}
      {!loading && files.length > 0 && filtered.length === 0 && (
        <div className="liquid-glass rounded-ios-lg text-center py-12 px-6 animate-ios-fade">
          <div className="text-3xl mb-3 opacity-30">🔍</div>
          <p className="text-secondary text-[14px] font-display">
            找不到符合「<span className="text-tech-blue font-medium">{query}</span>」的檔案
          </p>
        </div>
      )}

      {/* File list */}
      {filtered.map((f, i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 40}ms` }}
          className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up group transition-all hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            {/* File icon */}
            <div
              className={`liquid-glass-thin ${getFileTint(f.name)} w-12 h-12 rounded-ios-md flex items-center justify-center text-lg flex-shrink-0`}
            >
              {getFileEmoji(f.name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-display font-medium truncate text-primary tracking-tight">
                {f.name}
              </p>
              <div className="flex items-center gap-2 text-[12px] text-tertiary font-display mt-1">
                <span className="font-mono">{formatBytes(f.size)}</span>
                {f.date && (
                  <>
                    <span className="text-quaternary">·</span>
                    <span>{formatDate(f.date)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Primary actions（永遠顯示，不只 hover）*/}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => copy(f.downloadUrl)}
                className={`liquid-glass-thin px-3.5 py-2 rounded-full text-[12px] font-display font-medium liquid-hover transition-all ${
                  copied === f.downloadUrl ? 'liquid-tint-green' : ''
                }`}
                title="複製下載連結"
              >
                {copied === f.downloadUrl ? (
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 6L5 8.5L9.5 4"/>
                    </svg>
                    已複製
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="6" height="7" rx="1"/>
                      <path d="M5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6"/>
                    </svg>
                    複製
                  </span>
                )}
              </button>
              <a
                href={f.downloadUrl}
                download={f.name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full text-[12px] font-display font-semibold flex items-center gap-1.5 transition-all hover:scale-[1.03] liquid-lensing"
                style={{
                  background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
                }}
                title="下載檔案"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 1V8"/>
                  <path d="M3 5L6 8L9 5"/>
                  <path d="M2 10H10"/>
                </svg>
                下載
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 依副檔名給予顏色
function getFileTint(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4','mov','avi','mkv','webm'].includes(ext))       return 'liquid-tint-purple';
  if (['mp3','wav','flac','m4a','ogg'].includes(ext))       return 'liquid-tint-orange';
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext))return 'liquid-tint-green';
  if (['pdf'].includes(ext))                                return 'liquid-tint-red';
  if (['zip','tar','gz','rar','7z'].includes(ext))          return 'liquid-tint-orange';
  if (['doc','docx','txt','md'].includes(ext))              return 'liquid-tint-blue';
  if (['xls','xlsx','csv'].includes(ext))                   return 'liquid-tint-green';
  return 'liquid-tint-blue';
}

function getFileEmoji(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4','mov','avi','mkv','webm'].includes(ext))       return '▶';
  if (['mp3','wav','flac','m4a','ogg'].includes(ext))       return '♪';
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext))return '◐';
  if (['pdf'].includes(ext))                                return '▤';
  if (['zip','tar','gz','rar','7z'].includes(ext))          return '◇';
  if (['xls','xlsx','csv'].includes(ext))                   return '▦';
  if (['doc','docx','txt','md'].includes(ext))              return '▢';
  return '◯';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day)        return '今天';
  if (diff < 2 * day)    return '昨天';
  if (diff < 7 * day)    return `${Math.floor(diff / day)} 天前`;
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}
