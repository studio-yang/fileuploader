import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { generateOtp, hashOtp, signChallenge } from '@/lib/auth';

export async function POST() {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.OTP_RECIPIENT;
  if (!apiKey || !to) {
    return NextResponse.json({ error: '伺服器未設定 RESEND_API_KEY / OTP_RECIPIENT' }, { status: 500 });
  }

  const otp       = generateOtp();
  const challenge = await signChallenge(await hashOtp(otp));

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:    'CHB FileUploader <onboarding@resend.dev>',
      to,
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
