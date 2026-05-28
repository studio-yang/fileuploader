'use client';

import { useEffect, useState } from 'react';
import { Package, X } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface PackFile {
  name:        string;
  downloadUrl: string;
  size:        number;
}

interface Props {
  files: PackFile[];   // 已選取且非資料夾的檔案
  onClose: () => void;
}

const MAX_BYTES   = 1.5 * 1024 * 1024 * 1024;   // 1.5 GB 硬擋
const WARN_BYTES  = 300  * 1024 * 1024;          // 300 MB 警告
const SPLIT_BYTES = 300  * 1024 * 1024;          // 分卷大小

type Format = 'zip' | '7z';
type Stage  = 'idle' | 'fetching' | 'packing' | 'done';

export function PackModal({ files, onClose }: Props) {
  const toast = useToast();
  const [format,   setFormat]   = useState<Format>('zip');
  const [stage,    setStage]    = useState<Stage>('idle');
  const [progress, setProgress] = useState({ now: 0, total: 0 });
  const [pw,       setPw]       = useState('');
  const [level,    setLevel]    = useState(9);

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const tooBig    = totalBytes > MAX_BYTES;
  const overWarn  = totalBytes > WARN_BYTES;

  useEffect(() => {
    fetch('/api/pack-password').then(r => r.json()).then(j => {
      setPw(j.password ?? '');
      setLevel(j.compressionLevel ?? 9);
    }).catch(() => {});
  }, []);

  async function fetchAll(): Promise<{ name: string; data: Uint8Array }[]> {
    const out: { name: string; data: Uint8Array }[] = [];
    setProgress({ now: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const r = await fetch(f.downloadUrl);
      if (!r.ok) throw new Error(`下載失敗: ${f.name}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      out.push({ name: f.name, data: buf });
      setProgress({ now: i + 1, total: files.length });
    }
    return out;
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function runZip(items: { name: string; data: Uint8Array }[]) {
    items = dedupeNames(items);    // 防止同名互蓋
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const it of items) zip.file(it.name, it.data);
    const u8: Uint8Array = await zip.generateAsync({
      type: 'uint8array',
      compression: level === 0 ? 'STORE' : 'DEFLATE',
      compressionOptions: { level: Math.max(1, Math.min(9, level)) as 1|2|3|4|5|6|7|8|9 },
    });

    const ts = timestamp();
    const base = `chb-files_${ts}`;

    const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    if (buf.byteLength <= SPLIT_BYTES) {
      downloadBlob(new Blob([buf]), `${base}.zip`);
    } else {
      // 多卷 ZIP：主檔 .zip + 分卷 .z01 / .z02 / ...
      const count = Math.ceil(buf.byteLength / SPLIT_BYTES);
      for (let i = 0; i < count; i++) {
        const slice = buf.slice(i * SPLIT_BYTES, (i + 1) * SPLIT_BYTES);
        const name = i === 0
          ? `${base}.zip`
          : `${base}.z${String(i).padStart(2, '0')}`;
        downloadBlob(new Blob([slice]), name);
      }
    }
  }

  async function run7z(items: { name: string; data: Uint8Array }[]) {
    if (!pw) throw new Error('伺服器尚未設定壓縮密碼，請管理員至「壓縮密碼」分頁設定');
    items = dedupeNames(items);
    const mx = Math.max(0, Math.min(9, level));
    const ts = timestamp();
    const base = `chb-files_${ts}`;
    const total = items.reduce((s, it) => s + it.data.length, 0);

    // 把 Uint8Array buffer 切出來（zero-copy transfer 給 worker）
    const transferable = items.map((it) => ({
      name: it.name,
      data: it.data.buffer.slice(it.data.byteOffset, it.data.byteOffset + it.data.byteLength),
    }));

    // Web Worker：7z 跑在 worker 內，主執行緒不會卡死
    const worker = new Worker(new URL('../workers/pack-7z.worker.ts', import.meta.url));

    return new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'done') {
          const results = e.data.results as { name: string; data: Uint8Array }[];
          const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
          if (results.length === 1) {
            downloadBlob(new Blob([toBuf(results[0].data)]), `${base}.7z`);
          } else {
            for (let i = 0; i < results.length; i++) {
              const ext = String(i + 1).padStart(3, '0');
              downloadBlob(new Blob([toBuf(results[i].data)]), `${base}.7z.${ext}`);
            }
          }
          worker.terminate();
          resolve();
        } else if (e.data.type === 'error') {
          worker.terminate();
          const hint = total > 200 * 1024 * 1024
            ? '（建議降低壓縮率：管理頁 → 壓縮密碼 → 滑桿調 3-5）'
            : '';
          reject(new Error(`7z 失敗：${e.data.message} ${hint}`));
        }
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(new Error(`Worker 錯誤：${e.message || 'unknown'}`));
      };
      worker.postMessage(
        { items: transferable, password: pw, level: mx, splitBytes: SPLIT_BYTES },
        transferable.map((t) => t.data),
      );
    });
  }

  async function start() {
    if (tooBig) return;
    try {
      setStage('fetching');
      const items = await fetchAll();
      setStage('packing');
      if (format === 'zip') await runZip(items);
      else                   await run7z(items);
      setStage('done');
      toast.success('打包完成，已下載');
      setTimeout(onClose, 1200);
    } catch (e: any) {
      toast.error(e?.message ?? '打包失敗');
      setStage('idle');
    }
  }

  const busy = stage !== 'idle' && stage !== 'done';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-strong liquid-lensing rounded-ios-xl p-6 max-w-md w-full space-y-4 animate-ios-pop"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-[17px] text-primary flex items-center gap-2">
            <Package size={18}/> 打包下載壓縮檔
          </h3>
          {!busy && (
            <button onClick={onClose} aria-label="關閉" className="text-quaternary hover:text-secondary">
              <X size={16}/>
            </button>
          )}
        </div>

        <div className="text-[13px] text-secondary font-display">
          已選 <span className="font-mono font-semibold text-primary">{files.length}</span> 個檔案，
          共 <span className="font-mono font-semibold text-primary">{fmtBytes(totalBytes)}</span>
        </div>

        {tooBig && (
          <div className="liquid-glass-thin liquid-tint-red rounded-ios-md p-3 text-[12px] font-display text-red-300">
            ⚠ 總大小超過 1.5GB，無法在瀏覽器端打包。請分批勾選。
          </div>
        )}
        {!tooBig && overWarn && (
          <div className="liquid-glass-thin liquid-tint-orange rounded-ios-md p-3 text-[12px] font-display">
            ⚠ 總大小過大，建議分批打包以加速並避免瀏覽器記憶體不足
          </div>
        )}

        {/* 格式選擇 */}
        <div className="space-y-2">
          <p className="text-[12px] font-display text-tertiary">選擇格式</p>
          <div className="grid grid-cols-2 gap-2">
            {(['zip','7z'] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                disabled={busy}
                className={`rounded-ios-md py-3 text-[13px] font-display font-semibold transition-all disabled:opacity-50 ${
                  format === f ? 'liquid-tint-blue text-primary' : 'liquid-glass-thin text-tertiary'
                }`}
              >
                .{f}
                <p className="text-[10px] mt-1 opacity-70">
                  {f === 'zip' ? '純打包，相容性高' : '檔名+內容加密，需密碼'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 7z 密碼提示 */}
        {format === '7z' && (
          <div className="liquid-glass-thin rounded-ios-md p-3 text-[12px] font-display text-secondary">
            {pw
              ? <>解壓密碼：<span className="font-mono text-primary">{pw}</span>（請另行通知收件人）</>
              : <span className="text-red-300">⚠ 尚未設定密碼，請管理員至「壓縮密碼」分頁設定</span>}
          </div>
        )}

        {/* 進度 */}
        {busy && (
          <div className="space-y-2">
            <p className="text-[12px] font-display text-tertiary">
              {stage === 'fetching' && `下載中… ${progress.now}/${progress.total}`}
              {stage === 'packing'  && `壓縮中…（${format.toUpperCase()}）`}
            </p>
            <div className="h-1.5 liquid-glass-thin rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: stage === 'fetching'
                    ? `${(progress.now / Math.max(progress.total, 1)) * 100}%`
                    : '100%',
                  background: 'linear-gradient(90deg, var(--tech-blue-500), var(--ios-cyan))',
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 liquid-glass-thin rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-secondary disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={start}
            disabled={busy || tooBig || (format === '7z' && !pw)}
            className="flex-1 rounded-ios-md py-2.5 text-[13px] font-display font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, var(--tech-blue-500), var(--ios-blue), var(--ios-cyan))',
              boxShadow:  '0 4px 14px rgba(10,132,255,0.40)',
            }}
          >
            {stage === 'idle'     && '開始打包'}
            {stage === 'fetching' && '下載中…'}
            {stage === 'packing'  && '壓縮中…'}
            {stage === 'done'     && '✓ 完成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 同名檔案後綴流水號避免被覆蓋
function dedupeNames<T extends { name: string }>(items: T[]): T[] {
  const c = new Map<string, number>();
  return items.map((it) => {
    const n = c.get(it.name) || 0;
    c.set(it.name, n + 1);
    if (n === 0) return it;
    const d = it.name.lastIndexOf('.');
    const name = d > 0 ? `${it.name.slice(0, d)} (${n})${it.name.slice(d)}` : `${it.name} (${n})`;
    return { ...it, name };
  });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
