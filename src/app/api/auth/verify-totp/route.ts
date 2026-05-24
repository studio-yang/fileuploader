import { NextResponse } from 'next/server';
import { normalizeEmail, isAdminEmail, signSession } from '@/lib/auth';
import { getTotpSecret, verifyTotpCode } from '@/lib/totp';

export async function POST(req: Request) {
  const body  = await req.json().catch(() => ({}));
  const raw   = typeof body?.email === 'string' ? body.email : '';
  const code  = typeof body?.code  === 'string' ? body.code  : '';

  if (!raw || !code) return NextResponse.json({ error: '缺少 email 或驗證碼' }, { status: 400 });

  const email = normalizeEmail(raw);

  // TOTP 備援登入僅限管理員
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: '備援驗證碼僅限系統管理員使用' }, { status: 403 });
  }

  // 取得儲存的 TOTP 金鑰
  let secret: string | null = null;
  try { secret = await getTotpSecret(email); } catch (e: any) {
    return NextResponse.json({ error: `伺服器錯誤：${e?.message ?? 'unknown'}` }, { status: 500 });
  }
  if (!secret) {
    return NextResponse.json({ error: '尚未設定備援驗證碼，請先至管理後台設定' }, { status: 400 });
  }

  // 驗證 TOTP 碼
  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: '備援驗證碼錯誤，請確認 App 時間正確' }, { status: 401 });
  }

  // 簽發 session
  const sessionToken = await signSession(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   8 * 60 * 60,
    path:     '/',
  });
  return res;
}
