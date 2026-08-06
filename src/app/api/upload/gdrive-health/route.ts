import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';
// ⚠️ 不可省略：此 handler 的 GET 沒有帶 request 參數，Next.js 會在 build 階段就把回應算好並靜態化。
// Vercel 在建置時就注入環境變數，快照剛好是對的；但 Fly 的 secrets 是執行期才注入，
// 靜態化的結果會永遠回報「環境變數全部缺失」。強制動態才能真的即時檢查。
export const dynamic = 'force-dynamic';

/**
 * Google Drive 健康檢查（診斷用）
 *
 * 用瀏覽器打開 /api/upload/gdrive-health 即可看到：
 *   1. 環境變數是否齊全
 *   2. OAuth refresh_token → access_token 是否能換成功
 *   3. 目標 Drive Folder 是否可存取
 *
 * 401 排錯首選工具。
 */
export async function GET(_req: NextRequest) {
  const result: any = {
    env:    { ok: false, missing: [] as string[], present: {} as Record<string, boolean> },
    oauth:  { ok: false },
    folder: { ok: false },
  };

  // ── Step 1: 環境變數檢查 ────────────────────────────────────────────────
  const required = ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_REFRESH_TOKEN'];
  for (const key of required) {
    result.env.present[key] = Boolean(process.env[key]);
    if (!process.env[key]) result.env.missing.push(key);
  }
  result.env.present['GOOGLE_DRIVE_FOLDER_ID'] = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);
  result.env.ok = result.env.missing.length === 0;
  if (!result.env.ok) return NextResponse.json(result, { status: 200 });

  // ── Step 2: 用 refresh_token 換 access_token ──────────────────────────
  let oauth2: any = null;
  let accessToken: string | null | undefined;
  try {
    oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

    const { token, res } = await oauth2.getAccessToken();
    accessToken = token;
    result.oauth.ok          = Boolean(token);
    result.oauth.tokenLength = token?.length ?? 0;
    result.oauth.expiresIn   = (res?.data as any)?.expires_in;
  } catch (err: any) {
    const data: any = err?.response?.data;
    result.oauth = {
      ok:                false,
      googleError:       data?.error,
      googleDescription: data?.error_description,
      message:           err?.message,
      hint:
        data?.error === 'invalid_grant'        ? 'Refresh Token 已撤銷或過期，請到 OAuth Playground 重新授權' :
        data?.error === 'unauthorized_client'  ? 'Client ID / Secret 不正確' :
        data?.error === 'invalid_client'       ? 'OAuth Client 已被刪除或停用' :
        'OAuth 流程失敗',
    };
    return NextResponse.json(result, { status: 200 });
  }

  // ── Step 3: 用 access_token 試打 Drive API（拿 folder metadata） ──────
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    result.folder = { ok: true, note: '未設定 GOOGLE_DRIVE_FOLDER_ID（檔案會放在根目錄）' };
    return NextResponse.json(result, { status: 200 });
  }
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2 });
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
        err?.response?.status === 404 ? 'Folder ID 不存在或 OAuth 帳號無權限存取' :
        err?.response?.status === 403 ? 'OAuth 帳號對該 Folder 沒有讀寫權限' :
        'Drive API 呼叫失敗',
    };
  }

  return NextResponse.json(result, { status: 200 });
}
