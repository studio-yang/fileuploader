import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateOtp, hashOtp, signChallenge, normalizeEmail, isValidEmail, isAdminEmail } from '@/lib/auth';
import { isWhitelisted } from '@/lib/whitelist';
import { getClientIp, isBlocked, incrRate, blockIp, RATE_MAX } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '伺服器未設定 RESEND_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === 'string' ? body.email : '';
  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);
  const isAdminReq = isAdminEmail(email);
  const ip = getClientIp(req.headers);

  // 1. IP 封鎖檢查（管理員 email 豁免，可用自己 email 救援）
  if (!isAdminReq) {
    try {
      if (await isBlocked(ip)) {
        return NextResponse.json({ error: '此來源 IP 已被封鎖，請聯絡管理員' }, { status: 429 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: `KV 連線失敗：${e?.message ?? 'unknown'}` }, { status: 500 });
    }
  }

  // 2. Rate Limit（一律計數，管理員不會被加入封鎖名單）
  try {
    const count = await incrRate(ip);
    if (count > RATE_MAX) {
      if (!isAdminReq) {
        await blockIp(ip);
        return NextResponse.json({ error: '請求過於頻繁，您的 IP 已被封鎖' }, { status: 429 });
      }
      return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `KV 連線失敗：${e?.message ?? 'unknown'}` }, { status: 500 });
  }

  // 3. 白名單檢查
  try {
    const allowed = await isWhitelisted(email);
    if (!allowed) {
      return NextResponse.json({ error: '此信箱未授權登入' }, { status: 403 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `白名單檢查失敗：${e?.message ?? 'unknown'}` }, { status: 500 });
  }

  const otp       = generateOtp();
  const challenge = await signChallenge(await hashOtp(otp), email);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:    'CHB FileUploader <onboarding@resend.dev>',
      to:      email,
      subject: `CHB 檔案傳輸 登入驗證碼：${otp}`,
      html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f6f8fb;border-radius:16px">
  <h2 style="margin:0 0 16px;color:#1a2340">CHB 檔案傳輸登入驗證</h2>
  <p style="color:#444;margin:0 0 24px">您的一次性登入驗證碼為：</p>
  <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0066ff;background:#fff;padding:20px;text-align:center;border-radius:12px;border:1px solid #e3e8f0">${otp}</div>
  <p style="color:#888;font-size:13px;margin:20px 0 0">此驗證碼 5 分鐘內有效，請勿轉發給他人。若非您本人操作，請忽略此信。</p>
</div>`,
    });
    if (error) {
      return NextResponse.json({ error: `寄信失敗：${error.message}` }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `寄信失敗：${e?.message ?? 'unknown'}` }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('otp_challenge', challenge, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   300,
    path:     '/',
  });
  return res;
}
