import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashOtp, signSession, verifyToken, normalizeEmail, isValidEmail } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === 'string' ? body.email : '';
  const otp      = typeof body?.otp   === 'string' ? body.otp   : '';

  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: '請輸入 6 位數字' }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);

  const challenge = cookies().get('otp_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: '驗證碼已過期，請重新請求' }, { status: 400 });
  }

  const payload = await verifyToken(challenge);
  const expect  = await hashOtp(otp);
  if (!payload || payload.h !== expect || payload.e !== email) {
    return NextResponse.json({ error: '驗證碼錯誤或與 Email 不符' }, { status: 401 });
  }

  const session = await signSession(email);
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
