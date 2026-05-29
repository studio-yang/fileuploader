import { google } from 'googleapis';
import { Readable } from 'stream';

// ── OAuth2 auth（後端用） ───────────────────────────────────────────────────
function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob',
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return oauth2;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getOAuth2Client() });
}

/**
 * 取得 OAuth Access Token（供前端 Resumable Upload 使用）
 */
export async function getServiceAccountAccessToken(): Promise<{
  accessToken: string;
  expiresAt:   number;
  folderId:    string;
}> {
  const oauth2 = getOAuth2Client();
  const { token, res } = await oauth2.getAccessToken();
  if (!token) throw new Error('無法取得 OAuth Access Token');
  const expiresIn = (res?.data as any)?.expires_in ?? 3600;
  return {
    accessToken: token,
    expiresAt:   Date.now() + expiresIn * 1000,
    folderId:    process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
  };
}

// ── 暫時性錯誤自動重試（401 傳播延遲 / 429 / 5xx）+ 結構化 log ──────────────────
// 間歇性 401 的根因是「瀏覽器跨網域建 Session」偶發失敗，且會自己好；
// 把憑證相關步驟移到後端並重試，log 會明確記下「第幾次成功」以利日後判讀真兇。
const RETRYABLE_STATUS = new Set([401, 408, 429, 500, 502, 503, 504]);

async function withDriveRetry<T>(
  label:       string,
  fn:          (attempt: number) => Promise<T>,
  maxAttempts: number = 3,
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      if (attempt > 1) {
        console.log(`[gdrive-retry] ${label} 第 ${attempt} 次嘗試成功（前 ${attempt - 1} 次失敗，研判為暫時性錯誤）`);
      }
      return result;
    } catch (err: any) {
      lastErr = err;
      const status: number | undefined = err?.status ?? err?.response?.status ?? err?.code;
      const retryable = typeof status === 'number' && RETRYABLE_STATUS.has(status);
      console.error(`[gdrive-retry] ${label} 第 ${attempt}/${maxAttempts} 次失敗: status=${status ?? 'n/a'}, retryable=${retryable}, msg=${err?.message}`);
      if (!retryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1))); // 400ms → 800ms 指數退避
    }
  }
  throw lastErr;
}

// ── 後端建立 Resumable Upload Session（供前端直傳大檔；含自動重試）─────────────
const DRIVE_RESUMABLE_ENDPOINT =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';

export async function createDriveResumableSession(
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;
  const metadata: Record<string, any> = { name: fileName };
  if (folderId) metadata.parents = [folderId];

  return withDriveRetry('建立 Resumable Session', async () => {
    // 每次嘗試都重換一顆新鮮 access token，避開「剛換出尚未在 Google 全網生效」的暫時性 401
    const { token } = await getOAuth2Client().getAccessToken();
    if (!token) {
      const e: any = new Error('Google 未回傳 Access Token');
      e.status = 401;
      throw e;
    }

    const res = await fetch(DRIVE_RESUMABLE_ENDPOINT, {
      method:  'POST',
      headers: {
        Authorization:             `Bearer ${token}`,
        'Content-Type':            'application/json; charset=UTF-8',
        'X-Upload-Content-Type':   mimeType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const e: any = new Error(`Drive 建立 Session 回應 ${res.status}: ${body.slice(0, 300)}`);
      e.status = res.status;
      throw e;
    }

    const uploadUrl = res.headers.get('Location');
    if (!uploadUrl) {
      const e: any = new Error('Drive 未回傳 Session URL（缺 Location header）');
      e.status = 502;
      throw e;
    }
    return uploadUrl;
  });
}

// ── 後端設定檔案公開可下載權限（含自動重試）─────────────────────────────────────
export async function setDrivePublicPermission(fileId: string): Promise<void> {
  await withDriveRetry('設定公開權限', async () => {
    try {
      await getDriveClient().permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch (err: any) {
      // googleapis 把 HTTP 狀態放在 err.response.status / err.code，正規化到 err.status 供重試判斷
      if (err && err.status == null) err.status = err?.response?.status ?? err?.code;
      throw err;
    }
  });
}

// ── Upload (後端串流上傳，小檔案備用) ─────────────────────────────────────────
export async function uploadToGoogleDrive(
  fileName:    string,
  mimeType:    string,
  stream:      Readable,
  fileSize?:   number,
): Promise<{ fileId: string; downloadUrl: string; webViewLink: string }> {
  const drive    = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

  const res = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  const fileId = res.data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return {
    fileId,
    downloadUrl:  `/api/download/gdrive/${fileId}`,
    webViewLink: res.data.webViewLink ?? '',
  };
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFileItem {
  id:           string;
  name:         string;
  size:         string;
  modifiedTime: string;
  downloadUrl:  string;
  isFolder:     boolean;
}

// ── List files + folders in target folder + 自動設定公開權限 ──────────────────
export async function listGoogleDriveFiles(opts?: { trashed?: boolean }): Promise<DriveFileItem[]> {
  const drive    = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const trashed  = opts?.trashed ?? false;
  const query    = folderId
    ? `'${folderId}' in parents and trashed=${trashed}`
    : `trashed=${trashed} and 'me' in owners`;

  const res = await drive.files.list({
    q:      query,
    fields: 'files(id, name, size, modifiedTime, mimeType, permissions)',
    pageSize: 200,
    orderBy:  'folder,modifiedTime desc',
  });

  const files = res.data.files ?? [];

  // 自動為「沒有公開權限」的檔案加上公開權限（資料夾不需要）
  if (!trashed) {
    await Promise.all(
      files.map(async (f) => {
        if (f.mimeType === FOLDER_MIME) return;
        const hasPublic = f.permissions?.some((p) => p.type === 'anyone' && p.role === 'reader');
        if (!hasPublic) {
          try {
            await drive.permissions.create({
              fileId: f.id!,
              requestBody: { role: 'reader', type: 'anyone' },
              supportsAllDrives: true,
            });
          } catch (err) {
            console.warn(`[gdrive] 無法為 ${f.name} 設定公開權限:`, err);
          }
        }
      }),
    );
  }

  return files.map((f) => ({
    id:           f.id!,
    name:         f.name!,
    size:         f.size ?? '0',
    modifiedTime: f.modifiedTime ?? '',
    downloadUrl:  f.mimeType === FOLDER_MIME ? '' : `/api/download/gdrive/${f.id}`,
    isFolder:     f.mimeType === FOLDER_MIME,
  }));
}

// ── 移到垃圾桶（trashed=true） ─────────────────────────────────────────────
export async function trashGoogleDriveFile(fileId: string): Promise<void> {
  await getDriveClient().files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

// ── 從垃圾桶還原（trashed=false） ─────────────────────────────────────────
export async function restoreGoogleDriveFile(fileId: string): Promise<void> {
  await getDriveClient().files.update({
    fileId,
    requestBody: { trashed: false },
    supportsAllDrives: true,
  });
}

// ── 永久刪除 ───────────────────────────────────────────────────────────────
export async function permanentDeleteGoogleDriveFile(fileId: string): Promise<void> {
  await getDriveClient().files.delete({
    fileId,
    supportsAllDrives: true,
  });
}
