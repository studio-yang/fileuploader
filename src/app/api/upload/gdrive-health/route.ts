import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthClient } from '@/lib/providers/gdrive';

export const runtime = 'nodejs';

/**
 * Google Drive 健康檢查（診斷用）
 *
 * 用瀏覽器打開 /api/upload/gdrive-health 即可看到：
 *   1. GDRIVE_SERVICE_ACCOUNT_KEY 是否齊全
 *   2. Service Account JWT 是否能換 access_token
 *   3. 目標 Drive Folder 是否分享給 SA 且可存取
 */
export async function GET(_req: NextRequest) {
  const result: any = {
    env:    { ok: false, present: {} as Record<string, boolean> },
    sa:     { ok: false },
    folder: { ok: false },
  };

  // ── Step 1: env var 檢查 ────────────────────────────────────────────
  result.env.present['GDRIVE_SERVICE_ACCOUNT_KEY']    = Boolean(process.env.GDRIVE_SERVICE_ACCOUNT_KEY);
  result.env.present['GOOGLE_DRIVE_FOLDER_ID'] = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);
  result.env.ok = result.env.present['GDRIVE_SERVICE_ACCOUNT_KEY'];
  if (!result.env.ok) {
    result.env.hint = 'GDRIVE_SERVICE_ACCOUNT_KEY 未設定。請至 Vercel Env Var 加入 Service Account JSON 的 base64 編碼內容。';
    return NextResponse.json(result, { status: 200 });
  }

  // ── Step 2: Service Account JWT 換 access_token ────────────────────
  let auth: any = null;
  try {
    auth = getAuthClient();
    const { access_token, expiry_date } = await auth.authorize();
    result.sa.ok          = Boolean(access_token);
    result.sa.tokenLength = access_token?.length ?? 0;
    result.sa.expiresAt   = expiry_date;
    result.sa.email       = (auth as any).email;
  } catch (err: any) {
    result.sa = {
      ok:      false,
      message: err?.message,
      hint:    'Service Account JSON 可能格式錯誤或 private_key 損毀。請重新從 GCP 下載 JSON 並 base64 編碼。',
    };
    return NextResponse.json(result, { status: 200 });
  }

  // ── Step 3: 試打 Drive API（拿 folder metadata） ────────────────────
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    result.folder = { ok: true, note: '未設定 GOOGLE_DRIVE_FOLDER_ID（SA 上傳的檔案將沒有父資料夾）' };
    return NextResponse.json(result, { status: 200 });
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    result.folder = {
      ok:       true,
      id:       meta.data.id,
      name:     meta.data.name,
      isFolder: meta.data.mimeType === 'application/vnd.google-apps.folder',
    };
  } catch (err: any) {
    result.folder = {
      ok:      false,
      status:  err?.response?.status,
      message: err?.message,
      hint:
        err?.response?.status === 404 ? `Folder ID 不存在，或未把資料夾分享給 SA email：${result.sa.email}` :
        err?.response?.status === 403 ? `SA 對該 Folder 沒有編輯權限。請在 Drive 把資料夾分享給 ${result.sa.email}（編輯者）` :
        'Drive API 呼叫失敗',
    };
  }

  return NextResponse.json(result, { status: 200 });
}
