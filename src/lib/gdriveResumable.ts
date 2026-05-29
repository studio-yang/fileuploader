/**
 * Google Drive Resumable Upload — 後端建 Session + 瀏覽器直傳大塊資料
 *
 * 流程（v2，2026-05-29 改）：
 * 1. 後端 /api/upload/gdrive/create-session → 後端用憑證建立 Session（含自動重試），回傳 uploadUrl
 * 2. 瀏覽器把 8 MB chunks PUT 到 uploadUrl（session URL 本身即憑證，不需 Authorization header）
 * 3. 上傳完成取得 fileId → 後端 /api/upload/gdrive/finalize 設定公開權限（含自動重試）
 *
 * 為何這樣改：需要憑證的步驟（建 Session、設權限）偶發性跨網域 401 且會自己好；
 * 改由「已證實可靠的後端」執行並重試，瀏覽器只負責搬大資料，繞開跨網域脆弱性。
 * 此模式與既有 GCS 上傳（/api/upload/presigned + resumableChunkUpload）一致。
 *
 * 參考：https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */

export const GDRIVE_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB（必須是 256 KB 的倍數）

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Step 1: 後端建立 Resumable Session ───────────────────────────────────────
async function createDriveSession(
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<string> {
  const res = await fetch('/api/upload/gdrive/create-session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fileName, mimeType, fileSize }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '建立 Session 失敗' }));
    throw new Error(error ?? '建立 Session 失敗');
  }
  const { uploadUrl } = await res.json();
  if (!uploadUrl) throw new Error('後端未回傳 Upload Session URL');
  return uploadUrl;
}

// ── Step 3: 後端設定公開可下載權限 ───────────────────────────────────────────
async function finalizeDriveUpload(fileId: string): Promise<void> {
  const res = await fetch('/api/upload/gdrive/finalize', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fileId }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '設定公開權限失敗' }));
    throw new Error(error ?? '設定公開權限失敗');
  }
}

// ── 單一 chunk PUT，含對網路瞬斷 / 5xx 的輕量重試 ──────────────────────────────
// 重送相同 Content-Range 對 resumable 上傳是冪等的，故重試安全。
async function putChunkWithRetry(
  uploadUrl: string,
  chunk:     Blob,
  offset:    number,
  end:       number,
  totalSize: number,
  fileType:  string,
  signal?:   AbortSignal,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(uploadUrl, {
        method:  'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
          'Content-Type':  fileType || 'application/octet-stream',
        },
        body:   chunk,
        signal,
      });
      // 只對 5xx 重試；2xx / 308 / 4xx 交給呼叫端依協定判斷
      if (res.status >= 500 && attempt < maxAttempts) {
        lastErr = new Error(`Chunk 暫時性錯誤 HTTP ${res.status}`);
        await delay(400 * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err: any) {
      if (signal?.aborted) throw err;          // 使用者主動取消，不重試
      lastErr = err;
      if (attempt < maxAttempts) {
        await delay(400 * 2 ** (attempt - 1)); // 網路瞬斷 → 退避後重送同一塊
        continue;
      }
    }
  }
  throw lastErr;
}

// ── Step 2: 瀏覽器分塊上傳（PUT 到 session URL，不需 Authorization）─────────────
async function driveResumableUpload(
  uploadUrl:  string,
  file:       File,
  onProgress: (percent: number, speed: number, eta: number) => void,
  signal?:    AbortSignal,
): Promise<string> {
  const totalSize = file.size;
  let   offset    = 0;
  const startTime = Date.now();
  let   fileId    = '';

  while (offset < totalSize) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    const end   = Math.min(offset + GDRIVE_CHUNK_SIZE, totalSize);
    const chunk = file.slice(offset, end);

    const res = await putChunkWithRetry(
      uploadUrl, chunk, offset, end, totalSize, file.type, signal,
    );

    // 308 Resume Incomplete = chunk 成功，繼續下一塊
    // 200 / 201 = 全部完成
    if (res.status === 308) {
      const rangeHeader = res.headers.get('Range');
      offset = rangeHeader
        ? parseInt(rangeHeader.split('-')[1]) + 1
        : end;
    } else if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      fileId = data.id;
      offset = end;
    } else {
      const text = await res.text();
      throw new Error(`Chunk 上傳失敗: HTTP ${res.status} — ${text}`);
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const speed   = elapsed > 0 ? offset / elapsed : 0;
    const pct     = Math.round((offset / totalSize) * 100);
    const eta     = speed > 0 ? (totalSize - offset) / speed : 0;
    onProgress(Math.min(pct, 99), speed, eta); // 99% 等設定權限後才 100%
  }

  if (!fileId) throw new Error('Drive 未回傳 fileId');
  return fileId;
}

// ── 一站式：後端建 session → 瀏覽器分塊上傳 → 後端設權限 ─────────────────────────
export async function uploadToGoogleDriveDirect(
  file:       File,
  onProgress: (percent: number, speed: number, eta: number) => void,
  signal?:    AbortSignal,
): Promise<{ fileId: string; downloadUrl: string }> {
  const mimeType = file.type || 'application/octet-stream';

  // 1. 後端建立 Resumable Session（含重試）
  const uploadUrl = await createDriveSession(file.name, mimeType, file.size);

  // 2. 瀏覽器分塊直傳到 session URL
  const fileId = await driveResumableUpload(uploadUrl, file, onProgress, signal);

  // 3. 後端設定公開權限（含重試）
  await finalizeDriveUpload(fileId);
  onProgress(100, 0, 0);

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return { fileId, downloadUrl };
}
