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

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } },
) {
  try {
    const { fileId } = params;
    const oauth2 = getOAuth2Client();
    const { token } = await oauth2.getAccessToken();
    if (!token) throw new Error('無法取得 Access Token');

    // 1. 先取得檔名與 mimeType
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const meta = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size',
      supportsAllDrives: true,
    });
    const fileName = meta.data.name ?? 'download';
    const mimeType = meta.data.mimeType ?? 'application/octet-stream';

    // 2. 用 Access Token 從 Google Drive 抓檔案內容（串流）
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!driveRes.ok || !driveRes.body) {
      const text = await driveRes.text();
      return NextResponse.json(
        { error: `Drive 下載失敗: ${driveRes.status} ${text}` },
        { status: 500 },
      );
    }

    // 3. 轉發給使用者，附上正確的檔名與 Content-Type
    const encodedFileName = encodeURIComponent(fileName);
    return new NextResponse(driveRes.body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      },
    });
  } catch (err: any) {
    console.error('[download/gdrive]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
