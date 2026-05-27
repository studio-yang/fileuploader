'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import {
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet,
  File as FileIcon, FileType, Folder, Trash2, RotateCcw, X, Copy, Check, Download,
  Search, ChevronUp, ChevronDown, ArrowUpDown,
} from 'lucide-react';

interface FileEntry {
  key:         string;
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
  onGoUpload?: () => void;   // A6: Empty state CTA
}

type SortKey = 'date' | 'name' | 'size';
type SortDir = 'asc' | 'desc';
type View    = 'normal' | 'trash';

export default function FileListPanel({ provider, refresh, isAdmin = false, onGoUpload }: Props) {
  const toast = useToast();
  const [files,       setFiles]       = useState<FileEntry[]>([]);
  const [trashCount,  setTrashCount]  = useState<number>(0);  // A3
  const [loading,     setLoading]     = useState(false);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [query,       setQuery]       = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('date');
  const [sortDir,     setSortDir]     = useState<SortDir>('desc');  // A2
  const [view,        setView]        = useState<View>('normal');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [busy,        setBusy]        = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | { action: 'trash'|'permanent'|'restore'; ids: string[] }>(null);
  const [confirmText, setConfirmText] = useState('');
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

  // A3: 在 normal 模式時同步抓垃圾桶筆數
  useEffect(() => {
    if (view === 'normal' && isAdmin) {
      fetch(`/api/files?provider=${provider}&view=trash`)
        .then((r) => r.json())
        .then((data) => setTrashCount((data[provider] ?? []).length))
        .catch(() => setTrashCount(0));
    }
  }, [provider, view, isAdmin, refreshTick]);

  // 篩選與排序（A2：支援方向反轉）
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * sign;
      if (sortKey === 'size') return (a.size - b.size) * sign;
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return (ad - bd) * sign;
    });
  }, [files, query, sortKey, sortDir]);

  // A9: 複製動畫（pulse effect via state）
  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    toast.success('連結已複製');
    setTimeout(() => setCopied(null), 1800);
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

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

  // 切換排序方向
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  async function runAction(action: 'trash' | 'restore' | 'permanent', ids: string[]) {
    setBusy(true);
    let success = false;
    try {
      const r = await fetch('/api/files/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, provider, ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        toast.error(`部分操作失敗：${j.error ?? `${j.failed?.length ?? '?'} 個項目`}`);
      } else {
        success = true;
        if (action === 'trash') {
          toast.undo(`已移到垃圾桶 · ${ids.length} 個項目`, async () => {
            await fetch('/api/files/action', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'restore', provider, ids }),
            }).catch(() => {});
            setRefreshTick((n) => n + 1);
            toast.success('已復原');
          });
        } else if (action === 'restore') {
          toast.success(`已還原 ${ids.length} 個項目`);
        } else if (action === 'permanent') {
          toast.success(`已永久刪除 ${ids.length} 個項目`);
        }
      }
    } catch (e: any) {
      toast.error(`操作失敗：${e?.message ?? 'unknown'}`);
    } finally {
      setBusy(false);
      setConfirmOpen(null);
      setConfirmText('');
      setSelected(new Set());
      if (success) setRefreshTick((n) => n + 1);
    }
  }

  const showTrashEntry = view === 'normal' && isAdmin;
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
            <Search size={14} className="text-tertiary flex-shrink-0" strokeWidth={1.8}/>
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

          {/* A2: Sort + 方向箭頭 */}
          <div className="liquid-glass-thin rounded-full p-1 flex gap-0.5">
            {([
              { id: 'date', label: '時間' },
              { id: 'name', label: '名稱' },
              { id: 'size', label: '大小' },
            ] as { id: SortKey; label: string }[]).map((s) => {
              const active = sortKey === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSort(s.id)}
                  title={active ? `點擊切換 ${sortDir === 'asc' ? '降冪' : '升冪'}` : `依 ${s.label} 排序`}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-display font-medium transition-all duration-200 flex items-center gap-1 ${
                    active ? 'liquid-tint-blue' : 'text-tertiary hover:text-secondary'
                  }`}
                >
                  {s.label}
                  {active
                    ? (sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>)
                    : <ArrowUpDown size={10} className="opacity-40"/>
                  }
                </button>
              );
            })}
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
                  className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 size={12}/> 移到垃圾桶
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setConfirmOpen({ action: 'restore', ids: Array.from(selected) })}
                    disabled={busy}
                    className="liquid-glass-thin liquid-tint-green px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RotateCcw size={12}/> 還原
                  </button>
                  <button
                    onClick={() => setConfirmOpen({ action: 'permanent', ids: Array.from(selected) })}
                    disabled={busy}
                    className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <X size={12}/> 永久刪除
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* A7: Loading skeleton */}
      {loading && (
        <div className="space-y-2 animate-ios-fade">
          {[0,1,2].map((i) => (
            <div key={i} className="liquid-glass rounded-ios-lg p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-ios-md bg-white/[0.04] animate-pulse"/>
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/[0.04] rounded animate-pulse" style={{ width: `${60 + i*10}%` }}/>
                <div className="h-2.5 bg-white/[0.03] rounded animate-pulse w-1/4"/>
              </div>
              <div className="w-20 h-8 bg-white/[0.03] rounded-full animate-pulse"/>
            </div>
          ))}
        </div>
      )}

      {/* A3: 垃圾桶入口（含項目數 badge） */}
      {showTrashEntry && !loading && (
        <button
          onClick={() => setView('trash')}
          className="w-full liquid-glass liquid-lensing rounded-ios-lg p-4 text-left transition-all hover:-translate-y-px hover:shadow-lg animate-ios-slide-up"
        >
          <div className="flex items-center gap-3">
            <div className="liquid-glass-thin liquid-tint-red w-12 h-12 rounded-ios-md flex items-center justify-center flex-shrink-0">
              <Trash2 size={20} className="text-red-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-display font-medium text-primary tracking-tight">
                垃圾桶
              </p>
              <p className="text-[12px] text-tertiary font-display mt-1">
                {trashCount > 0 ? `${trashCount} 個項目可還原或永久刪除` : '尚無已刪除的檔案'}
              </p>
            </div>
            {trashCount > 0 && (
              <div className="liquid-glass-thin liquid-tint-red rounded-full px-2.5 py-1 text-[11px] font-mono font-bold text-red-300">
                {trashCount}
              </div>
            )}
            <span className="text-tertiary text-[16px]">›</span>
          </div>
        </button>
      )}

      {/* Empty state — A6: 加 CTA */}
      {!loading && files.length === 0 && (
        <div className="liquid-glass liquid-lensing rounded-ios-2xl text-center py-16 px-6 animate-ios-fade">
          <div
            className="w-20 h-20 mx-auto mb-5 rounded-ios-xl liquid-glass-thin liquid-tint-blue flex items-center justify-center"
            style={{ boxShadow: '0 8px 24px rgba(46,125,255,0.20)' }}
          >
            {view === 'trash'
              ? <Trash2 size={32} className="text-tech-blue-300"/>
              : <FileIcon size={32} className="text-tech-blue-300"/>}
          </div>
          <h3 className="text-[18px] font-display font-semibold text-primary mb-2">
            {view === 'trash' ? '垃圾桶是空的' : '此儲存體尚無檔案'}
          </h3>
          <p className="text-tertiary text-[14px] font-display mb-5">
            {view === 'trash' ? '已刪除的檔案會出現在這裡' : '把第一份檔案放上來開始使用吧'}
          </p>
          {view === 'normal' && onGoUpload && (
            <button
              onClick={onGoUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display font-semibold text-[13px] text-white transition-all hover:scale-[1.05] hover:-translate-y-px"
              style={{
                background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                boxShadow:  '0 6px 20px rgba(10,132,255,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
              }}
            >
              <Download size={14} style={{ transform: 'rotate(180deg)' }}/>
              立刻上傳第一個檔案
            </button>
          )}
        </div>
      )}

      {/* Empty search */}
      {!loading && files.length > 0 && filtered.length === 0 && (
        <div className="liquid-glass rounded-ios-lg text-center py-12 px-6 animate-ios-fade">
          <Search size={28} className="mx-auto mb-3 text-quaternary"/>
          <p className="text-secondary text-[14px] font-display">
            找不到符合「<span className="text-tech-blue font-medium">{query}</span>」的項目
          </p>
        </div>
      )}

      {/* File list */}
      {!loading && filtered.map((f, i) => (
        <div
          key={f.key}
          style={{ animationDelay: `${i * 40}ms` }}
          className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up group transition-all hover:-translate-y-px hover:shadow-lg hover:bg-white/[0.03]"
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

            {/* A1: lucide-react 具象 icon */}
            <div className={`liquid-glass-thin ${f.isFolder ? 'liquid-tint-orange' : getFileTint(f.name)} w-12 h-12 rounded-ios-md flex items-center justify-center flex-shrink-0`}>
              <FileIconRender name={f.name} isFolder={!!f.isFolder} />
            </div>

            <div className="flex-1 min-w-0">
              {/* A8: 長檔名 tooltip */}
              <p
                className="text-[15px] font-display font-medium truncate text-primary tracking-tight"
                title={f.name}
              >
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

            {!f.isFolder && (
              <div className="flex gap-2 flex-shrink-0">
                {/* A9: 複製成功 pulse 動畫 */}
                <button
                  onClick={() => copy(f.downloadUrl)}
                  className={`liquid-glass-thin px-3.5 py-2 rounded-full text-[12px] font-display font-medium transition-all hover:-translate-y-px flex items-center gap-1.5 ${
                    copied === f.downloadUrl ? 'liquid-tint-green animate-pulse-once' : ''
                  }`}
                  title="複製下載連結"
                >
                  {copied === f.downloadUrl ? <Check size={12}/> : <Copy size={12}/>}
                  {copied === f.downloadUrl ? '已複製' : '複製'}
                </button>
                <a
                  href={f.downloadUrl}
                  download={f.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-full text-[12px] font-display font-semibold flex items-center gap-1.5 transition-all hover:scale-[1.05] hover:-translate-y-px"
                  style={{
                    background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
                  }}
                  title="下載檔案"
                >
                  <Download size={12}/> 下載
                </a>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* A5: 確認對話框（文案重寫，更友善）*/}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => !busy && (setConfirmOpen(null), setConfirmText(''))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-md w-full space-y-4 animate-ios-pop"
          >
            <h3 className="font-display font-bold text-[17px] text-primary flex items-center gap-2">
              {confirmOpen.action === 'trash'   && <><Trash2 size={18} className="text-orange-400"/> 移到垃圾桶？</>}
              {confirmOpen.action === 'restore' && <><RotateCcw size={18} className="text-green-400"/> 還原 {confirmOpen.ids.length} 個項目？</>}
              {confirmOpen.action === 'permanent' && <><X size={18} className="text-red-400"/> 永久刪除（無法復原）</>}
            </h3>
            <p className="text-[13px] text-secondary font-display leading-relaxed">
              {confirmOpen.action === 'trash' && (
                <>將 <span className="font-mono font-semibold text-primary">{confirmOpen.ids.length}</span> 個項目移到垃圾桶，隨時可以從垃圾桶還原回來。
                  {provider === 'gdrive' && '（同步顯示在 Google Drive 的垃圾桶內）'}
                </>
              )}
              {confirmOpen.action === 'restore' && (
                <>將這 <span className="font-mono font-semibold text-primary">{confirmOpen.ids.length}</span> 個項目放回原本的位置。</>
              )}
              {confirmOpen.action === 'permanent' && (
                <>這 <span className="font-mono font-semibold text-red-300">{confirmOpen.ids.length}</span> 個項目會從伺服器徹底消失，<span className="font-semibold text-red-300">無法復原</span>。</>
              )}
            </p>

            {confirmOpen.action === 'permanent' && (
              <div className="space-y-2">
                <p className="text-[12px] font-display text-tertiary">
                  請輸入 <span className="font-mono font-semibold text-red-400">刪除</span> 確認：
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                  className="w-full liquid-glass-thin rounded-ios-md py-2 px-3 text-[14px] font-display text-primary outline-none"
                  placeholder="刪除"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setConfirmOpen(null); setConfirmText(''); }}
                disabled={busy}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => runAction(confirmOpen.action, confirmOpen.ids)}
                disabled={busy || (confirmOpen.action === 'permanent' && confirmText !== '刪除')}
                className="flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
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
                {busy ? '處理中…' : confirmOpen.action === 'permanent' ? '永久刪除' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A1: lucide-react 具象 icon 對應
function FileIconRender({ name, isFolder }: { name: string; isFolder: boolean }) {
  if (isFolder) return <Folder size={20} className="text-orange-300"/>;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const cls = 'text-tech-blue-300';
  if (['mp4','mov','avi','mkv','webm'].includes(ext))       return <FileVideo size={20} className="text-purple-300"/>;
  if (['mp3','wav','flac','m4a','ogg'].includes(ext))       return <FileAudio size={20} className="text-orange-300"/>;
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext))return <FileImage size={20} className="text-green-300"/>;
  if (['pdf'].includes(ext))                                return <FileType  size={20} className="text-red-300"/>;
  if (['zip','tar','gz','rar','7z'].includes(ext))          return <FileArchive size={20} className="text-orange-300"/>;
  if (['xls','xlsx','csv'].includes(ext))                   return <FileSpreadsheet size={20} className="text-green-300"/>;
  if (['doc','docx','txt','md'].includes(ext))              return <FileText size={20} className={cls}/>;
  return <FileIcon size={20} className={cls}/>;
}

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
