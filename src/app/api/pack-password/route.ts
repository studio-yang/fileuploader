import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import IORedis from 'ioredis';

const KEY = 'pack:password';
let _r: IORedis | null = null;
function redis() {
  if (_r) return _r;
  _r = new IORedis(process.env.REDIS_URL || '', { maxRetriesPerRequest: 3, enableReadyCheck: false });
  return _r;
}

async function getEmail() {
  const token = cookies().get('session')?.value;
  if (!token) return null;
  const p = await verifyToken(token);
  return typeof p?.email === 'string' ? p.email : null;
}

export async function GET() {
  const email = await getEmail();
  if (!email) return NextResponse.json({ error: '未登入' }, { status: 401 });
  const raw = await redis().get(KEY);
  const data = raw ? JSON.parse(raw) : null;
  return NextResponse.json({
    password:         data?.password         ?? '',
    compressionLevel: data?.compressionLevel ?? 9,
    updatedAt:        data?.updatedAt        ?? 0,
  });
}

export async function POST(req: Request) {
  const email = await getEmail();
  if (!email || !isAdminEmail(email))
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const lvl = Number(body?.compressionLevel);
  const compressionLevel = Number.isInteger(lvl) && lvl >= 0 && lvl <= 9 ? lvl : 9;
  if (password.length < 1)
    return NextResponse.json({ error: '密碼不可為空' }, { status: 400 });
  await redis().set(KEY, JSON.stringify({ password, compressionLevel, updatedAt: Date.now() }));
  return NextResponse.json({ ok: true });
}
