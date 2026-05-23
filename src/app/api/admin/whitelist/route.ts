import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail, isValidEmail, normalizeEmail } from '@/lib/auth';
import { addToWhitelist, listWhitelist, removeFromWhitelist } from '@/lib/whitelist';

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const token = cookies().get('session')?.value;
  if (!token) return { ok: false, res: NextResponse.json({ error: '未登入' }, { status: 401 }) };
  const payload = await verifyToken(token);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!email || !isAdminEmail(email)) {
    return { ok: false, res: NextResponse.json({ error: '權限不足' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;
  try {
    const list = await listWhitelist();
    return NextResponse.json({ list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '讀取失敗' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const raw  = typeof body?.email === 'string' ? body.email : '';
  if (!isValidEmail(raw)) {
    return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  }
  try {
    await addToWhitelist(normalizeEmail(raw));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '新增失敗' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;
  const url   = new URL(req.url);
  const email = url.searchParams.get('email') || '';
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  }
  try {
    await removeFromWhitelist(normalizeEmail(email));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '刪除失敗' }, { status: 400 });
  }
}
