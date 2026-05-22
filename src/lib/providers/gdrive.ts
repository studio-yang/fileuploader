import { google } from 'googleapis';
import { Readable } from 'stream';

// ── Service Account auth（後端用） ────────────────────────────────────────────
function getServiceAccountAuth() {
  const keyBase64 = process.env.GDRIVE_SERVICE_ACCOUNT_KEY ?? '';
  const credentials = JSON.parse(
    Buffer.from(keyBase64, 'base64').toString('utf-8'),
  );
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

/**
 * 取得 Service Account 的短效 Access Token（有效期約 1 小時）
 * 供前端直接打 Google Drive API 使用
 */
export async function getServiceAccountAccessToken(): Promise<{
  accessToken: string;
  expiresAt:   number; // Unix ms
  folderId:    string;
}> {
  const auth   = getServiceAccountAuth();
  const client = await auth.getClient();
  const token  = await client.getAccessToken();
  if (!token.token) throw new Error('無法取得 Service Account Access Token');

  // token.res?.data?.expires_in 通常是 3600 秒
  const expiresIn = (token.res?.data as any)?.expires_in ?? 3600;

  return {
    accessToken: token.token,
    expiresAt:   Date.now() + expiresIn * 1000,
    folderId:    process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
  };
}

// ── OAuth2 auth（後端串流上傳，小型檔案用，保留相容） ─────────────────────────
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

// ── Upload (resumable multipart, supports large files) ────────────────────────
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
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  const fileId = res.data.id!;

  // Make file publicly readable so we can share the link
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return {
    fileId,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    webViewLink: res.data.webViewLink ?? '',
  };
}

// ── List files in target folder ───────────────────────────────────────────────
export async function listGoogleDriveFiles(): Promise<
  { id: string; name: string; size: string; modifiedTime: string; downloadUrl: string }[]
> {
  const drive    = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const query    = folderId
    ? `'${folderId}' in parents and trashed=false`
    : "trashed=false and 'me' in owners";

  const res = await drive.files.list({
    q:      query,
    fields: 'files(id, name, size, modifiedTime)',
    pageSize: 100,
    orderBy:  'modifiedTime desc',
  });

  return (res.data.files ?? []).map((f) => ({
    id:           f.id!,
    name:         f.name!,
    size:         f.size ?? '0',
    modifiedTime: f.modifiedTime ?? '',
    downloadUrl:  `https://drive.google.com/uc?export=download&id=${f.id}`,
  }));
}
