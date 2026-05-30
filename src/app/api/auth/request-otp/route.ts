import { NextResponse } from 'next/server';
import { generateOtp, hashOtp, signChallenge, normalizeEmail, isValidEmail, isAdminEmail } from '@/lib/auth';
import { isWhitelisted } from '@/lib/whitelist';
import { getClientIp, isBlocked, incrRate, blockIp, RATE_MAX } from '@/lib/rateLimit';
import { sendBlockNotification } from '@/lib/blockNotify';

export async function POST(req: Request) {
  const apiKey    = process.env.BREVO_API_KEY;
  const sender    = process.env.BREVO_SENDER;
  if (!apiKey || !sender) {
    return NextResponse.json({ error: '伺服器未設定 BREVO_API_KEY / BREVO_SENDER' }, { status: 500 });
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
        // 非同步寄通知信給管理員（不阻塞回應）
        sendBlockNotification({
          ip, email, headers: req.headers,
          reason: `3 分鐘內請求超過 ${RATE_MAX} 次`,
        }).catch(() => {});
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
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'CHB FileUploader', email: sender },
        to:          [{ email }],
        subject:     'CHB 檔案傳輸 - 登入驗證',
        htmlContent: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f6f8fb;border-radius:16px">
  <h2 style="margin:0 0 16px;color:#1a2340">CHB 檔案傳輸登入驗證</h2>
  <p style="color:#444;margin:0 0 24px">您的一次性登入驗證碼為：</p>
  <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#0066ff;background:#fff;padding:20px;text-align:center;border-radius:12px;border:1px solid #e3e8f0">${otp}</div>
  <p style="color:#888;font-size:13px;margin:20px 0 0">此驗證碼 5 分鐘內有效，請勿轉發給他人。若非您本人操作，請忽略此信。</p>
</div>`,
      }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      return NextResponse.json({ error: `寄信失敗：${(e as any)?.message ?? resp.status}` }, { status: 502 });
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
