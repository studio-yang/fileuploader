import { Redis } from '@upstash/redis';

const WINDOW_SEC   = 180;
const MAX_REQUESTS = 5;
const RATE_KEY     = (ip: string) => `ratelimit:otp:${ip}`;
const BLOCK_KEY    = 'blocklist:ips';

let _redis: Redis | null = null;
function redis(): Redis {
  if (_redis) return _redis;

  // 優先：明確的 REST API 環境變數（Vercel KV / Upstash 直連）
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (url && token) {
    _redis = new Redis({ url, token });
    return _redis;
  }

  // 備援：從 REDIS_URL（redis protocol）解析 REST API 連線
  const redisUrl = process.env.REDIS_URL || '';
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      _redis = new Redis({
        url:   `https://${parsed.hostname}`,
        token: parsed.password,
      });
      return _redis;
    } catch {
      throw new Error('REDIS_URL 格式錯誤');
    }
  }

  throw new Error('KV 未設定');
}

export const RATE_WINDOW_SEC = WINDOW_SEC;
export const RATE_MAX        = MAX_REQUESTS;

export interface BlockEntry {
  ip:        string;
  blockedAt: number;
  reason:    string;
}

export function getClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  if (first) return first;
  return headers.get('x-real-ip') || 'unknown';
}

export async function isBlocked(ip: string): Promise<boolean> {
  const score = await redis().zscore(BLOCK_KEY, ip);
  return score !== null;
}

export async function blockIp(ip: string): Promise<void> {
  await redis().zadd(BLOCK_KEY, { score: Date.now(), member: ip });
}

export async function unblockIp(ip: string): Promise<void> {
  await redis().zrem(BLOCK_KEY, ip);
}

export async function listBlocked(): Promise<BlockEntry[]> {
  const raw = (await redis().zrange(BLOCK_KEY, 0, -1, { rev: true, withScores: true })) as (string | number)[];
  const out: BlockEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({
      ip:        String(raw[i]),
      blockedAt: Number(raw[i + 1]),
      reason:    `3 分鐘內請求超過 ${MAX_REQUESTS} 次`,
    });
  }
  return out;
}

/** 計數一次。回傳當前窗口內的累積次數。 */
export async function incrRate(ip: string): Promise<number> {
  const r = redis();
  const key = RATE_KEY(ip);
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, WINDOW_SEC);
  return count;
}
