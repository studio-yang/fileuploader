import { SignJWT } from 'jose';

const BASE_URL = 'https://chb-fileuploader.vercel.app';

function getSecret() {
  const s = process.env.AUTH_SECRET || '';
  return new TextEncoder().encode(s);
}

// 從 User-Agent 解析裝置資訊
function parseUserAgent(ua: string): string {
  const isMobile = /Mobile|Android|iPhone/i.test(ua) && !/iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const deviceType = isMobile ? '手機' : isTablet ? '平板' : '桌機';

  let browser = '不明瀏覽器';
  if (/Edg\//.test(ua))        browser = 'Edge';
  else if (/OPR\//.test(ua))   browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua))   browser = 'Safari';

  let os = '不明系統';
  if (/Windows/.test(ua))        os = 'Windows';
  else if (/Android/.test(ua))   os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua))  os = 'macOS';
  else if (/Linux/.test(ua))     os = 'Linux';

  return `${deviceType} · ${browser} · ${os}`;
}

// 產生帶簽章的 email 動作 URL（7 天有效）
async function makeActionToken(action: 'unblock' | 'whitelist', ip: string, email: string): Promise<string> {
  const token = await new SignJWT({ action, ip, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
  return `${BASE_URL}/api/admin/block-action?token=${encodeURIComponent(token)}`;
}

// 台灣時間格式化
function fmtTaipei(ms: number): string {
  return new Date(ms).toLocaleString('zh-TW', {
    timeZone:  'Asia/Taipei',
    hour12:    false,
    year:      'numeric',
    month:     '2-digit',
    day:       '2-digit',
    hour:      '2-digit',
    minute:    '2-digit',
    second:    '2-digit',
  });
}

export interface BlockNotifyOptions {
  ip:      string;
  email:   string;   // 嘗試登入的 email
  headers: Headers;
  reason:  string;
}

export async function sendBlockNotification(opts: BlockNotifyOptions): Promise<void> {
  const apiKey      = process.env.BREVO_API_KEY;
  const sender      = process.env.BREVO_SENDER;
  const adminEmail  = (process.env.OTP_RECIPIENT || '').trim();
  if (!apiKey || !sender || !adminEmail) return;

  const { ip, email, headers, reason } = opts;
  const now = Date.now();

  // 地理位置（Vercel 自動注入）
  const countryCode = headers.get('x-vercel-ip-country') || '';
  const city        = headers.get('x-vercel-ip-city')    || '';
  const countryName = countryCode
    ? (new Intl.DisplayNames(['zh-TW'], { type: 'region' }).of(countryCode) ?? countryCode)
    : '不明';
  const location = [city, countryName].filter(Boolean).join(' · ');

  // 裝置
  const ua      = headers.get('user-agent') || '';
  const device  = parseUserAgent(ua);

  // 動作按鈕 URL
  const unblockUrl  = await makeActionToken('unblock',   ip, email);
  const whitelistUrl = email ? await makeActionToken('whitelist', ip, email) : '';

  const html = `
<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f6f8fb;border-radius:16px">
  <div style="background:#ff3b30;color:#fff;padding:4px 10px;border-radius:6px;display:inline-block;font-size:12px;font-weight:600;margin-bottom:16px">⚠ IP 封鎖警示</div>
  <h2 style="margin:0 0 20px;color:#1a2340;font-size:20px">偵測到異常登入嘗試</h2>

  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden">
    <tr style="background:#f0f4ff">
      <td style="padding:10px 16px;font-weight:600;color:#444;width:120px;font-size:13px">來源 IP</td>
      <td style="padding:10px 16px;font-family:monospace;color:#0066ff;font-size:14px">${ip}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#444;font-size:13px">地理位置</td>
      <td style="padding:10px 16px;color:#333;font-size:13px">${location || '無法取得'}</td>
    </tr>
    <tr style="background:#f0f4ff">
      <td style="padding:10px 16px;font-weight:600;color:#444;font-size:13px">裝置資訊</td>
      <td style="padding:10px 16px;color:#333;font-size:13px">${device}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#444;font-size:13px">嘗試 Email</td>
      <td style="padding:10px 16px;font-family:monospace;color:#333;font-size:13px">${email || '無'}</td>
    </tr>
    <tr style="background:#f0f4ff">
      <td style="padding:10px 16px;font-weight:600;color:#444;font-size:13px">封鎖時間</td>
      <td style="padding:10px 16px;color:#333;font-size:13px">${fmtTaipei(now)}（台北時間）</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#444;font-size:13px">封鎖原因</td>
      <td style="padding:10px 16px;color:#cc3300;font-size:13px">${reason}</td>
    </tr>
  </table>

  <div style="margin-top:24px;display:flex;gap:12px">
    <a href="${unblockUrl}"
       style="display:inline-block;padding:12px 24px;background:#34c759;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      ✓ 解除封鎖
    </a>
    ${whitelistUrl ? `
    <a href="${whitelistUrl}"
       style="display:inline-block;padding:12px 24px;background:#0066ff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      ＋ 加入白名單
    </a>` : ''}
  </div>

  <p style="color:#999;font-size:11px;margin:20px 0 0">
    ‧ 按鈕連結 7 天內有效<br>
    ‧ 若非異常行為，請點「解除封鎖」<br>
    ‧ 「加入白名單」將同時解除封鎖並授權登入
  </p>
</div>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'CHB FileUploader', email: sender },
      to:          [{ email: adminEmail }],
      subject:     `【封鎖警示】${ip} 已被封鎖 · ${location || countryCode}`,
      htmlContent: html,
    }),
  });
}
