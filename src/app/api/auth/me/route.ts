import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';

export async function GET() {
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 200 });
  const payload = await verifyToken(token);
  if (!payload || typeof payload.email !== 'string') {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    email:         payload.email,
    isAdmin:       isAdminEmail(payload.email),
  });
}
