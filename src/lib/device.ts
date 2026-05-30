import { randomBytes } from 'crypto';
import { getRedis } from './redis';

const DEVICE_TTL = 30 * 24 * 60 * 60; // 30 天（秒）

const redis = () => getRedis();

const deviceKey = (token: string) => `device:${token}`;

export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex');
}

/** 計算設備指紋（僅 UA，IP 不納入以免行動網路 IP 漂移造成誤判） */
export function getDeviceFingerprint(ua: string): string {
  const buf = new TextEncoder().encode(ua);
  return Buffer.from(buf).toString('base64').substring(0, 32);
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
