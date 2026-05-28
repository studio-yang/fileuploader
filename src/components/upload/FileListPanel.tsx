'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import emptyFolderAnimation from '../../../public/lottie/empty-folder.json';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/components/I18nProvider';
import { formatBytes } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { PackModal } from '@/components/PackModal';
import {
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet,
  File as FileIcon, FileType, Folder, Trash2, RotateCcw, X, Copy, Check, Download,
  Search, ChevronUp, ChevronDown, ArrowUpDown, Pin, PinOff, Share2,
  LayoutGrid, LayoutList, Package,
} from 'lucide-react';
import QRCode from 'qrcode';

interface FileEntry {
  key:         string;
  name:        string;
  size:        number;
  downloadUrl: string;
  date?:       string;
  isFolder?:   boolean;
}

interface Props {
  provider:    string;
  refresh:     number;
  isAdmin?:    boolean;
  onGoUpload?: () => void;
}

type SortKey  = 'date' | 'name' | 'size';
type SortDir  = 'asc'  | 'desc';
type PanelView = 'normal' | 'trash';
type DisplayMode = 'list' | 'grid';

interface CtxMenu { key: string; name: string; downloadUrl: string; x: number; y: number; isPinned: boolean; }

/* ── localStorage helpers（SSR-safe） ── */
function loadPinned(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try { return new Set(JSON.parse(localStorage.getItem('fl:pinned') ?? '[]')); } catch { return new Set(); }
}
function savePinned(s: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fl:pinned', JSON.stringify(Array.from(s)));
}

