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
  const buf = new TextEncoder().encode(otp);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
