import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { unblockIp } from '@/lib/rateLimit';
import { addToWhitelist } from '@/lib/whitelist';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chb-fileuploader.vercel.app';

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || '');
}

function htmlPage(title: string, message: string, color: string) {
  return new Response(
    `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0f4ff;margin:0}
.card{background:#fff;border-radius:16px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.icon{font-size:48px;margin-bottom:16px}.title{font-size:20px;font-weight:700;color:#1a2340;margin-bottom:8px}
.msg{color:#555;font-size:14px;line-height:1.6}.back{margin-top:24px;display:inline-block;padding:10px 24px;background:${color};color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600}
</style></head><body>
<div class="card">
  <div class="icon">${color === '#34c759' ? '✅' : color === '#0066ff' ? '✅' : '❌'}</div>
  <div class="title">${title}</div>
  <div class="msg">${message}</div>
  <a class="back" href="${BASE_URL}/admin" style="background:${color}">前往管理後台</a>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  if (!token) return htmlPage('連結無效', '缺少驗證 Token，請重新從通知信中點擊按鈕。', '#ff3b30');

  let payload: { action?: string; ip?: string; email?: string };
  try {
    const { payload: p } = await jwtVerify(token, getSecret());
    payload = p as typeof payload;
  } catch {
    return htmlPage('連結已過期', '此動作連結已逾期（有效期 7 天），請重新封鎖並從新通知信操作。', '#ff3b30');
  }

  const { action, ip, email } = payload;
  if (!action || !ip) return htmlPage('連結無效', '連結資料不完整。', '#ff3b30');

  if (action === 'unblock') {
    try {
      await unblockIp(ip);
      return htmlPage('解除封鎖成功', `IP <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${ip}</code> 已解除封鎖。`, '#34c759');
    } catch {
      return htmlPage('操作失敗', '解除封鎖時發生錯誤，請至管理後台手動操作。', '#ff3b30');
    }
  }

  if (action === 'whitelist') {
    if (!email) return htmlPage('缺少 Email', '此連結未包含 Email 資訊。', '#ff3b30');
    try {
      await unblockIp(ip);
      await addToWhitelist(email).catch(() => {}); // 若已存在則忽略
      return htmlPage('已加入白名單', `${email} 已加入白名單並解除 IP 封鎖。`, '#0066ff');
    } catch (e: any) {
      return htmlPage('操作失敗', e?.message || '發生錯誤，請至管理後台手動操作。', '#ff3b30');
    }
  }

  return htmlPage('不明動作', '未知的操作類型。', '#ff3b30');
}
