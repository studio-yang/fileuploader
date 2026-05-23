import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import { listBlocked, unblockIp } from '@/lib/rateLimit';

async function requireAdmin(): Promise<NextResponse | null> {
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ error: '未登入' }, { status: 401 });
  const payload = await verifyToken(token);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!email || !isAdminEmail(email)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const err = await requireAdmin();
  if (err) return err;
  try {
    const list = await listBlocked();
    return NextResponse.json({ list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '讀取失敗' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const err = await requireAdmin();
  if (err) return err;
  const url = new URL(req.url);
  const ip  = (url.searchParams.get('ip') || '').trim();
  if (!ip) return NextResponse.json({ error: 'IP 不可為空' }, { status: 400 });
  try {
    await unblockIp(ip);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '解除失敗' }, { status: 500 });
  }
}
