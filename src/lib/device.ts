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

export async function rememberDevice(token: string, email: string): Promise<void> {
  await redis().set(deviceKey(token), email, 'EX', DEVICE_TTL);
}

export async function getDeviceEmail(token: string): Promise<string | null> {
  return redis().get(deviceKey(token));
}
