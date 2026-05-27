'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/components/I18nProvider';
import ProviderSelector from '@/components/upload/ProviderSelector';
import DropZone         from '@/components/upload/DropZone';
import FileQueue        from '@/components/upload/FileQueue';
import FileListPanel    from '@/components/upload/FileListPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { StorageProvider, FileItem } from '@/lib/types';
import {
  generateId, getMimeType, uploadWithProgress, resumableChunkUpload,
} from '@/lib/utils';
import { uploadToGoogleDriveDirect } from '@/lib/gdriveResumable';
import { useConfetti } from '@/components/Confetti';
import { Onboarding } from '@/components/Onboarding';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';

type Tab = 'upload' | 'download';

/* #4 provider localStorage helpers（SSR-safe） */
function loadProvider(): StorageProvider {
  if (typeof window === 'undefined') return 'gdrive';
  return (localStorage.getItem('fl:provider') as StorageProvider) || 'gdrive';
}

export default function Home() {
  const router   = useRouter();
  const toast    = useToast();
  const confetti = useConfetti();
  const t        = useTranslations();
  const { locale, setLocale } = useLocale();

  const [provider,    setProvider]    = useState<StorageProvider>('gdrive');
  const [activeTab,   setActiveTab]   = useState<Tab>('upload');
  const [fileItems,   setFileItems]   = useState<FileItem[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [listRefresh, setListRefresh] = useState(0);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  /* #1 Command Palette */
  const [cmdOpen,     setCmdOpen]     = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  /* #6 Cursor glow ref（不用 state 避免重繪） */
  const glowRef  = useRef<HTMLDivElement>(null);

  /* 初始化：載入 provider、isAdmin */
  useEffect(() => {
    setProvider(loadProvider());
    fetch('/api/auth/me').then((r) => r.json()).then((j) => {
      setIsAdmin(!!j?.isAdmin);
    }).catch(() => {});
  }, []);

  /* #4 provider 變更時存入 localStorage */
  const handleProviderChange = useCallback((p: StorageProvider) => {
    setProvider(p);
    localStorage.setItem('fl:provider', p);
  }, []);

  /* #6 Cursor glow 滑鼠追蹤 */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX}px`;
        glowRef.current.style.top  = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, []);

  /* #1 ⌘K / Ctrl+K 開關 Command Palette */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* #5 Magnetic buttons — 靠近時輕微吸附位移 */
  useEffect(() => {
    const btns = document.querySelectorAll<HTMLElement>('.magnetic');
    const handlers: [HTMLElement, (e: MouseEvent) => void, () => void][] = [];
    btns.forEach((btn) => {
      const onMove = (e: MouseEvent) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const dx = (e.clientX - cx) * 0.25;
        const dy = (e.clientY - cy) * 0.25;
        btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
      };
      const onLeave = () => { btn.style.transform = ''; };
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      handlers.push([btn, onMove, onLeave]);
    });
    return () => {
      handlers.forEach(([btn, onMove, onLeave]) => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
      });
    };
  }, [activeTab, fileItems.length]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  const update = useCallback((id: string, patch: Partial<FileItem>) => {
    setFileItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  /* #12 重複偵測 */
  const handleFiles = useCallback((files: File[]) => {
    const existingNames = new Set(fileItems.filter((f) => f.status === 'success').map((f) => f.name));
    const dupes = files.filter((f) => existingNames.has(f.name));
    if (dupes.length > 0) {
      toast.info(t('toast.duplicateFiles', { files: dupes.map((f) => f.name).join(t('toast.fileSeparator')) }));
    }
    const items: FileItem[] = files.map((file) => ({
      id: generateId(), file,
      name: file.name, size: file.size,
      type: file.type || getMimeType(file.name),
      status: 'pending', progress: 0,
    }));
    setFileItems((prev) => [...prev, ...items]);
  }, [fileItems, toast, t]);

  async function uploadToGCS(item: FileItem, signal: AbortSignal) {
    const res = await fetch('/api/upload/presigned', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: item.name, fileType: item.type, fileSize: item.size }), signal,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.mode === 'resumable') {
      await resumableChunkUpload(data.sessionUri, item.file,
        (pct, speed, eta) => update(item.id, { progress: pct, speed, eta }), signal);
    } else {
      await uploadWithProgress(data.uploadUrl, item.file, item.type,
        (pct, speed, eta) => update(item.id, { progress: pct, speed, eta }), signal);
    }
    return data.downloadUrl as string;
  }

  async function uploadToGDrive(item: FileItem, signal: AbortSignal) {
    const { downloadUrl } = await uploadToGoogleDriveDirect(
      item.file, (pct, speed, eta) => update(item.id, { progress: pct, speed, eta }), signal,
    );
    return downloadUrl;
  }

  async function uploadToGitHub(item: FileItem, signal: AbortSignal) {
    const buffer = await item.file.arrayBuffer();
    update(item.id, { progress: 10 });
    const res = await fetch('/api/upload/github', {
      method: 'POST',
      headers: { 'x-file-name': item.name, 'x-content-type': item.type, 'x-file-size': String(item.size), 'Content-Type': item.type },
      body: buffer, signal,
    });
    if (!res.ok) throw new Error(await res.text());
    update(item.id, { progress: 90 });
    return (await res.json()).downloadUrl as string;
  }

  const startUpload = useCallback(async () => {
    const pending = fileItems.filter((f) => f.status === 'pending');
    if (!pending.length) return;
    setUploading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let hasError = false;
    for (const item of pending) {
      if (ac.signal.aborted) break;
      update(item.id, { status: 'uploading', progress: 0 });
      try {
        let downloadUrl: string;
        switch (provider) {
          case 'gcs':    downloadUrl = await uploadToGCS(item, ac.signal); break;
          case 'gdrive': downloadUrl = await uploadToGDrive(item, ac.signal); break;
          case 'github': downloadUrl = await uploadToGitHub(item, ac.signal); break;
          default: throw new Error('Unknown provider');
        }
        update(item.id, { status: 'success', progress: 100, downloadUrl, uploadedAt: Date.now() });
        /* #15 Audit log */
        fetch('/api/audit/log', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload', details: { name: item.name, provider, size: item.size } }),
        }).catch(() => {});
      } catch (err: any) {
        hasError = true;
        update(item.id, { status: 'error', error: ac.signal.aborted ? t('toast.uploadCancelled') : err.message });
      }
    }
    setUploading(false);
    setListRefresh((n) => n + 1);
    if (!hasError && !ac.signal.aborted) confetti.fire(50);
  }, [fileItems, provider, update, confetti, t]);

  const cancelUpload = () => abortRef.current?.abort();
  const removeFile   = (id: string) => setFileItems((prev) => prev.filter((f) => f.id !== id));
  const copyLink     = (url: string) => { navigator.clipboard.writeText(url); toast.success(t('toast.linkCopied')); };

  /* #16 拖曳重排 */
  const handleReorder = useCallback((newFiles: FileItem[]) => {
    setFileItems(newFiles);
  }, []);

  const pendingCount   = fileItems.filter((f) => f.status === 'pending').length;
  const uploadingCount = fileItems.filter((f) => f.status === 'uploading').length;
  const successCount   = fileItems.filter((f) => f.status === 'success').length;

  /* #13 批次總進度 */
  const batchTotal = uploadingCount + successCount;
  const batchProgress = batchTotal > 0
    ? Math.round(fileItems.reduce((acc, f) => {
        if (f.status === 'uploading') return acc + f.progress;
        if (f.status === 'success')   return acc + 100;
        return acc;
      }, 0) / batchTotal)
    : 0;

  return (
    <div className="min-h-screen flex flex-col">

      {/* #6 Cursor glow */}
      <div ref={glowRef} className="cursor-glow" aria-hidden="true" style={{ left: '-9999px', top: '-9999px' }}/>

      {confetti.view}
      <Onboarding isAdmin={isAdmin}/>

      {/* #1 Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        isAdmin={isAdmin}
        onTab={(tab) => setActiveTab(tab)}
        onLogout={logout}
      />

      {/* ── Header ── */}
      <header className="liquid-glass-strong sticky top-0 z-40 px-3 sm:px-6 lg:px-10">
        <div className="max-w-[1440px] mx-auto flex items-center gap-2 sm:gap-4 h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" aria-label={t('header.homeAriaLabel')}>
            <div className="w-9 h-9 rounded-ios-md flex items-center justify-center liquid-lensing flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)', boxShadow: '0 4px 16px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3"/><path d="M3 8L8 3L13 8"/>
              </svg>
            </div>
            <span className="font-display font-bold text-[14px] sm:text-[18px] tracking-tight text-primary truncate">
              <span className="sm:hidden">{t('header.titleShort')}</span>
              <span className="hidden sm:inline">{t('header.titleLong')}</span>
            </span>
          </a>

          {/* Tabs */}
          <div className="liquid-glass-thin rounded-full p-1 flex gap-1 ml-1 sm:ml-6 flex-shrink-0">
            {([
              { id: 'upload'   as Tab, icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10V3"/><path d="M3 6L7 3L11 6"/><path d="M2 11H12"/></svg>, label: t('tabs.upload') },
              { id: 'download' as Tab, icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3V10"/><path d="M3 7L7 10L11 7"/><path d="M2 11H12"/></svg>, label: t('tabs.download') },
            ]).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full text-[13px] font-display transition-all duration-300 ${active ? 'text-white font-bold' : 'text-tertiary hover:text-secondary font-semibold'}`}
                  style={active ? { background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue))', boxShadow: '0 4px 12px rgba(10,132,255,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' } : undefined}>
                  {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1"/>

          {/* Stats pills */}
          {activeTab === 'upload' && (
            <div className="hidden md:flex items-center gap-2">
              <StatPill label={t('stats.pending')}   value={pendingCount}   color="var(--text-tertiary)"
                onClick={pendingCount > 0 ? () => document.querySelector('[data-status="pending"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}/>
              <StatPill label={t('stats.uploading')} value={uploadingCount} color="var(--tech-blue-300)" tint="liquid-tint-blue"
                onClick={uploadingCount > 0 ? () => document.querySelector('[data-status="uploading"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}/>
              <StatPill label={t('stats.success')}   value={successCount}   color="var(--ios-green)"    tint="liquid-tint-green"
                onClick={successCount > 0 ? () => document.querySelector('[data-status="success"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}/>
            </div>
          )}

          {/* #1 ⌘K 按鈕 */}
          <button
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex liquid-glass-thin rounded-full px-3 py-1.5 items-center gap-1.5 ml-1 text-tertiary hover:text-primary transition-colors magnetic"
            title={t('header.cmdPalette')}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="5" r="4"/><path d="M10 10L7.5 7.5"/></svg>
            <span className="text-[11px] font-display font-semibold">⌘K</span>
          </button>

          <ThemeToggle/>

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW')}
            className="hidden sm:flex liquid-glass-thin rounded-full px-3 py-1.5 items-center ml-1 flex-shrink-0 text-tertiary hover:text-primary transition-colors magnetic"
            title={locale === 'zh-TW' ? 'Switch to English' : '切換到繁體中文'}
          >
            <span className="text-[11px] font-display font-semibold">{t('header.langToggle')}</span>
          </button>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden liquid-glass-thin rounded-full p-2 ml-1 flex-shrink-0 text-tertiary hover:text-primary transition-colors"
            aria-label={t('header.openMenu')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 4h10M2 7h10M2 10h10"/>
            </svg>
          </button>

          {/* Admin link (desktop) */}
          {isAdmin && (
            <button onClick={() => router.push('/admin')}
              className="hidden sm:flex liquid-glass-thin liquid-tint-orange rounded-full px-3 py-1.5 items-center gap-1.5 ml-1 flex-shrink-0 hover:opacity-80 transition-opacity magnetic">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="2"/><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4"/>
              </svg>
              <span className="text-[11px] font-display font-semibold hidden sm:inline">{t('header.whitelist')}</span>
            </button>
          )}

          {/* 登出 (desktop) */}
          <button onClick={logout}
            className="hidden sm:flex liquid-glass-thin rounded-full px-3 py-1.5 items-center ml-1 flex-shrink-0 text-tertiary hover:text-primary transition-colors magnetic">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2H2v8h3"/><path d="M8 8.5L10.5 6 8 3.5"/><path d="M10.5 6H5"/>
            </svg>
            <span className="text-[11px] font-display font-semibold ml-1">{t('header.logout')}</span>
          </button>

          <div className="hidden sm:flex liquid-glass-thin liquid-tint-green rounded-full px-3 py-1.5 items-center gap-1.5 ml-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full animate-breathe" style={{ background: 'var(--ios-green)' }}/>
            <span className="text-[11px] font-display font-semibold">HTTPS</span>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden absolute top-16 right-3 z-50 liquid-glass-strong rounded-ios-md p-2 min-w-[180px] animate-ios-pop space-y-1" style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}>
            <button onClick={() => { setMenuOpen(false); setCmdOpen(true); }}
              className="w-full text-left px-3 py-2 rounded-md text-[13px] font-display font-medium text-primary hover:bg-white/[0.05] transition-colors">
              🔍 {t('header.cmdPalette')}
            </button>
            {isAdmin && (
              <button onClick={() => { setMenuOpen(false); router.push('/admin'); }}
                className="w-full text-left px-3 py-2 rounded-md text-[13px] font-display font-medium text-primary hover:bg-white/[0.05] transition-colors">
                ⚙ {t('header.adminMenu')}
              </button>
            )}
            <button onClick={() => { setMenuOpen(false); setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW'); }}
              className="w-full text-left px-3 py-2 rounded-md text-[13px] font-display font-medium text-primary hover:bg-white/[0.05] transition-colors">
              🌐 {t('header.langToggle')}
            </button>
            <button onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full text-left px-3 py-2 rounded-md text-[13px] font-display font-medium text-primary hover:bg-white/[0.05] transition-colors">
              ↩ {t('header.logout')}
            </button>
            <div className="border-t border-white/[0.06] my-1"/>
            <div className="px-3 py-1.5 text-[11px] font-display text-tertiary flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ios-green)' }}/>
              {t('header.httpsEncrypted')}
            </div>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full px-3 sm:px-6 lg:px-10 py-4 lg:py-6">
        {/* Mobile RWD：main 優先（order-1），sidebar 在下（order-2） */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-start">

          {/* ── Left Sidebar — Mobile: order-2（下方），lg: order-1（左側）── */}
          <aside className="w-full lg:w-[280px] flex-shrink-0 lg:sticky lg:top-24 space-y-4 order-2 lg:order-1">
            <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-5">
              <SideLabel>{t('sidebar.storage')}</SideLabel>
              <ProviderSelector selected={provider} onChange={handleProviderChange}/>
            </div>

            <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-3">
              <SideLabel>{t('sidebar.description')}</SideLabel>
              {provider === 'gdrive' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.gdrive.line1')}</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.gdrive.line2')}</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.gdrive.line3')}</InfoRow>
                </div>
              )}
              {provider === 'github' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.github.line1')}</InfoRow>
                  <InfoRow icon="!" color="var(--ios-orange)">{t('sidebar.github.line2')}</InfoRow>
                  <InfoRow icon="!" color="var(--ios-orange)">{t('sidebar.github.line3')}</InfoRow>
                </div>
              )}
              {provider === 'gcs' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.gcs.line1')}</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">{t('sidebar.gcs.line2')}</InfoRow>
                </div>
              )}
            </div>

            {activeTab === 'upload' && fileItems.length > 0 && (
              <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-3">
                <SideLabel>{t('sidebar.uploadStats')}</SideLabel>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label={t('stats.pending')}   value={pendingCount}   color="var(--text-tertiary)"/>
                  <MiniStat label={t('stats.uploading')} value={uploadingCount} color="var(--tech-blue-300)"/>
                  <MiniStat label={t('stats.success')}   value={successCount}   color="var(--ios-green)"/>
                </div>
              </div>
            )}
          </aside>

          {/* ── Right Main — Mobile: order-1（上方），lg: order-2（右側）── */}
          <main className="flex-1 min-w-0 space-y-5 order-1 lg:order-2">

            {activeTab === 'upload' && (
              <>
                <DropZone onFiles={handleFiles} disabled={uploading}/>

                {/* #13 批次總進度條 */}
                {uploading && batchTotal > 0 && (
                  <div className="liquid-glass liquid-lensing rounded-ios-lg px-5 py-4 space-y-2">
                    <div className="flex items-center justify-between text-[12px] font-display">
                      <span className="text-tertiary">{t('upload.batchProgress')}</span>
                      <span className="font-semibold" style={{ color: 'var(--tech-blue-300)' }}>{batchProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${batchProgress}%`,
                          background: 'linear-gradient(90deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
                          backgroundSize: '200% 100%',
                          animation: 'shimmerGlass 2.5s ease-in-out infinite',
                          boxShadow: '0 2px 12px rgba(10,132,255,0.50)',
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-quaternary font-display">
                      {t('upload.batchStatus', { uploading: uploadingCount, success: successCount, total: batchTotal })}
                    </p>
                  </div>
                )}

                {fileItems.some((f) => f.status === 'pending') && (
                  <div className="flex gap-3">
                    <button
                      onClick={startUpload}
                      disabled={uploading}
                      className={`flex-1 py-4 rounded-ios-lg font-display font-semibold text-[15px] tracking-tight transition-all duration-300 relative overflow-hidden liquid-lensing spring-hover magnetic ${
                        uploading ? 'liquid-glass text-tertiary cursor-not-allowed' : 'text-white'
                      }`}
                      style={!uploading ? {
                        background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
                        boxShadow: '0 8px 28px rgba(10,132,255,0.45), inset 0 1.5px 0 rgba(255,255,255,0.30)',
                      } : undefined}
                    >
                      {uploading
                        ? t('upload.uploadingActive', { count: uploadingCount })
                        : t('upload.startUpload', { count: pendingCount })}
                    </button>
                    {uploading && (
                      <button onClick={cancelUpload}
                        className="liquid-glass liquid-tint-red px-6 py-4 rounded-ios-lg font-display font-semibold text-[14px] liquid-hover">
                        {t('upload.cancel')}
                      </button>
                    )}
                  </div>
                )}

                <FileQueue files={fileItems} onRemove={removeFile} onCopy={copyLink} onReorder={handleReorder}/>

                {fileItems.length === 0 && (
                  <div className="liquid-glass liquid-lensing rounded-ios-xl p-12 text-center">
                    <div className="w-16 h-16 rounded-ios-xl mx-auto mb-4 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-cyan))', boxShadow: '0 8px 24px rgba(10,132,255,0.35)', opacity: 0.7 }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 21V7"/><path d="M7 13L14 7L21 13"/><path d="M5 21H23"/>
                      </svg>
                    </div>
                    <p className="text-secondary text-[15px] font-display">{t('upload.emptyTitle')}</p>
                    <p className="text-tertiary text-[13px] mt-1 font-display">{t('upload.emptySubtitle')}</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'download' && (
              <FileListPanel provider={provider} refresh={listRefresh} isAdmin={isAdmin} onGoUpload={() => setActiveTab('upload')}/>
            )}
          </main>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="max-w-[1440px] mx-auto w-full px-3 sm:px-6 lg:px-10 pb-4 lg:pb-6">
        <div className="liquid-glass rounded-2xl sm:rounded-full py-3 px-4 sm:px-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-tertiary font-display">{t('footer.copyright')}</p>
          <div className="flex items-center gap-4 text-[11px] font-display text-tertiary">
            <Indicator color="var(--ios-green)"     label="HTTPS"/>
            <Indicator color="var(--tech-blue-300)" label={t('footer.encrypted')}/>
            <Indicator color="var(--ios-cyan)"      label={t('footer.edge')}/>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── 小元件 ── */
function StatPill({ label, value, color, tint = '', onClick }: {
  label: string; value: number; color: string; tint?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`liquid-glass-thin ${tint} rounded-full px-3 py-1.5 flex items-center gap-2 transition-all ${onClick ? 'hover:scale-[1.05] cursor-pointer' : 'cursor-default'}`}>
      <span className="text-[18px] font-display font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] text-tertiary font-display">{label}</span>
    </button>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))' }}/>
      <span className="text-[11px] font-display font-semibold text-tertiary tracking-wider uppercase">{children}</span>
    </div>
  );
}

function InfoRow({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-secondary font-display leading-snug">
      <span className="font-bold flex-shrink-0" style={{ color }}>{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="liquid-glass-thin rounded-ios-md p-2.5 text-center">
      <div className="text-[20px] font-display font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-tertiary font-display">{label}</div>
    </div>
  );
}

function Indicator({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }}/>
      {label}
    </span>
  );
}
