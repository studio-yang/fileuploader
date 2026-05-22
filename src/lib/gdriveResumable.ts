/**
 * Google Drive Resumable Upload — 瀏覽器端直傳
 *
 * 流程：
 * 1. 後端 /api/upload/gdrive-token  → 取得 Access Token + folderId
 * 2. 打 Drive API 建立 Resumable Session，取得 uploadUrl
 * 3. 用 8 MB chunks 分塊 PUT 到 uploadUrl（直接到 Google，不過 Vercel）
 * 4. 最後一塊回傳 fileId，設定公開權限，組出下載連結
 *
 * 參考：https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */

const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API_BASE    = 'https://www.googleapis.com/drive/v3';
export const GDRIVE_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB（必須是 256 KB 的倍數）

interface TokenInfo {
  accessToken: string;
  expiresAt:   number;
  folderId:    string;
}

// ── Step 1: 向後端拿 Access Token ────────────────────────────────────────────
export async function fetchDriveToken(): Promise<TokenInfo> {
  const res = await fetch('/api/upload/gdrive-token');
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Token 取得失敗' }));
    throw new Error(error ?? 'Token 取得失敗');
  }
  return res.json();
}

// ── Step 2: 建立 Resumable Upload Session ─────────────────────────────────────
export async function initDriveResumableSession(
  accessToken: string,
  fileName:    string,
  mimeType:    string,
  fileSize:    number,
  folderId?:   string,
): Promise<string> {
  const metadata: Record<string, any> = { name: fileName };
  if (folderId) metadata.parents = [folderId];

  const res = await fetch(
    `${DRIVE_UPLOAD_BASE}?uploadType=resumable&supportsAllDrives=true`,
    {
      method:  'POST',
      headers: {
        Authorization:           `Bearer ${accessToken}`,
        'Content-Type':          'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`建立 Drive Resumable Session 失敗: ${res.status} ${text}`);
  }

  const uploadUrl = res.headers.get('Location');
  if (!uploadUrl) throw new Error('Drive 未回傳 Upload Session URL');
  return uploadUrl;
}

// ── Step 3: 分塊上傳 ──────────────────────────────────────────────────────────
export async function driveResumableUpload(
  uploadUrl:   string,
  accessToken: string,
  file:        File,
  onProgress:  (percent: number, speed: number, eta: number) => void,
  signal?:     AbortSignal,
): Promise<{ fileId: string; downloadUrl: string }> {
  const totalSize = file.size;
  let   offset    = 0;
  const startTime = Date.now();
  let   fileId    = '';

  while (offset < totalSize) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    const end   = Math.min(offset + GDRIVE_CHUNK_SIZE, totalSize);
    const chunk = file.slice(offset, end);
    const isLast = end === totalSize;

    const res = await fetch(uploadUrl, {
      method:  'PUT',
      headers: {
        Authorization:   `Bearer ${accessToken}`,
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
        'Content-Type':  file.type || 'application/octet-stream',
      },
      body:   chunk,
      signal,
    });

    // 308 Resume Incomplete = chunk 成功，繼續下一塊
    // 200 / 201 = 全部完成
    if (res.status === 308) {
      const rangeHeader = res.headers.get('Range');
      // Range: bytes=0-{n}，n+1 是下一塊的起點
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

    // 進度回報
    const elapsed = (Date.now() - startTime) / 1000;
    const speed   = elapsed > 0 ? offset / elapsed : 0;
    const pct     = Math.round((offset / totalSize) * 100);
    const eta     = speed > 0 ? (totalSize - offset) / speed : 0;
    onProgress(Math.min(pct, 99), speed, eta); // 99% 等設定權限後才 100%
  }

  if (!fileId) throw new Error('Drive 未回傳 fileId');

  // ── Step 4: 設定公開可下載權限 ──────────────────────────────────────────────
  await fetch(`${DRIVE_API_BASE}/files/${fileId}/permissions?supportsAllDrives=true`, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return { fileId, downloadUrl };
}

// ── 一站式：取 token → 建 session → 分塊上傳 ─────────────────────────────────
export async function uploadToGoogleDriveDirect(
  file:       File,
  onProgress: (percent: number, speed: number, eta: number) => void,
  signal?:    AbortSignal,
): Promise<{ fileId: string; downloadUrl: string }> {
  // 1. 取 token
  const { accessToken, folderId } = await fetchDriveToken();

  // 2. 建立 Resumable Session
  const mimeType  = file.type || 'application/octet-stream';
  const uploadUrl = await initDriveResumableSession(
    accessToken,
    file.name,
    mimeType,
    file.size,
    folderId || undefined,
  );

  // 3. 分塊上傳
  return driveResumableUpload(uploadUrl, accessToken, file, onProgress, signal);
}
