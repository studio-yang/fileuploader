import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountAccessToken } from '@/lib/providers/gdrive';

export const runtime = 'nodejs';

/**
 * 取得 Google Drive Access Token（供前端 Resumable Upload 使用）
 *
 * 用 Service Account JWT 自動取得，永不過期。
 * env var: GOOGLE_DRIVE_SA_KEY（Service Account JSON 的 base64 編碼）
 */
export async function GET(_req: NextRequest) {
  if (!process.env.GOOGLE_DRIVE_SA_KEY) {
    return NextResponse.json(
      {
        error: 'Vercel 環境變數 GOOGLE_DRIVE_SA_KEY 未設定',
        code:  'missing_env',
        missing: ['GOOGLE_DRIVE_SA_KEY'],
      },
      { status: 500 },
    );
  }

  try {
    const { accessToken, expiresAt, folderId } = await getServiceAccountAccessToken();
    // 提前 5 分鐘標記過期，避免前端拿到「即將過期」的 token 上傳到一半 401
    const safeExpiresAt = Math.min(expiresAt, Date.now() + (3600 - 300) * 1000);
    return NextResponse.json({ accessToken, expiresAt: safeExpiresAt, folderId });
  } catch (err: any) {
    console.error('[gdrive-token]', err?.message);
    return NextResponse.json(
      {
        error: err?.message || 'Service Account 取得 token 失敗',
        code:  'sa_error',
        hint:  '請確認 GOOGLE_DRIVE_SA_KEY 是有效的 base64 JSON，且 Service Account 已被分享到目標 Drive 資料夾',
      },
      { status: 500 },
    );
  }
}
