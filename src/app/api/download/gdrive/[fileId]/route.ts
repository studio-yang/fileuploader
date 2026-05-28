import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob',
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return oauth2;
}

// Google Docs 編輯器格式 → 匯出成 Office / PDF 格式
const EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document':     { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   ext: '.docx' },
  'application/vnd.google-apps.spreadsheet':  { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         ext: '.xlsx' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: '.pptx' },
  'application/vnd.google-apps.drawing':      { mimeType: 'image/png',                                                                  ext: '.png'  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } },
) {
  try {
    const { fileId } = params;
    const oauth2 = getOAuth2Client();
    const { token } = await oauth2.getAccessToken();
    if (!token) throw new Error('無法取得 Access Token');

    // 1. 取得檔名與 mimeType
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const meta = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size',
      supportsAllDrives: true,
    });
    let fileName = meta.data.name ?? 'download';
    const mimeType = meta.data.mimeType ?? 'application/octet-stream';

    // 2. 判斷是否為 Google Docs 編輯器格式
    const exportInfo = EXPORT_MAP[mimeType];
    let driveUrl: string;
    let outputMimeType: string;

    if (exportInfo) {
      // Google Docs 編輯器格式 → 匯出
      driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportInfo.mimeType)}`;
      outputMimeType = exportInfo.mimeType;
      // 補上副檔名（如果原檔名沒有）
      if (!fileName.toLowerCase().endsWith(exportInfo.ext)) {
        fileName += exportInfo.ext;
      }
    } else {
      // 一般檔案 → 直接下載
      driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      outputMimeType = mimeType;
    }

    // 3. 從 Google Drive 抓檔案內容
    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!driveRes.ok || !driveRes.body) {
      const text = await driveRes.text();
      return NextResponse.json(
        { error: `Drive 下載失敗: ${driveRes.status} ${text}` },
        { status: 500 },
      );
    }

    // 4. 轉發給使用者
    const encodedFileName = encodeURIComponent(fileName);
    return new NextResponse(driveRes.body, {
      status: 200,
      headers: {
        'Content-Type': outputMimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      },
    });
  } catch (err: any) {
    console.error('[download/gdrive]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
