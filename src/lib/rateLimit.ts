import IORedis from 'ioredis';

const WINDOW_SEC   = 180;
const MAX_REQUESTS = 3;  // 降低阈值：3 分鐘最多 3 次
const RATE_KEY     = (ip: string) => `ratelimit:otp:${ip}`;
const BLOCK_KEY    = 'blocklist:ips';

let _redis: IORedis | null = null;
function redis(): IORedis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL || '';
  if (!url) throw new Error('Redis 未設定');
  _redis = new IORedis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     false,
    lazyConnect:          false,
  });
  return _redis;
}

export const RATE_WINDOW_SEC = WINDOW_SEC;
export const RATE_MAX        = MAX_REQUESTS;

export interface BlockEntry {
  ip:        string;
  blockedAt: number;
  reason:    string;
}

export function getClientIp(headers: Headers): string {
  const fwd   = headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  if (first) return first;
  return headers.get('x-real-ip') || 'unknown';
}

export async function isBlocked(ip: string): Promise<boolean> {
  const score = await redis().zscore(BLOCK_KEY, ip);
  return score !== null;
}

export async function blockIp(ip: string): Promise<void> {
  await redis().zadd(BLOCK_KEY, Date.now(), ip);
}

export async function unblockIp(ip: string): Promise<void> {
  await redis().zrem(BLOCK_KEY, ip);
}

export async function listBlocked(): Promise<BlockEntry[]> {
  const raw = await redis().zrevrange(BLOCK_KEY, 0, -1, 'WITHSCORES');
  const out: BlockEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({
      ip:        raw[i],
      blockedAt: Number(raw[i + 1]),
      reason:    `3 分鐘內請求超過 ${MAX_REQUESTS} 次`,
    });
  }
  return out;
}

/** 計數一次。回傳當前窗口內的累積次數。 */
export async function incrRate(ip: string): Promise<number> {
  const r   = redis();
  const key = RATE_KEY(ip);
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, WINDOW_SEC);
  return count;
}

/** OTP 驗證失敗次數計數（防暴力破解） */
export async function incrOtpAttempt(email: string): Promise<number> {
  const key = `otp_attempts:${email}`;
  const count = await redis().incr(key);
  if (count === 1) await redis().expire(key, 300); // 5 分鐘重置
  return count;
}

export async function resetOtpAttempt(email: string): Promise<void> {
  await redis().del(`otp_attempts:${email}`);
}

/** 管理員操作速率限制（10 分鐘 100 次） */
export async function incrAdminRate(email: string): Promise<number> {
  const key = `admin_rate:${email}`;
  const count = await redis().incr(key);
  if (count === 1) await redis().expire(key, 600); // 10 分鐘
  return count;
}

/** 稽核日誌 */
export async function auditLog(action: string, email: string, ip: string, status: 'success' | 'failure', details?: string): Promise<void> {
  try {
    const log = {
      timestamp: new Date().toISOString(),
      action,
      email,
      ip,
      status,
      details,
    };
    await redis().rpush('audit:log', JSON.stringify(log));
    // 保留最近 10000 筆日誌
    await redis().ltrim('audit:log', -10000, -1);
  } catch {
    // 日誌失敗不應阻塞主流程
    console.error('[audit] failed to log');
  }
}