export default function FileListPanel({ provider, refresh, isAdmin = false, onGoUpload }: Props) {
  const t     = useTranslations('fileList');
  const tToast = useTranslations('toast');
  const { locale } = useLocale();
  const toast = useToast();
  const [files,       setFiles]       = useState<FileEntry[]>([]);
  const [trashCount,  setTrashCount]  = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [query,       setQuery]       = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('date');
  const [sortDir,     setSortDir]     = useState<SortDir>('desc');
  const [view,        setView]        = useState<PanelView>('normal');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [busy,        setBusy]        = useState(false);
  const [confirmOpen, setConfirmOpen] = useState<null | { action: 'trash'|'permanent'|'restore'; ids: string[] }>(null);
  const [confirmText, setConfirmText] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  /* #11 Pin */
  const [pinned,      setPinned]      = useState<Set<string>>(loadPinned);
  /* #19 Grid view */
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  /* #14 Share dialog */
  const [shareFile,   setShareFile]   = useState<FileEntry | null>(null);
  const [qrDataUrl,   setQrDataUrl]   = useState('');
  /* Right-click */
  const [ctxMenu,     setCtxMenu]     = useState<CtxMenu | null>(null);

  /* #3 Auto-sync 每 30 秒靜默重新載入（不閃爍、不清空已選）*/
  const isAutoRefreshRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      isAutoRefreshRef.current = true;
      setRefreshTick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  /* 載入清單 */
  useEffect(() => {
    const isAuto = isAutoRefreshRef.current;
    isAutoRefreshRef.current = false;
    if (!isAuto) {
      setLoading(true);
      setSelected(new Set());
    }
    const url = `/api/files?provider=${provider}${view === 'trash' ? '&view=trash' : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const raw = data[provider] ?? [];
        const newFiles: FileEntry[] = raw.map((f: any) => ({
          key:         provider === 'gdrive' ? f.id : provider === 'github' ? String(f.id) : f.name,
          name:        f.name,
          size:        Number(f.size) || 0,
          downloadUrl: f.downloadUrl,
          date:        f.updated ?? f.modifiedTime ?? f.createdAt,
          isFolder:    !!f.isFolder,
        }));
        // 若內容相同就不更新（避免 React re-render 動畫重播）
        setFiles((prev) => {
          if (prev.length === newFiles.length && prev.every((p, i) => p.key === newFiles[i].key && p.size === newFiles[i].size)) {
            return prev;
          }
          return newFiles;
        });
        if (isAuto) {
          // 自動重整：只移除已不存在的選取，不清空
          setSelected((prev) => {
            const valid = new Set(newFiles.map((f) => f.key));
            let changed = false;
            const next = new Set<string>();
            Array.from(prev).forEach((k) => {
              if (valid.has(k)) next.add(k);
              else changed = true;
            });
            return changed ? next : prev;
          });
        }
      })
      .catch(console.error)
      .finally(() => { if (!isAuto) setLoading(false); });
  }, [provider, refresh, view, refreshTick]);

  /* 垃圾桶筆數 */
  useEffect(() => {
    if (view === 'normal' && isAdmin) {
      fetch(`/api/files?provider=${provider}&view=trash`)
        .then((r) => r.json())
        .then((data) => setTrashCount((data[provider] ?? []).length))
        .catch(() => setTrashCount(0));
    }
  }, [provider, view, isAdmin, refreshTick]);

  /* #14 QR code 產生 */
  useEffect(() => {
    if (!shareFile) { setQrDataUrl(''); return; }
    QRCode.toDataURL(shareFile.downloadUrl, { width: 200, margin: 2, color: { dark: '#ffffff', light: '#00000000' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [shareFile]);

  /* 右鍵關閉 */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctxMenu]);

  /* 篩選+排序（#11 pinned 優先） */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const ap = pinned.has(a.key), bp = pinned.has(b.key);
      if (ap && !bp) return -1;
      if (!ap && bp) return  1;
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return  1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * sign;
      if (sortKey === 'size') return (a.size - b.size) * sign;
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return (ad - bd) * sign;
    });
  }, [files, query, sortKey, sortDir, pinned]);

  /* B1: Keyboard shortcuts */
  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !confirmOpen) {
        e.preventDefault();
        setSelected(new Set(filtered.map((f) => f.key)));
      }
      if (e.key === 'Delete' && selected.size > 0 && !confirmOpen) {
        e.preventDefault();
        setConfirmOpen({ action: view === 'trash' ? 'permanent' : 'trash', ids: Array.from(selected) });
      }
      if (e.key === 'Escape') {
        if (confirmOpen) { setConfirmOpen(null); setConfirmText(''); }
        else if (selected.size > 0) setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin, filtered, selected, view, confirmOpen]);

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    toast.success(tToast('linkCopied'));
    setTimeout(() => setCopied(null), 1800);
  };

  /* #11 pin 切換 */
  const togglePin = (key: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      savePinned(next);
      return next;
    });
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const toggleOne = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.key)));
  };
  const allChecked = filtered.length > 0 && selected.size === filtered.length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
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
          toast.undo(tToast('movedToTrash', { count: ids.length }), async () => {
            await fetch('/api/files/action', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'restore', provider, ids }),
            }).catch(() => {});
            setRefreshTick((n) => n + 1);
            toast.success(tToast('undoRestored'));
          });
          /* #15 Audit log */
          fetch('/api/audit/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'trash', details: { provider, count: ids.length } }) }).catch(() => {});
        } else if (action === 'restore') {
          toast.success(tToast('restoredCount', { count: ids.length }));
        } else if (action === 'permanent') {
          toast.success(tToast('deletedCount', { count: ids.length }));
          fetch('/api/audit/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'permanent_delete', details: { provider, count: ids.length } }) }).catch(() => {});
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

  const showTrashEntry  = view === 'normal' && isAdmin;
  const showCheckbox    = true;                   // 打包功能：所有登入使用者皆可勾選
  const [packOpen, setPackOpen] = useState(false);

  const confirmDeleteWord = t('confirmDeleteWord');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))' }}/>
          <span className="font-display font-semibold text-[17px] tracking-tight">
            {view === 'trash' ? t('trashTitle') : t('title')}
          </span>
          {view === 'trash' && (
            <button onClick={() => { setView('normal'); setSelected(new Set()); }}
              className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display text-secondary hover:text-primary transition-colors">
              {t('back')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* #19 Grid/List toggle */}
          <button
            onClick={() => setDisplayMode((m) => m === 'list' ? 'grid' : 'list')}
            className="liquid-glass-thin rounded-full p-2 text-tertiary hover:text-primary transition-colors"
            title={displayMode === 'list' ? t('gridView') : t('listView')}
          >
            {displayMode === 'list' ? <LayoutGrid size={14}/> : <LayoutList size={14}/>}
          </button>
          <div className="liquid-glass-thin liquid-tint-blue rounded-full px-3 py-1 text-[12px] font-display font-medium">
            {t('itemCount', { count: files.length })}
          </div>
          <div className="liquid-glass-thin rounded-full px-3 py-1 text-[12px] font-display font-medium text-secondary">
            {formatBytes(totalSize)}
          </div>
        </div>
      </div>

      {/* Search + sort */}
      {(files.length > 0 || showCheckbox) && (
        <div className="flex gap-2 flex-wrap animate-ios-slide-up">
          <div className="liquid-glass-thin rounded-full px-4 py-2.5 flex items-center gap-2.5 flex-1 min-w-[180px]">
            <Search size={14} className="text-tertiary flex-shrink-0" strokeWidth={1.8}/>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="bg-transparent outline-none border-none text-[14px] font-display flex-1 text-primary placeholder:text-quaternary"/>
            {query && <button onClick={() => setQuery('')} aria-label="clear" className="text-quaternary hover:text-secondary text-[12px]">✕</button>}
          </div>
          <div className="liquid-glass-thin rounded-full p-1 flex gap-0.5">
            {([
              { id: 'date', label: t('sortDate') },
              { id: 'name', label: t('sortName') },
              { id: 'size', label: t('sortSize') },
            ] as { id: SortKey; label: string }[]).map((s) => {
              const active = sortKey === s.id;
              return (
                <button key={s.id} onClick={() => handleSort(s.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-display font-medium transition-all flex items-center gap-1 ${active ? 'liquid-tint-blue' : 'text-tertiary hover:text-secondary'}`}>
                  {s.label}
                  {active
                    ? (sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>)
                    : <ArrowUpDown size={10} className="opacity-40"/>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin bulk actions */}
      {showCheckbox && filtered.length > 0 && (
        <div className="liquid-glass-thin rounded-ios-md px-3 py-2 flex items-center gap-3 animate-ios-fade">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label={allChecked ? t('selectAll') : t('selectAll')} className="w-4 h-4 accent-tech-blue-500"/>
            <span className="text-[12px] font-display text-secondary">{selected.size > 0 ? t('selectedCount', { count: selected.size }) : t('selectAll')}</span>
          </label>
          <span className="text-[11px] font-display text-quaternary hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-[10px]">Ctrl+A</kbd> {t('selectAll')} ·
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-[10px] ml-1">Del</kbd> {t('permanentDelete')} ·
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-[10px] ml-1">Esc</kbd> {t('confirmCancel')}
          </span>
          {selected.size > 0 && (
            <div className="flex gap-1.5 ml-auto">
              {/* 打包下載（所有使用者，僅 normal 模式，僅選非資料夾時可用）*/}
              {view === 'normal' && (
                <button onClick={() => setPackOpen(true)} disabled={busy}
                  className="liquid-glass-thin liquid-tint-blue px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50 flex items-center gap-1.5">
                  <Package size={12}/> 打包下載壓縮檔
                </button>
              )}
              {view === 'normal' && isAdmin ? (
                <button onClick={() => setConfirmOpen({ action: 'trash', ids: Array.from(selected) })} disabled={busy}
                  className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50 flex items-center gap-1.5">
                  <Trash2 size={12}/> {t('moveToTrash')}
                </button>
              ) : view === 'trash' && isAdmin ? (
                <>
                  <button onClick={() => setConfirmOpen({ action: 'restore', ids: Array.from(selected) })} disabled={busy}
                    className="liquid-glass-thin liquid-tint-green px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50 flex items-center gap-1.5">
                    <RotateCcw size={12}/> {t('restore')}
                  </button>
                  <button onClick={() => setConfirmOpen({ action: 'permanent', ids: Array.from(selected) })} disabled={busy}
                    className="liquid-glass-thin liquid-tint-red px-3 py-1.5 rounded-full text-[12px] font-display font-semibold transition-all hover:scale-[1.03] disabled:opacity-50 flex items-center gap-1.5">
                    <X size={12}/> {t('permanentDelete')}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* #10 Shimmer skeleton */}
      {loading && (
        <div className="space-y-2 animate-ios-fade">
          {[0,1,2].map((i) => (
            <div key={i} className="liquid-glass rounded-ios-lg p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-ios-md shimmer"/>
              <div className="flex-1 space-y-2">
                <div className="h-3.5 shimmer rounded-full" style={{ width: `${60 + i * 10}%` }}/>
                <div className="h-2.5 shimmer rounded-full w-1/4"/>
              </div>
              <div className="w-20 h-8 shimmer rounded-full"/>
            </div>
          ))}
        </div>
      )}

      {/* 垃圾桶入口 */}
      {showTrashEntry && !loading && (
        <button onClick={() => setView('trash')}
          className="w-full liquid-glass liquid-lensing rounded-ios-lg p-4 text-left transition-all hover:-translate-y-px hover:shadow-lg animate-ios-slide-up">
          <div className="flex items-center gap-3">
            <div className="liquid-glass-thin liquid-tint-red w-12 h-12 rounded-ios-md flex items-center justify-center flex-shrink-0">
              <Trash2 size={20} className="text-red-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-display font-medium text-primary tracking-tight">{t('trashTitle')}</p>
              <p className="text-[12px] text-tertiary font-display mt-1">
                {trashCount > 0 ? t('trashHasItems', { count: trashCount }) : t('trashEmpty')}
              </p>
            </div>
            {trashCount > 0 && (
              <div className="liquid-glass-thin liquid-tint-red rounded-full px-2.5 py-1 text-[11px] font-mono font-bold text-red-300">{trashCount}</div>
            )}
            <span className="text-tertiary text-[16px]">›</span>
          </div>
        </button>
      )}

      {/* Empty state */}
      {!loading && files.length === 0 && (
        <div className="liquid-glass liquid-lensing rounded-ios-2xl text-center py-16 px-6 animate-ios-fade">
          {view === 'trash'
            ? <div className="w-20 h-20 mx-auto mb-5 rounded-ios-xl liquid-glass-thin liquid-tint-blue flex items-center justify-center" style={{ boxShadow: '0 8px 24px rgba(46,125,255,0.20)' }}>
                <Trash2 size={32} className="text-tech-blue-300"/>
              </div>
            : <Lottie animationData={emptyFolderAnimation} loop style={{width:120,height:120}} className="mx-auto mb-5"/>
          }
          <h3 className="text-[18px] font-display font-semibold text-primary mb-2">
            {view === 'trash' ? t('emptyTrashTitle') : t('emptyTitle')}
          </h3>
          <p className="text-tertiary text-[14px] font-display mb-5">
            {view === 'trash' ? t('emptyTrashSubtitle') : t('emptySubtitle')}
          </p>
          {view === 'normal' && onGoUpload && (
            <button onClick={onGoUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display font-semibold text-[13px] text-white transition-all hover:scale-[1.05] hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))', boxShadow: '0 6px 20px rgba(10,132,255,0.45), inset 0 1px 0 rgba(255,255,255,0.30)' }}>
              <Download size={14} style={{ transform: 'rotate(180deg)' }}/> {t('uploadFirst')}
            </button>
          )}
        </div>
      )}

      {/* Empty search */}
      {!loading && files.length > 0 && filtered.length === 0 && (
        <div className="liquid-glass rounded-ios-lg text-center py-12 px-6 animate-ios-fade">
          <Search size={28} className="mx-auto mb-3 text-quaternary"/>
          <p className="text-secondary text-[14px] font-display">
            {t('noSearchResult', { query })}
          </p>
        </div>
      )}

      {/* ── 列表 or 格狀 ── */}
      {!loading && filtered.length > 0 && (
        displayMode === 'list' ? (
          <div className="space-y-2">
            {filtered.map((f, i) => (
              <FileRow
                key={f.key} f={f} i={i}
                showCheckbox={showCheckbox}
                selected={selected.has(f.key)}
                copied={copied === f.downloadUrl}
                isPinned={pinned.has(f.key)}
                locale={locale}
                onToggle={() => toggleOne(f.key)}
                onCopy={() => copy(f.downloadUrl)}
                onPin={() => togglePin(f.key)}
                onShare={() => setShareFile(f)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ key: f.key, name: f.name, downloadUrl: f.downloadUrl, x: e.clientX, y: e.clientY, isPinned: pinned.has(f.key) });
                }}
              />
            ))}
          </div>
        ) : (
          <div className="file-grid">
            {filtered.map((f, i) => (
              <GridCard
                key={f.key} f={f} i={i}
                isPinned={pinned.has(f.key)}
                copied={copied === f.downloadUrl}
                onCopy={() => copy(f.downloadUrl)}
                onPin={() => togglePin(f.key)}
                onShare={() => setShareFile(f)}
              />
            ))}
          </div>
        )
      )}

      {/* 確認對話框 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => !busy && (setConfirmOpen(null), setConfirmText(''))}>
          <div onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-md w-full space-y-4 animate-ios-pop">
            <h3 className="font-display font-bold text-[17px] text-primary flex items-center gap-2">
              {confirmOpen.action === 'trash'     && <><Trash2 size={18} className="text-orange-400"/> {t('confirmTrashTitle')}</>}
              {confirmOpen.action === 'restore'   && <><RotateCcw size={18} className="text-green-400"/> {t('confirmRestoreTitle', { count: confirmOpen.ids.length })}</>}
              {confirmOpen.action === 'permanent' && <><X size={18} className="text-red-400"/> {t('confirmDeleteTitle')}</>}
            </h3>
            <p className="text-[13px] text-secondary font-display leading-relaxed">
              {confirmOpen.action === 'trash' && t.rich('confirmTrashBody', {
                count: confirmOpen.ids.length,
                bold: (chunks) => <span className="font-mono font-semibold text-primary">{chunks}</span>,
              })}
              {confirmOpen.action === 'restore' && t.rich('confirmRestoreBody', {
                count: confirmOpen.ids.length,
                bold: (chunks) => <span className="font-mono font-semibold text-primary">{chunks}</span>,
              })}
              {confirmOpen.action === 'permanent' && t.rich('confirmDeleteBody', {
                count: confirmOpen.ids.length,
                bold:   (chunks) => <span className="font-mono font-semibold text-red-300">{chunks}</span>,
                danger: (chunks) => <span className="font-semibold text-red-300">{chunks}</span>,
              })}
            </p>
            {confirmOpen.action === 'permanent' && (
              <div className="space-y-2">
                <p className="text-[12px] font-display text-tertiary">
                  {t.rich('confirmDeleteInput', {
                    word: confirmDeleteWord,
                    code: (chunks) => <span className="font-mono font-semibold text-red-400">{chunks}</span>,
                  })}
                </p>
                <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus
                  className="w-full liquid-glass-thin rounded-ios-md py-2 px-3 text-[14px] font-display text-primary outline-none" placeholder={t('confirmDeletePlaceholder')}/>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setConfirmOpen(null); setConfirmText(''); }} disabled={busy}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary disabled:opacity-50">{t('confirmCancel')}</button>
              <button
                onClick={() => runAction(confirmOpen.action, confirmOpen.ids)}
                disabled={busy || (confirmOpen.action === 'permanent' && confirmText !== confirmDeleteWord)}
                className="flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={confirmOpen.action === 'trash' ? { background: 'linear-gradient(135deg,#ff9500,#ff6a00)', boxShadow: '0 4px 14px rgba(255,149,0,.4)' }
                  : confirmOpen.action === 'permanent' ? { background: 'linear-gradient(135deg,#ff453a,#d70015)', boxShadow: '0 4px 14px rgba(255,69,58,.4)' }
                  : { background: 'linear-gradient(135deg,#30d158,#28a745)', boxShadow: '0 4px 14px rgba(48,209,88,.4)' }}>
                {busy ? t('confirmProcessing') : confirmOpen.action === 'permanent' ? t('permanentDelete') : t('confirmOk')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #14 Share dialog */}
      {shareFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShareFile(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-sm w-full space-y-4 animate-ios-pop text-center">
            <h3 className="font-display font-bold text-[17px] text-primary">{t('shareTitle')}</h3>
            <p className="text-[13px] text-tertiary font-display truncate">{shareFile.name}</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="mx-auto w-[160px] h-[160px] rounded-ios-md" style={{ imageRendering: 'pixelated' }}/>
            ) : (
              <div className="w-[160px] h-[160px] mx-auto rounded-ios-md shimmer"/>
            )}
            <div className="liquid-glass-thin rounded-ios-md px-3 py-2 text-left">
              <p className="text-[11px] text-quaternary font-display mb-1">{t('shareDownloadLink')}</p>
              <p className="text-[12px] font-mono text-secondary break-all line-clamp-2">{shareFile.downloadUrl}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { copy(shareFile.downloadUrl); }}
                className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold flex items-center justify-center gap-2">
                <Copy size={13}/> {t('shareCopyLink')}
              </button>
              <button onClick={() => setShareFile(null)}
                className="flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue))' }}>
                {t('shareClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右鍵選單 */}
      {ctxMenu && (
        <div className="fixed z-[9999] liquid-glass-strong rounded-ios-md py-1 min-w-[180px] animate-ios-pop"
          style={{ left: ctxMenu.x, top: ctxMenu.y, boxShadow: '0 12px 32px rgba(0,0,0,0.50)' }}
          onClick={(e) => e.stopPropagation()}>
          <CtxBtn icon={<Copy size={13}/>}   label={t('copyLink')}    onClick={() => { copy(ctxMenu.downloadUrl); setCtxMenu(null); }}/>
          <CtxBtn icon={<Share2 size={13}/>} label={t('ctxShare')} onClick={() => {
            setShareFile(files.find((f) => f.key === ctxMenu.key) ?? null);
            setCtxMenu(null);
          }}/>
          <CtxBtn
            icon={ctxMenu.isPinned ? <PinOff size={13}/> : <Pin size={13}/>}
            label={ctxMenu.isPinned ? t('unpin') : t('pinToTop')}
            onClick={() => { togglePin(ctxMenu.key); setCtxMenu(null); }}
          />
          <a href={ctxMenu.downloadUrl} download={ctxMenu.name} target="_blank" rel="noopener noreferrer"
            className="w-full text-left px-4 py-2.5 text-[13px] font-display font-medium hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 text-primary"
            onClick={() => setCtxMenu(null)}>
            <Download size={13}/> {t('download')}
          </a>
          {isAdmin && (
            <>
              <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}/>
              <CtxBtn icon={<Trash2 size={13}/>} label={t('moveToTrash')} danger onClick={() => {
                setConfirmOpen({ action: 'trash', ids: [ctxMenu.key] });
                setCtxMenu(null);
              }}/>
            </>
          )}
        </div>
      )}

      {/* 打包下載壓縮檔 Modal */}
      {packOpen && (
        <PackModal
          onClose={() => setPackOpen(false)}
          files={filtered
            .filter((f) => selected.has(f.key) && !f.isFolder && f.downloadUrl)
            .map((f) => ({ name: f.name, downloadUrl: f.downloadUrl, size: f.size }))}
        />
      )}
    </div>
  );
}

/* ── FileRow（列表模式） ── */
function FileRow({ f, i, showCheckbox, selected, copied, isPinned, locale, onToggle, onCopy, onPin, onShare, onContextMenu }: {
  f: FileEntry; i: number; showCheckbox: boolean; selected: boolean;
  copied: boolean; isPinned: boolean; locale: string;
  onToggle: () => void; onCopy: () => void; onPin: () => void;
  onShare: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const t = useTranslations('fileList');
  return (
    <div
      style={{ animationDelay: `${i * 40}ms` }}
      onContextMenu={onContextMenu}
      className="liquid-glass liquid-lensing rounded-ios-lg p-4 animate-ios-slide-up group transition-all hover:-translate-y-px hover:bg-white/[0.03]"
    >
      <div className="flex items-center gap-3">
        {showCheckbox && (
          <input type="checkbox" checked={selected} onChange={onToggle}
            aria-label={`${locale === 'en' ? 'Select' : '選取'} ${f.name}`} className="w-4 h-4 accent-tech-blue-500 flex-shrink-0"/>
        )}

        <div className={`liquid-glass-thin ${f.isFolder ? 'liquid-tint-orange' : getFileTint(f.name)} w-12 h-12 rounded-ios-md flex items-center justify-center flex-shrink-0 relative group/icon`}>
          <FileIconRender name={f.name} isFolder={!!f.isFolder}/>
          {isImageFile(f.name) && f.downloadUrl && (
            <div className="absolute left-14 top-0 z-30 invisible group-hover/icon:visible opacity-0 group-hover/icon:opacity-100 transition-all pointer-events-none">
              <div className="liquid-glass-strong rounded-ios-md p-1.5" style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.50)' }}>
                <img src={f.downloadUrl} alt={f.name} className="max-w-[200px] max-h-[200px] rounded-ios-md object-contain"/>
              </div>
            </div>
          )}
          {isPinned && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--ios-orange)' }}>
              <Pin size={8} className="text-white"/>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-display font-medium truncate text-primary tracking-tight" title={f.name}>{f.name}</p>
          <div className="flex items-center gap-2 text-[12px] text-tertiary font-display mt-1">
            {!f.isFolder && <span className="font-mono">{formatBytes(f.size)}</span>}
            {f.date && <><span className="text-quaternary">·</span><span>{formatDate(f.date, locale)}</span></>}
          </div>
        </div>

        {!f.isFolder && (
          <div className="flex gap-1.5 flex-shrink-0">
            {/* #11 Pin */}
            <button onClick={onPin}
              className={`liquid-glass-thin w-8 h-8 rounded-full flex items-center justify-center transition-all hover:-translate-y-px ${isPinned ? 'liquid-tint-orange' : 'text-quaternary hover:text-primary'}`}
              title={isPinned ? t('unpin') : t('pinToTop')}>
              {isPinned ? <PinOff size={12}/> : <Pin size={12}/>}
            </button>
            {/* #14 Share */}
            <button onClick={onShare}
              className="liquid-glass-thin w-8 h-8 rounded-full flex items-center justify-center text-quaternary hover:text-primary transition-all hover:-translate-y-px"
              title={t('ctxShare')}>
              <Share2 size={12}/>
            </button>
            {/* Copy */}
            <button onClick={onCopy}
              className={`liquid-glass-thin px-3.5 py-2 rounded-full text-[12px] font-display font-medium transition-all hover:-translate-y-px flex items-center gap-1.5 ${copied ? 'liquid-tint-green animate-pulse-once' : ''}`}
              title={t('copyLink')}>
              {copied ? <Check size={12}/> : <Copy size={12}/>}
              {copied ? t('copied') : t('copyLink')}
            </button>
            <a href={f.downloadUrl} download={f.name} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-full text-[12px] font-display font-semibold flex items-center gap-1.5 transition-all hover:scale-[1.05] hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))', color: 'white', boxShadow: '0 4px 12px rgba(10,132,255,0.40)' }}>
              <Download size={12}/> {t('download')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── GridCard（格狀模式） ── */
function GridCard({ f, i, isPinned, copied, onCopy, onPin, onShare }: {
  f: FileEntry; i: number; isPinned: boolean; copied: boolean;
  onCopy: () => void; onPin: () => void; onShare: () => void;
}) {
  return (
    <div
      style={{ animationDelay: `${i * 30}ms` }}
      className="liquid-glass liquid-lensing rounded-ios-lg p-3 animate-ios-pop flex flex-col gap-2 group hover:-translate-y-px transition-all"
    >
      <div className={`liquid-glass-thin ${f.isFolder ? 'liquid-tint-orange' : getFileTint(f.name)} w-full aspect-square rounded-ios-md flex items-center justify-center relative`}>
        {isImageFile(f.name) && f.downloadUrl
          ? <img src={f.downloadUrl} alt={f.name} className="w-full h-full object-cover rounded-ios-md"/>
          : <FileIconRender name={f.name} isFolder={!!f.isFolder} size={32}/>}
        {isPinned && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--ios-orange)' }}>
            <Pin size={10} className="text-white"/>
          </div>
        )}
      </div>
      <p className="text-[12px] font-display font-medium text-primary truncate" title={f.name}>{f.name}</p>
      {!f.isFolder && <p className="text-[10px] text-quaternary font-mono">{formatBytes(f.size)}</p>}
      <div className="flex gap-1 mt-auto">
        <button onClick={onPin} className={`liquid-glass-thin w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPinned ? 'liquid-tint-orange' : 'text-quaternary'}`}>
          {isPinned ? <PinOff size={10}/> : <Pin size={10}/>}
        </button>
        <button onClick={onShare} className="liquid-glass-thin w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-quaternary">
          <Share2 size={10}/>
        </button>
        <button onClick={onCopy}
          className={`flex-1 rounded-full text-[11px] font-display font-semibold flex items-center justify-center gap-1 transition-all ${copied ? 'liquid-tint-green' : 'liquid-glass-thin'}`}>
          {copied ? <Check size={11}/> : <Copy size={11}/>}
        </button>
      </div>
    </div>
  );
}

/* ── 右鍵選單按鈕 ── */
function CtxBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-[13px] font-display font-medium hover:bg-white/[0.06] transition-colors flex items-center gap-2.5 ${danger ? 'text-ios-red' : 'text-primary'}`}>
      {icon}{label}
    </button>
  );
}

/* ── Icon helpers ── */
function FileIconRender({ name, isFolder, size = 20 }: { name: string; isFolder: boolean; size?: number }) {
  if (isFolder) return <Folder size={size} className="text-orange-300"/>;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4','mov','avi','mkv','webm'].includes(ext))        return <FileVideo      size={size} className="text-purple-300"/>;
  if (['mp3','wav','flac','m4a','ogg'].includes(ext))        return <FileAudio      size={size} className="text-orange-300"/>;
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return <FileImage      size={size} className="text-green-300"/>;
  if (['pdf'].includes(ext))                                 return <FileType       size={size} className="text-red-300"/>;
  if (['zip','tar','gz','rar','7z'].includes(ext))           return <FileArchive    size={size} className="text-orange-300"/>;
  if (['xls','xlsx','csv'].includes(ext))                    return <FileSpreadsheet size={size} className="text-green-300"/>;
  if (['doc','docx','txt','md'].includes(ext))               return <FileText       size={size} className="text-tech-blue-300"/>;
  return <FileIcon size={size} className="text-tech-blue-300"/>;
}
function isImageFile(name: string) {
  return ['jpg','jpeg','png','gif','svg','webp','avif'].includes(name.split('.').pop()?.toLowerCase() ?? '');
}
function getFileTint(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4','mov','avi','mkv','webm'].includes(ext))        return 'liquid-tint-purple';
  if (['mp3','wav','flac','m4a','ogg'].includes(ext))        return 'liquid-tint-orange';
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'liquid-tint-green';
  if (['pdf'].includes(ext))                                 return 'liquid-tint-red';
  if (['zip','tar','gz','rar','7z'].includes(ext))           return 'liquid-tint-orange';
  if (['doc','docx','txt','md'].includes(ext))               return 'liquid-tint-blue';
  if (['xls','xlsx','csv'].includes(ext))                    return 'liquid-tint-green';
  return 'liquid-tint-blue';
}
function formatDate(iso: string, locale: string): string {
  const d = new Date(iso), now = new Date(), diff = now.getTime() - d.getTime(), day = 86400000;
  if (diff < day)     return locale === 'en' ? 'Today'     : '今天';
  if (diff < 2*day)   return locale === 'en' ? 'Yesterday' : '昨天';
  if (diff < 7*day)   return locale === 'en'
    ? `${Math.floor(diff/day)} days ago`
    : `${Math.floor(diff/day)} 天前`;
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}
