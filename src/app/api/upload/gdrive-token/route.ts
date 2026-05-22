import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountAccessToken } from '@/lib/providers/gdrive';

export const runtime = 'nodejs';

/**
 * GET /api/upload/gdrive-token
 *
 * 後端用 Service Account 換取短效 Access Token，回傳給前端。
 * 前端拿到 token 後直接打 Google Drive API 做 Resumable Upload，
 * 完全不經過 Vercel，突破 4.5 MB body / 60 秒逾時限制。
 *
 * 安全考量：
 * - Token 有效期僅 1 小時，過期自動失效
 * - Scope 限制為 drive.file（只能存取本 App 建立的檔案）
 * - 不在 URL 中傳遞，走 HTTPS JSON response body
 */
export async function GET(req: NextRequest) {
  try {
    const { accessToken, expiresAt, folderId } = await getServiceAccountAccessToken();
    return NextResponse.json({ accessToken, expiresAt, folderId });
  } catch (err: any) {
    console.error('[gdrive-token]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
