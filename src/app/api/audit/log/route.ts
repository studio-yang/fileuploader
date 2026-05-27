import { NextRequest, NextResponse } from 'next/server';
import IORedis from 'ioredis';

let _redis: IORedis | null = null;
function redis(): IORedis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL || '';
  if (!url) return null;
  _redis = new IORedis(url, { maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: false });
  return _redis;
}

const KEY = 'audit:log';
const MAX = 500;

export async function POST(req: NextRequest) {
  try {
    const { action, details } = await req.json();
    if (!action) return NextResponse.json({ ok: false }, { status: 400 });
    const r = redis();
    if (!r) return NextResponse.json({ ok: true });
    const entry = JSON.stringify({ action, details, ts: Date.now() });
    await r.zadd(KEY, Date.now(), entry);
    await r.zremrangebyrank(KEY, 0, -(MAX + 1));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  try {
    const r = redis();
    if (!r) return NextResponse.json({ logs: [] });
    const raw = await r.zrevrange(KEY, 0, 99, 'WITHSCORES');
    const logs: object[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      try { logs.push({ ...JSON.parse(raw[i]), ts: Number(raw[i + 1]) }); } catch {}
    }
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}
