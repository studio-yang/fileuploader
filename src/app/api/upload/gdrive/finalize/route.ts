import { NextRequest, NextResponse } from 'next/server';
import { setDrivePublicPermission } from '@/lib/providers/gdrive';

export const runtime = 'nodejs';

/**
 * 上傳完成後，後端設定該檔案的公開可下載權限（含自動重試）
 * 同樣移到後端，避免瀏覽器跨網域帶 Authorization 的偶發 401。
 */
export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: 'fileId 為必填' }, { status: 400 });
    }

    await setDrivePublicPermission(fileId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[gdrive-finalize] 重試後仍失敗:', err?.status, err?.message);
    return NextResponse.json(
      { error: err?.message ?? '設定公開權限失敗', code: 'finalize_failed' },
      { status: 502 },
    );
  }
}
