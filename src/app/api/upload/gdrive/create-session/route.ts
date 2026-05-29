import { NextRequest, NextResponse } from 'next/server';
import { createDriveResumableSession } from '@/lib/providers/gdrive';

export const runtime = 'nodejs';

/**
 * 後端建立 Google Drive Resumable Upload Session
 *
 * 為何在後端做：瀏覽器跨網域帶 Authorization 直接打 Google 偶發 401（且自己會好）。
 * 後端打 Google 已證實 100% 可靠（見 /api/upload/gdrive-health），且內含自動重試。
 * 回傳的 uploadUrl 本身即憑證，前端只需把大塊資料 PUT 上去，不必再帶 token。
 */
export async function POST(req: NextRequest) {
  try {
    const { fileName, mimeType, fileSize } = await req.json();
    if (!fileName || typeof fileSize !== 'number') {
      return NextResponse.json({ error: 'fileName 與 fileSize 為必填' }, { status: 400 });
    }

    const uploadUrl = await createDriveResumableSession(
      fileName,
      mimeType || 'application/octet-stream',
      fileSize,
    );
    return NextResponse.json({ uploadUrl });
  } catch (err: any) {
    console.error('[gdrive-create-session] 重試後仍失敗:', err?.status, err?.message);
    return NextResponse.json(
      { error: err?.message ?? '建立 Drive Session 失敗', code: 'create_session_failed' },
      { status: 502 },
    );
  }
}
