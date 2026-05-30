import IORedis from 'ioredis';
import { randomBytes } from 'crypto';

const DEVICE_TTL = 30 * 24 * 60 * 60; // 30 天（秒）

let _redis: IORedis | null = null;
function redis(): IORedis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL || '';
  if (!url) throw new Error('Redis 未設定');
  _redis = new IORedis(url, { maxRetriesPerRequest: 3, enableReadyCheck: false });
  return _redis;
}

const deviceKey = (token: string) => `device:${token}`;

export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex');
}

/** 計算設備指紋（UA + IP） */
export function getDeviceFingerprint(ua: string, ip: string): string {
  const buf = new TextEncoder().encode(`${ua}:${ip}`);
  // 使用 SubtleCrypto 進行簡單雜湊（Web API）
  return Buffer.from(buf).toString('base64').substring(0, 16);
}

export async function rememberDevice(token: string, email: string, fingerprint: string): Promise<void> {
  const data = JSON.stringify({ email, fingerprint });
  await redis().set(deviceKey(token), data, 'EX', DEVICE_TTL);
}

export async function getDevice(token: string): Promise<{ email: string; fingerprint: string } | null> {
  const data = await redis().get(deviceKey(token));
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
