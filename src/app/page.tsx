'use client';

import { useState, useCallback, useRef } from 'react';
import ProviderSelector from '@/components/upload/ProviderSelector';
import DropZone         from '@/components/upload/DropZone';
import FileQueue        from '@/components/upload/FileQueue';
import FileListPanel    from '@/components/upload/FileListPanel';
import { StorageProvider, FileItem } from '@/lib/types';
import {
  generateId, getMimeType, uploadWithProgress, resumableChunkUpload,
} from '@/lib/utils';
import { uploadToGoogleDriveDirect } from '@/lib/gdriveResumable';

type Tab = 'upload' | 'download';

export default function Home() {
  const [provider,    setProvider]    = useState<StorageProvider>('gdrive');
  const [activeTab,   setActiveTab]   = useState<Tab>('upload');
  const [fileItems,   setFileItems]   = useState<FileItem[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [listRefresh, setListRefresh] = useState(0);
  const [toast,       setToast]       = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = useCallback((id: string, patch: Partial<FileItem>) => {
    setFileItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFiles = useCallback((files: File[]) => {
    const items: FileItem[] = files.map((file) => ({
      id: generateId(), file,
      name: file.name, size: file.size,
      type: file.type || getMimeType(file.name),
      status: 'pending', progress: 0,
    }));
    setFileItems((prev) => [...prev, ...items]);
  }, []);

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
      } catch (err: any) {
        update(item.id, { status: 'error', error: ac.signal.aborted ? '上傳已取消' : err.message });
      }
    }
    setUploading(false);
    setListRefresh((n) => n + 1);
  }, [fileItems, provider, update]);

  const cancelUpload  = () => abortRef.current?.abort();
  const removeFile    = (id: string) => setFileItems((prev) => prev.filter((f) => f.id !== id));
  const copyLink      = (url: string) => { navigator.clipboard.writeText(url); showToast('連結已複製'); };

  const pendingCount   = fileItems.filter((f) => f.status === 'pending').length;
  const uploadingCount = fileItems.filter((f) => f.status === 'uploading').length;
  const successCount   = fileItems.filter((f) => f.status === 'success').length;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 liquid-glass-strong rounded-full px-5 py-2.5 flex items-center gap-2.5 animate-ios-pop">
          <span className="w-1.5 h-1.5 rounded-full animate-breathe" style={{ background: 'var(--ios-green)' }} />
          <span className="text-[14px] font-display font-medium text-primary">{toast}</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="liquid-glass-strong sticky top-0 z-40 px-6 lg:px-10">
        <div className="max-w-[1440px] mx-auto flex items-center gap-4 h-16">

          {/* Logo (點擊回首頁) */}
          <a
            href="/"
            className="flex items-center gap-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label="回到首頁"
          >
            <div className="w-9 h-9 rounded-ios-md flex items-center justify-center liquid-lensing flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
                boxShadow: '0 4px 16px rgba(10,132,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
              }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3"/><path d="M3 8L8 3L13 8"/>
              </svg>
            </div>
            <span className="font-display font-bold text-[18px] tracking-tight text-primary">CHB 外部檔案傳輸平台</span>
          </a>

          {/* Nav tabs */}
          <div className="liquid-glass-thin rounded-full p-1 flex gap-1 ml-6">
            {([
              { id: 'upload'   as Tab, label: '上傳檔案',
                icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10V3"/><path d="M3 6L7 3L11 6"/><path d="M2 11H12"/></svg> },
              { id: 'download' as Tab, label: '下載中心',
                icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3V10"/><path d="M3 7L7 10L11 7"/><path d="M2 11H12"/></svg> },
            ]).map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-display font-semibold transition-all duration-300 ${
                  activeTab === t.id ? 'liquid-tint-blue text-tech-blue' : 'text-tertiary hover:text-secondary'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2">
            <StatPill label="等待" value={pendingCount}   color="var(--text-tertiary)" />
            <StatPill label="進行" value={uploadingCount} color="var(--tech-blue-300)" tint="liquid-tint-blue" />
            <StatPill label="完成" value={successCount}   color="var(--ios-green)"    tint="liquid-tint-green" />
          </div>

          {/* HTTPS */}
          <div className="liquid-glass-thin liquid-tint-green rounded-full px-3 py-1.5 flex items-center gap-1.5 ml-2">
            <span className="w-1.5 h-1.5 rounded-full animate-breathe" style={{ background: 'var(--ios-green)' }} />
            <span className="text-[11px] font-display font-semibold">HTTPS</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full px-6 lg:px-10 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Left Sidebar (固定 280px) ── */}
          <aside className="w-[280px] flex-shrink-0 sticky top-24 space-y-4">

            {/* Provider selector card */}
            <div className="liquid-glass-strong liquid-lensing rounded-ios-xl p-5">
              <SideLabel>儲存目標</SideLabel>
              <ProviderSelector selected={provider} onChange={setProvider} />
            </div>

            {/* Capacity / info card */}
            <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-3">
              <SideLabel>說明</SideLabel>
              {provider === 'gdrive' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">瀏覽器直傳，不受 Vercel 限制</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">8 MB 分塊，支援 1 GB+ 大檔</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">上傳後自動設定公開下載權限</InfoRow>
                </div>
              )}
              {provider === 'github' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">附掛至 GitHub Releases</InfoRow>
                  <InfoRow icon="!" color="var(--ios-orange)">建議 &lt; 4 MB（Vercel 免費限制）</InfoRow>
                  <InfoRow icon="!" color="var(--ios-orange)">單檔上限 2 GB</InfoRow>
                </div>
              )}
              {provider === 'gcs' && (
                <div className="space-y-2">
                  <InfoRow icon="✓" color="var(--ios-green)">Presigned URL 直傳到 GCS</InfoRow>
                  <InfoRow icon="✓" color="var(--ios-green)">下載連結有效 7 天</InfoRow>
                </div>
              )}
            </div>

            {/* Upload stats (only on upload tab) */}
            {activeTab === 'upload' && fileItems.length > 0 && (
              <div className="liquid-glass liquid-lensing rounded-ios-xl p-5 space-y-3">
                <SideLabel>上傳統計</SideLabel>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="等待" value={pendingCount}   color="var(--text-tertiary)" />
                  <MiniStat label="進行" value={uploadingCount} color="var(--tech-blue-300)" />
                  <MiniStat label="完成" value={successCount}   color="var(--ios-green)" />
                </div>
              </div>
            )}
          </aside>

          {/* ── Right Main (flex-1) ── */}
          <main className="flex-1 min-w-0 space-y-5">

            {/* ── Upload Tab ── */}
            {activeTab === 'upload' && (
              <>
                <DropZone onFiles={handleFiles} disabled={uploading} />

                {fileItems.some((f) => f.status === 'pending') && (
                  <div className="flex gap-3">
                    <button
                      onClick={startUpload}
                      disabled={uploading}
                      className={`flex-1 py-4 rounded-ios-lg font-display font-semibold text-[15px] tracking-tight transition-all duration-300 relative overflow-hidden liquid-lensing ${
                        uploading ? 'liquid-glass text-tertiary cursor-not-allowed' : 'text-white'
                      }`}
                      style={!uploading ? {
                        background: 'linear-gradient(135deg, var(--tech-blue-500) 0%, var(--ios-blue) 50%, var(--ios-cyan) 100%)',
                        boxShadow: '0 8px 28px rgba(10,132,255,0.45), inset 0 1.5px 0 rgba(255,255,255,0.30)',
                      } : undefined}
                    >
                      {uploading ? `上傳中 · ${uploadingCount} 個進行中` : `開始上傳 ${pendingCount} 個檔案`}
                    </button>
                    {uploading && (
                      <button onClick={cancelUpload}
                        className="liquid-glass liquid-tint-red px-6 py-4 rounded-ios-lg font-display font-semibold text-[14px] liquid-hover">
                        取消
                      </button>
                    )}
                  </div>
                )}

                <FileQueue files={fileItems} onRemove={removeFile} onCopy={copyLink} />

                {fileItems.length === 0 && (
                  <div className="liquid-glass liquid-lensing rounded-ios-xl p-12 text-center">
                    <div className="w-16 h-16 rounded-ios-xl mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-cyan))',
                        boxShadow: '0 8px 24px rgba(10,132,255,0.35)',
                        opacity: 0.7,
                      }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 21V7"/><path d="M7 13L14 7L21 13"/><path d="M5 21H23"/>
                      </svg>
                    </div>
                    <p className="text-secondary text-[15px] font-display">將檔案拖放到上方區域，或點擊選取</p>
                    <p className="text-tertiary text-[13px] mt-1 font-display">支援任何格式 · 單檔最大 5 GB</p>
                  </div>
                )}
              </>
            )}

            {/* ── Download Tab ── */}
            {activeTab === 'download' && (
              <FileListPanel provider={provider} refresh={listRefresh} />
            )}
          </main>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="max-w-[1440px] mx-auto w-full px-6 lg:px-10 pb-6">
        <div className="liquid-glass rounded-full py-3 px-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-tertiary font-display">FileFlow © 2026 · Next.js + Vercel</p>
          <div className="flex items-center gap-4 text-[11px] font-display text-tertiary">
            <Indicator color="var(--ios-green)"     label="HTTPS" />
            <Indicator color="var(--tech-blue-300)" label="加密傳輸" />
            <Indicator color="var(--ios-cyan)"      label="Vercel Edge" />
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── 小元件 ── */
function StatPill({ label, value, color, tint = '' }: { label: string; value: number; color: string; tint?: string }) {
  return (
    <div className={`liquid-glass-thin ${tint} rounded-full px-3 py-1.5 flex items-center gap-2`}>
      <span className="text-[18px] font-display font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] text-tertiary font-display">{label}</span>
    </div>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--tech-blue-300), var(--ios-cyan))' }} />
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
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
