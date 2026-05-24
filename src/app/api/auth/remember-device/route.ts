import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { generateDeviceToken, rememberDevice } from '@/lib/device';

export async function POST() {
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const payload = await verifyToken(token).catch(() => null);
  const email   = typeof payload?.email === 'string' ? payload.email : '';
  if (!email) return NextResponse.json({ error: '無效 session' }, { status: 401 });

  const deviceToken = generateDeviceToken();
  await rememberDevice(deviceToken, email);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('remembered_device', deviceToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   30 * 24 * 60 * 60, // 30 天
    path:     '/',
  });
  return res;
}
