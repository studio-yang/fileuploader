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
    if (!res.ok) throw new
