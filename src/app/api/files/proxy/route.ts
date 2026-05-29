import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 允許 proxy 的上游 host，避免 SSRF
const ALLOWED_HOSTS = new Set([
  'storage.googleapis.com',
  'github.com',
  'objects.githubusercontent.com',
  'github-cloud.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

/**
 * 把外部 URL 透過後端轉發，避免瀏覽器 CORS 限制
 * 用法：GET /api/files/proxy?url=<encoded-url>
 */
export async function GET(req: NextRequest) {
  // Auth check
  const token = cookies().get('session')?.value;
  if (!token) return new Response('未登入', { status: 401 });
  const payload = await verifyToken(token);
  if (typeof payload?.email !== 'string') return new Response('未登入', { status: 401 });

  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new Response('Missing url', { status: 400 });

  let target: URL;
  try { target = new URL(raw); } catch { return new Response('Invalid URL', { status: 400 }); }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new Response(`Host not allowed: ${target.hostname}`, { status: 403 });
  }

  const upstream = await fetch(target.toString()).catch((e: any) => {
    return new Response(`Upstream fetch failed: ${e?.message ?? 'unknown'}`, { status: 502 });
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status:  200,
    headers: {
      'content-type':   upstream.headers.get('content-type')   ?? 'application/octet-stream',
      'content-length': upstream.headers.get('content-length') ?? '',
    },
  });
}
