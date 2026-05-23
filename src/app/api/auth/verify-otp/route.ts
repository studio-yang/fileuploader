import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashOtp, signSession, verifyToken } from '@/lib/auth';

export async function POST(req: Request) {
  const { otp } = await req.json().catch(() => ({ otp: '' }));
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: '請輸入 6 位數字' }, { status: 400 });
  }

  const challenge = cookies().get('otp_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: '驗證碼已過期，請重新請求' }, { status: 400 });
  }

  const payload = await verifyToken(challenge);
  const expect  = await hashOtp(otp);
  if (!payload || payload.h !== expect) {
    return NextResponse.json({ error: '驗證碼錯誤' }, { status: 401 });
  }

  const session = await signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', session, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  });
  res.cookies.set('otp_challenge', '', { maxAge: 0, path: '/' });
  return res;
}
