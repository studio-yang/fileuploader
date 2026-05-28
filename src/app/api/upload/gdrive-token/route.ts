import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

/**
 * 取得 Google Drive Access Token（供前端 Resumable Upload 使用）
 *
 * 失敗時回傳 structured error，前端在 Network panel 可直接看到根因：
 *   - missing_env       : Vercel 缺哪個環境變數
 *   - invalid_grant     : Refresh Token 已過期或被撤銷 → 需重新跑 OAuth Playground
 *   - unauthorized_client : Client ID / Secret 不對 → 對 GCP Console 設定
 *   - other             : 原始 Google 錯誤訊息
 */
export async function GET(_req: NextRequest) {
  // ── Step 1: 環境變數完整性檢查 ──────────────────────────────────────────────
  const missing: string[] = [];
  if (!process.env.GOOGLE_DRIVE_CLIENT_ID)     missing.push('GOOGLE_DRIVE_CLIENT_ID');
  if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET) missing.push('GOOGLE_DRIVE_CLIENT_SECRET');
  if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) missing.push('GOOGLE_DRIVE_REFRESH_TOKEN');
  if (missing.length) {
    return NextResponse.json(
      {
        error: `Vercel 環境變數缺失: ${missing.join(', ')}`,
        code:  'missing_env',
        missing,
      },
      { status: 500 },
    );
  }

  // ── Step 2: 用 refresh_token 換 access_token ──────────────────────────────
  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    oauth2.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    const { token, res } = await oauth2.getAccessToken();
    if (!token) {
      return NextResponse.json(
        {
          error: '無法取得 Access Token（Google 未回傳）',
          code:  'no_token',
        },
        { status: 500 },
      );
    }

    const expiresIn = (res?.data as any)?.expires_in ?? 3600;
    // ⚠️ 提前 5 分鐘標記過期，避免前端拿到「即將過期」的 token 上傳到一半 401
    const expiresAt = Date.now() + (expiresIn - 300) * 1000;

    return NextResponse.json({
      accessToken: token,
      expiresAt,
      folderId:    process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
    });
  } catch (err: any) {
    // 解析 Google OAuth 錯誤回應（err.response?.data 通常含 error / error_description）
    const data: any = err?.response?.data;
    const googleCode = data?.error;           // invalid_grant / unauthorized_client / ...
    const googleDesc = data?.error_description;

    console.error('[gdrive-token]', { googleCode, googleDesc, message: err?.message });

    // 對常見錯誤給出明確的修補指引
    let hint = '';
    if (googleCode === 'invalid_grant') {
      hint = 'Refresh Token 已被撤銷或過期。請到 https://developers.google.com/oauthplayground 重新授權，取得新 refresh_token 並更新 Vercel 環境變數。';
    } else if (googleCode === 'unauthorized_client') {
      hint = 'Client ID / Secret 不正確。請到 GCP Console → APIs & Services → Credentials 對照確認。';
    } else if (googleCode === 'invalid_client') {
      hint = 'OAuth Client 已被刪除或停用。請到 GCP Console 確認 OAuth Client 仍存在。';
    }

    return NextResponse.json(
      {
        error: hint || err?.message || 'OAuth Token 取得失敗',
        code:  googleCode ?? 'oauth_error',
        googleError:       googleCode,
        googleDescription: googleDesc,
      },
      { status: 500 },
    );
  }
}
