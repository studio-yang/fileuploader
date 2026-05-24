import { TOTP, Secret } from 'otpauth';
import IORedis from 'ioredis';

const ISSUER = 'CHB FileUploader';

let _redis: IORedis | null = null;
function redis(): IORedis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL || '';
  if (!url) throw new Error('Redis 未設定');
  _redis = new IORedis(url, { maxRetriesPerRequest: 3, enableReadyCheck: false });
  return _redis;
}

const totpKey = (email: string) => `totp:secret:${email}`;

// 產生新的 TOTP 隨機金鑰（base32）
export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

// 產生 otpauth:// URI（供 QR Code 掃描）
export function getTotpUri(secret: string, email: string): string {
  return new TOTP({ issuer: ISSUER, label: email, algorithm: 'SHA1', digits: 6, period: 30, secret }).toString();
}

// 驗證使用者輸入的 6 位數是否正確（允許前後 1 個時間窗口容錯）
export function verifyTotpCode(secret: string, code: string): boolean {
  const delta = new TOTP({ issuer: ISSUER, algorithm: 'SHA1', digits: 6, period: 30, secret })
    .validate({ token: code, window: 1 });
  return delta !== null;
}

// Redis CRUD
export async function saveTotpSecret(email: string, secret: string): Promise<void> {
  await redis().set(totpKey(email), secret);
}

export async function getTotpSecret(email: string): Promise<string | null> {
  return redis().get(totpKey(email));
}

export async function deleteTotpSecret(email: string): Promise<void> {
  await redis().del(totpKey(email));
}

export async function isTotpConfigured(email: string): Promise<boolean> {
  const v = await redis().exists(totpKey(email));
  return v === 1;
}
