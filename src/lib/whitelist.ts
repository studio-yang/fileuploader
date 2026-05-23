import { Redis } from '@upstash/redis';
import { normalizeEmail, isAdminEmail } from './auth';

const KEY = 'whitelist:emails';
const MAX = 100;

let _redis: Redis | null = null;
function redis(): Redis {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    '';
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  if (!url || !token) {
    throw new Error('Vercel KV / Upstash Redis 未設定（缺 KV_REST_API_URL/TOKEN）');
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export interface WhitelistEntry {
  email:   string;
  addedAt: number;
  isAdmin: boolean;
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const raw = (await redis().zrange(KEY, 0, -1, { rev: true, withScores: true })) as (string | number)[];
  const out: WhitelistEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const email = String(raw[i]);
    out.push({ email, addedAt: Number(raw[i + 1]), isAdmin: isAdminEmail(email) });
  }
  // 確保系統管理員置頂（即使 KV 內沒紀錄）
  const adminEmail = (process.env.OTP_RECIPIENT || '').toLowerCase().trim();
  if (adminEmail && !out.some((e) => e.email === adminEmail)) {
    out.unshift({ email: adminEmail, addedAt: 0, isAdmin: true });
  } else {
    // 把管理員移到第一筆
    const idx = out.findIndex((e) => e.isAdmin);
    if (idx > 0) {
      const [adminEntry] = out.splice(idx, 1);
      out.unshift(adminEntry);
    }
  }
  return out;
}

export async function addToWhitelist(emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (isAdminEmail(email)) throw new Error('系統管理員已自動納入，不必新增');
  const exists = await redis().zscore(KEY, email);
  if (exists !== null) throw new Error('此 Email 已在白名單中');
  const count = await redis().zcard(KEY);
  if (count >= MAX) throw new Error(`白名單已達上限（${MAX} 筆）`);
  await redis().zadd(KEY, { score: Date.now(), member: email });
}

export async function removeFromWhitelist(emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (isAdminEmail(email)) throw new Error('系統管理員不可刪除');
  await redis().zrem(KEY, email);
}

export async function isWhitelisted(emailRaw: string): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  if (isAdminEmail(email)) return true;
  const score = await redis().zscore(KEY, email);
  return score !== null;
}
