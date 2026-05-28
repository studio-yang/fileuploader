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

// GET: 任何已登入者可讀（前端 7z 加密需要）
export async function GET() {
  const email = await getEmail();
  if (!email) return NextResponse.json({ error: '未登入' }, { status: 401 });
  const raw = await redis().get(KEY);
  const data = raw ? JSON.parse(raw) : null;
  return NextResponse.json({
    password:  data?.password  ?? '',
    updatedAt: data?.updatedAt ?? 0,
  });
}

// POST: 僅 admin 可改
export async function POST(req: Request) {
  const email = await getEmail();
  if (!email || !isAdminEmail(email))
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 1)
    return NextResponse.json({ error: '密碼不可為空' }, { status: 400 });
  await redis().set(KEY, JSON.stringify({ password, updatedAt: Date.now() }));
  return NextResponse.json({ ok: true });
}
