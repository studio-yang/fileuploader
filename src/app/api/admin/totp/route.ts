import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import { generateTotpSecret, getTotpUri, verifyTotpCode, saveTotpSecret, deleteTotpSecret, isTotpConfigured } from '@/lib/totp';

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ error: '未登入' }, { status: 401 });
  const payload = await verifyToken(token);
  const email   = typeof payload?.email === 'string' ? payload.email : '';
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: '權限不足' }, { status: 403 });
  return { email };
}

// GET：查詢 TOTP 設定狀態
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const configured = await isTotpConfigured(auth.email);
  return NextResponse.json({ configured });
}

// POST：
//   無 body → 產生新 secret + QR Code（暫時，未儲存）
//   有 { secret, code } → 驗證後儲存
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));

  // 有帶 secret + code → 驗證並儲存
  if (body.secret && body.code) {
    if (!verifyTotpCode(body.secret, body.code)) {
      return NextResponse.json({ error: '驗證碼不正確，請確認 App 時間與裝置同步' }, { status: 400 });
    }
    await saveTotpSecret(auth.email, body.secret);
    return NextResponse.json({ ok: true });
  }

  // 沒帶參數 → 產生新 secret + QR Code
  const secret = generateTotpSecret();
  const uri    = getTotpUri(secret, auth.email);
  const qrCode = await QRCode.toDataURL(uri);
  return NextResponse.json({ secret, qrCode });
}

// DELETE：停用 TOTP
export async function DELETE() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  await deleteTotpSecret(auth.email);
  return NextResponse.json({ ok: true });
}
