import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import { listBlocked, unblockIp, incrAdminRate, auditLog, getClientIp } from '@/lib/rateLimit';

async function requireAdmin(req?: Request): Promise<{ ok: false; res: NextResponse } | { ok: true; email: string }> {
  const token = cookies().get('session')?.value;
  if (!token) return { ok: false, res: NextResponse.json({ error: '未登入' }, { status: 401 }) };
  const payload = await verifyToken(token);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!email || !isAdminEmail(email)) {
    return { ok: false, res: NextResponse.json({ error: '權限不足' }, { status: 403 }) };
  }

  // 管理員操作速率限制
  if (req) {
    const count = await incrAdminRate(email).catch(() => 0);
    if (count > 100) { // 10 分鐘 100 次
      return { ok: false, res: NextResponse.json({ error: '操作過於頻繁' }, { status: 429 }) };
    }
  }

  return { ok: true, email };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const list = await listBlocked();
    return NextResponse.json({ list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '讀取失敗' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const ip  = (url.searchParams.get('ip') || '').trim();
  if (!ip) return NextResponse.json({ error: 'IP 不可為空' }, { status: 400 });

  try {
    await unblockIp(ip);
    const clientIp = getClientIp(req.headers);
    await auditLog('admin-unblock-ip', auth.email, clientIp, 'success', ip).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '解除失敗' }, { status: 500 });
  }
}
