import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dev-only-secret-set-AUTH_SECRET-in-env'
);

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function signChallenge(otpHash: string, email: string): Promise<string> {
  return new SignJWT({ h: otpHash, e: email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function hashOtp(otp: string): Promise<string> {
  // 使用 PBKDF2 + salt 防止預計算攻擊
  const encoder = new TextEncoder();
  const salt = new TextEncoder().encode(process.env.AUTH_SALT || 'chb-fileuploader-salt');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(otp),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isAdminEmail(email: string): boolean {
  const admin = (process.env.OTP_RECIPIENT || '').toLowerCase().trim();
  return !!admin && normalizeEmail(email) === admin;
}

export function isValidEmail(email: string): boolean {
  // RFC 5322 簡化版本，防止無效 email 格式
  // 允許：字母數字、點、連字符、下劃線、加號（本地）@ 域名 . 頂級域
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}
