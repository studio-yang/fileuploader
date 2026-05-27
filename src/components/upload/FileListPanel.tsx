'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '@/lib/utils';

interface FileEntry {
  key:         string;     // 用於 select / 後端 action
  name:        string;
  size:        number;
  downloadUrl: string;
  date?:       string;
  isFolder?:   boolean;
}

interface Props {
  provider: string;
  refresh:  number;
  isAdmin?: boolean;
}

type SortKey = 'date' | 'name' | 'size';
type View    = 'normal' | 'trash';

export default function FileListPanel({ provider, refresh, isAdmin = false }: Props) {
  const [files,     setFiles]     = useState<FileEntry[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState<string | null>(null);
  const [query,     setQuery]     = useState('');
  const [sortKey,   setSortKey]   = useState<SortKey>('date');
  const [view,      setView]      = useState<View>('normal');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [busy,      setBusy]      = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | { action: 'trash'|'permanent'|'restore'; ids: string[] }>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // 載入清單
  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    const url = `/api/files?provider=${provider}${view === 'trash' ? '&view=trash' : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const raw = data[provider] ?? [];
        setFiles(
          raw.map((f: any) => ({
            key:         provider === 'gdrive' ? f.id
                       : provider === 'github' ? String(f.id)
                       : f.name,
            name:        f.name,
            size:        Number(f.size) || 0,
            downloadUrl: f.downloadUrl,
            date:        f.updated ?? f.modifiedTime ?? f.createdAt,
            isFolder:    !!f.isFolder,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [provider, refresh, view, refreshTick]);

  // 篩選與排序
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
    return [...list].sort((a, b) => {
      // 資料夾永遠在前
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
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

  // 統計
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  // 選取邏輯
  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.key)));
  };
  const allChecked = filtered.length > 0 && selected.size === filtered.length;

  // 執行批次動作
  async function runAction(action: 'trash' | 'restore' | 'permanent', ids: string[]) {
    setBusy(true);
    try {
      const r = await fetch('/api/files/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, provider, ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        alert(`部分操作失敗：${JSON.stringify(j.failed ?? j.error)}`);
      }
    } catch (e: any) {
      alert(`操作失敗：${e?.message ?? 'unknown'}`);
    } finally {
      setBusy(false);
      setConfirmOpen(null);
      setSelected(new Set());
      setRefreshTick((n) => n + 1);
    }
  }

  // 是否顯示垃圾桶入口（normal 模式 + admin）
  const showTrashEntry = view === 'normal' && isAdmin;
  // 是否啟用 checkbox（admin）
  const showCheckbox = isAdmin;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 rounded-full" style={{
            background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))',
          }}/>
          <span className="font-display font-semibold text-[17px] tracking-tight">
            {view === 'trash' ? '垃圾桶' : '下載中心'}
          </span>
          {view === 'trash' && (
            <button
              onClick={() => { setView('normal'); setSelected(new Set()); }}
              className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display text-secondary hover:text-primary transition-colors"
            >
              ← 返回
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="liquid-glass-thin liquid-tint-blue rounded-full px-3 py-1 text-[12px] font-display font-medium">
            {files.length} 個項目
          </div>
          <div className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display font-medium text-secondary">
            {formatBytes(totalSize)}
          </div>
        </div>
      </div>

      {/* Search + sort + bulk actions */}
      {(files.length > 0 || showCheckbox) && (
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
              <button onClick={() => setQuery('')} className="text-quaternary hover:text-secondary transition-colors text-[12px]">✕</button>
            )}
          </div>

          {/* Sort */}
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
                  sortKey === s.id ? 'liquid-tint-blue' : 'text-tertiary hover:text-secondary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin bulk action bar */}
      {showCheckbox && filtered.length > 0 && (
        <div className="liquid-glass-thin rounded-ios-md px-3 py-2 flex items-center gap-3 animate-ios-fade">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-4 h-4 accent-tech-blue-500"
            />
            <span className="text-[12px] font-display text-secondary">
              {selected.size > 0 ? `已選 ${selected.size}` : '全選'}
            </span>
          </label>

          {selected.size > 0 && (
            <div className="flex gap-1.5 ml-auto">
              {view === 'normal' ? (
                <button
                  onClick={() => setConfirmOpen({ action: 'trash', ids: Array.from(selected) })}
                  disabled={busy}
                  className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
                >
                  🗑 移到垃圾桶
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setConfirmOpen({ action: 'restore', ids: Array.from(selected) })}
                    disabled={busy}
                    className="liquid-glass-thin liquid-tint-green px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
                  >
                    ↺ 還原
                  </button>
                  <button
                    onClick={() => setConfirmOpen({ action: 'permanent', ids: Array.from(selected) })}
                    disabled={busy}
                    className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
                  >
                    ✕ 永久刪除
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="liquid-glass rounded-ios-lg p-8 text-center animate-ios-fade">
          <div className="inline-flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-tech-blue-300 border-t-transparent animate-spin"
                 style={{ borderColor: 'var(--tech-blue-300)', borderTopColor: 'transparent' }}/>
            <span className="text-secondary text-[14px]">正在載入清單…</span>
          </div>
        </div>
      )}

      {/* 垃圾桶入口（normal + admin）— 永遠置頂 */}
      {showTrashEntry && !loading && (
        <button
          onClick={() => setView('trash')}
          className="w-full liquid-glass liquid-lensing rounded-ios-lg p-4 text-left transition-all hover:bg-white/[0.03] animate-ios-slide-up"
        >
          <div className="flex items-center gap-3">
            <div className="liquid-glass-thin liquid-tint-red w-12 h-12 rounded-ios-md flex items-center justify-center text-lg flex-shrink-0">
              🗑
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-display font-medium text-primary tracking-tight">
                垃圾桶
              </p>
              <p className="text-[12px] text-tertiary font-display mt-1">
                點此查看已刪除的檔案
              </p>
            </div>
            <span className="text-tertiary text-[16px]">›</span>
          </div>
        </button>
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
          <h3 className="text-[18px] font-display font-semibold text-primary mb-2">
            {view === 'trash' ? '垃圾桶是空的' : '此儲存體尚無檔案'}
          </h3>
          <p className="text-tertiary text-[14px] font-display">
            {view === 'trash' ? '已刪除的檔案會出現在這裡' : '切換到「上傳」分頁，開始放入你的第一份檔案'}
          </p>
        </div>
      )}

      {/* Empty search */}
      {!loading && files.length > 0 && filtered.length === 0 && (
        <div className="liquid-glass rounded-ios-lg text-center py-12 px-6 animate-ios-fade">
          <div className="text-3xl mb-3 opacity-30">🔍</div>
          <p className="text-secondary text-[14px] font-display">
            找不到符合「<span className="text-tech-blue font-medium">{query}</span>」的項目
          </p>
        </div>
      )}

      {/* File list */}
      {filtered.map((f, i) => (
        <div
          key={f.key}
          style={{ animationDelay: `${i * 40}ms` }}
          className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up group transition-all hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            {showCheckbox && (
              <input
                type="checkbox"
                checked={selected.has(f.key)}
                onChange={() => toggleOne(f.key)}
                className="w-4 h-4 accent-tech-blue-500 flex-shrink-0"
              />
            )}

            <div className={`liquid-glass-thin ${f.isFolder ? 'liquid-tint-orange' : getFileTint(f.name)} w-12 h-12 rounded-ios-md flex items-center justify-center text-lg flex-shrink-0`}>
              {f.isFolder ? '📁' : getFileEmoji(f.name)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-display font-medium truncate text-primary tracking-tight">
                {f.name}
              </p>
              <div className="flex items-center gap-2 text-[12px] text-tertiary font-display mt-1">
                {!f.isFolder && <span className="font-mono">{formatBytes(f.size)}</span>}
                {f.date && (
                  <>
                    {!f.isFolder && <span className="text-quaternary">·</span>}
                    <span>{formatDate(f.date)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions：資料夾沒下載按鈕 */}
            {!f.isFolder && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => copy(f.downloadUrl)}
                  className={`liquid-glass-thin px-3.5 py-2 rounded-full text-[12px] font-display font-medium liquid-hover transition-all ${
                    copied === f.downloadUrl ? 'liquid-tint-green' : ''
                  }`}
                  title="複製下載連結"
                >
                  {copied === f.downloadUrl ? '已複製' : '複製'}
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
                  下載
                </a>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 確認對話框 */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => !busy && setConfirmOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-md w-full space-y-4 animate-ios-pop"
          >
            <h3 className="font-display font-bold text-[17px] text-primary">
              {confirmOpen.action === 'trash'   && '確定移到垃圾桶？'}
              {confirmOpen.action === 'restore' && '確定還原這些項目？'}
              {confirmOpen.action === 'permanent' && '⚠ 永久刪除（無法復原）'}
            </h3>
            <p className="text-[13px] text-secondary font-display leading-relaxed">
              共 <span className="font-mono font-semibold text-primary">{confirmOpen.ids.length}</span> 個項目
              {confirmOpen.action === 'trash' && (
                <>
                  {provider === 'gdrive'  && '，將移到 Google Drive 垃圾桶（可從 Drive 介面救回）'}
                  {provider === 'gcs'     && '，將移到 GCS 內的「垃圾桶/」前綴'}
                  {provider === 'github'  && '，將以 _TRASH_ 前綴重新命名'}
                </>
              )}
              {confirmOpen.action === 'permanent' && '，徹底刪除後無法復原。'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmOpen(null)}
                disabled={busy}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => runAction(confirmOpen.action, confirmOpen.ids)}
                disabled={busy}
                className={`flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white disabled:opacity-50 ${
                  confirmOpen.action === 'permanent' ? 'bg-red-500' : confirmOpen.action === 'restore' ? 'bg-green-500' : 'bg-orange-500'
                }`}
                style={confirmOpen.action === 'trash' ? {
                  background: 'linear-gradient(135deg, #ff9500, #ff6a00)',
                  boxShadow:  '0 4px 14px rgba(255,149,0,0.40)',
                } : confirmOpen.action === 'permanent' ? {
                  background: 'linear-gradient(135deg, #ff453a, #d70015)',
                  boxShadow:  '0 4px 14px rgba(255,69,58,0.40)',
                } : {
                  background: 'linear-gradient(135deg, #30d158, #28a745)',
                  boxShadow:  '0 4px 14px rgba(48,209,88,0.40)',
                }}
              >
                {busy ? '處理中…' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
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
