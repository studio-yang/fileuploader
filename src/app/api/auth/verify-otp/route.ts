import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashOtp, signSession, verifyToken, normalizeEmail, isValidEmail } from '@/lib/auth';
import { incrOtpAttempt, resetOtpAttempt, getClientIp, auditLog } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === 'string' ? body.email : '';
  const otp      = typeof body?.otp   === 'string' ? body.otp   : '';
  const ip = getClientIp(req.headers);

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

  // 防暴力破解：驗證失敗次數限制
  const attempts = await incrOtpAttempt(email);
  if (attempts > 5) {
    await auditLog('verify-otp', email, ip, 'failure', 'too many attempts').catch(() => {});
    return NextResponse.json({ error: '驗證碼輸入次數過多，請重新請求' }, { status: 429 });
  }

  const payload = await verifyToken(challenge);
  const expect  = await hashOtp(otp);
  if (!payload || payload.h !== expect || payload.e !== email) {
    await auditLog('verify-otp', email, ip, 'failure', 'invalid code').catch(() => {});
    return NextResponse.json({ error: '驗證碼錯誤或與 Email 不符' }, { status: 401 });
  }

  // 驗證成功，清除失敗計數
  await resetOtpAttempt(email);
  await auditLog('verify-otp', email, ip, 'success').catch(() => {});

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
