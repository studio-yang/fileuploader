import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { getDevice, getDeviceFingerprint } from '@/lib/device';
import { isWhitelisted } from '@/lib/whitelist';
import { getClientIp, isBlocked, incrRate, blockIp, RATE_MAX, auditLog } from '@/lib/rateLimit';
import { generateOtp, hashOtp, signChallenge, isAdminEmail } from '@/lib/auth';

export async function GET(req: Request) {
  // 讀取裝置 cookie
  const token = cookies().get('remembered_device')?.value;
  if (!token) return NextResponse.json({ found: false });

  // 查詢對應 email 及指紋
  let device = null;
  try { device = await getDevice(token); } catch { return NextResponse.json({ found: false }); }
  if (!device || !device.email) return NextResponse.json({ found: false });

  // 驗證設備指紋（防止盜用）
  const ua = req.headers.get('user-agent') || '';
  const ip = getClientIp(req.headers);
  const currentFingerprint = getDeviceFingerprint(ua, ip);
  if (currentFingerprint !== device.fingerprint) {
    await auditLog('check-device', device.email, ip, 'failure', 'fingerprint mismatch').catch(() => {});
    return NextResponse.json({ found: false });
  }

  const email = device.email;

  // 白名單確認
  const allowed = await isWhitelisted(email).catch(() => false);
  if (!allowed) return NextResponse.json({ found: false });

  // Rate Limit（與 request-otp 相同邏輯）
  const isAdminReq = isAdminEmail(email);
  if (!isAdminReq) {
    const blocked = await isBlocked(ip).catch(() => false);
    if (blocked) return NextResponse.json({ found: false });
  }
  const count = await incrRate(ip).catch(() => 0);
  if (count > RATE_MAX) {
    if (!isAdminReq) await blockIp(ip).catch(() => {});
    return NextResponse.json({ found: false });
  }

  // 自動寄出驗證碼
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ found: false });

  const otp       = generateOtp();
  const challenge = await signChallenge(await hashOtp(otp), email);
  const resend    = new Resend(apiKey);
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
  if (error) return NextResponse.json({ found: false });

  const res = NextResponse.json({ found: true, email });
  res.cookies.set('otp_challenge', challenge, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   300,
    path:     '/',
  });
  return res;
}
