import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import { getRedis } from '@/lib/redis';

function redis() {
  try { return getRedis(); } catch { return null; }
}

const KEY = 'audit:log';
const MAX = 500;

async function requireAdmin(): Promise<boolean> {
  const token = cookies().get('session')?.value;
  if (!token) return false;
  const payload = await verifyToken(token).catch(() => null);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  return isAdminEmail(email);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  try {
    const { action, details } = await req.json();
    if (!action) return NextResponse.json({ ok: false }, { status: 400 });
    const r = redis();
    if (!r) return NextResponse.json({ ok: true });
    const entry = JSON.stringify({ action, details, ts: Date.now() });
    await r.zadd(KEY, Date.now(), entry);
    await r.zremrangebyrank(KEY, 0, -(MAX + 1));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  try {
    const r = redis();
    if (!r) return NextResponse.json({ logs: [] });
    const raw = await r.zrevrange(KEY, 0, 99, 'WITHSCORES');
    const logs: object[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      try { logs.push({ ...JSON.parse(raw[i]), ts: Number(raw[i + 1]) }); } catch {}
    }
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}
