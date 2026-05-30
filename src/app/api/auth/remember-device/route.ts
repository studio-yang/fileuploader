import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { generateDeviceToken, rememberDevice, getDeviceFingerprint } from '@/lib/device';

export async function POST(req: Request) {
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const payload = await verifyToken(token).catch(() => null);
  const email   = typeof payload?.email === 'string' ? payload.email : '';
  if (!email) return NextResponse.json({ error: '無效 session' }, { status: 401 });

  // 計算設備指紋（UA-only，避免 IP 漂移誤判）
  const ua = req.headers.get('user-agent') || '';
  const fingerprint = getDeviceFingerprint(ua);

  const deviceToken = generateDeviceToken();
  await rememberDevice(deviceToken, email, fingerprint);

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
