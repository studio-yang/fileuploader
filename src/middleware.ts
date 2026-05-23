import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, isAdminEmail } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get('session')?.value;
  const payload = session ? await verifyToken(session) : null;
  const email   = typeof payload?.email === 'string' ? payload.email : '';

  if (!email) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Admin gate
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    if (!isAdminEmail(email)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
