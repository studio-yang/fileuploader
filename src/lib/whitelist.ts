import { normalizeEmail, isAdminEmail } from './auth';
import { getRedis } from './redis';

const KEY = 'whitelist:emails';
const MAX = 100;

const redis = () => getRedis();

export interface WhitelistEntry {
  email:   string;
  addedAt: number;
  isAdmin: boolean;
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const raw = await redis().zrevrange(KEY, 0, -1, 'WITHSCORES');
  const out: WhitelistEntry[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const email = raw[i];
    out.push({ email, addedAt: Number(raw[i + 1]), isAdmin: isAdminEmail(email) });
  }
  // 確保系統管理員置頂（即使 KV 內沒紀錄）
  const adminEmail = (process.env.OTP_RECIPIENT || '').toLowerCase().trim();
  if (adminEmail && !out.some((e) => e.email === adminEmail)) {
    out.unshift({ email: adminEmail, addedAt: 0, isAdmin: true });
  } else {
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
  await redis().zadd(KEY, Date.now(), email);
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
