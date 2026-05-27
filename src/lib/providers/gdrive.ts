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
