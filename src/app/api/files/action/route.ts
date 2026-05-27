import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, isAdminEmail } from '@/lib/auth';
import {
  trashGoogleDriveFile, restoreGoogleDriveFile, permanentDeleteGoogleDriveFile,
} from '@/lib/providers/gdrive';
import {
  trashGCSFile, restoreGCSFile, permanentDeleteGCSFile,
} from '@/lib/providers/gcs';
import {
  trashGitHubAsset, restoreGitHubAsset, permanentDeleteGitHubAsset,
} from '@/lib/providers/github';

export const runtime = 'nodejs';

type Action   = 'trash' | 'restore' | 'permanent';
type Provider = 'gdrive' | 'gcs' | 'github';

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const token = cookies().get('session')?.value;
  if (!token) return { ok: false, res: NextResponse.json({ error: '未登入' }, { status: 401 }) };
  const payload = await verifyToken(token);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!email || !isAdminEmail(email)) {
    return { ok: false, res: NextResponse.json({ error: '權限不足' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));
  const action   = body?.action   as Action;
  const provider = body?.provider as Provider;
  const ids      = Array.isArray(body?.ids) ? (body.ids as string[]) : [];

  if (!['trash','restore','permanent'].includes(action))
    return NextResponse.json({ error: 'action 無效' }, { status: 400 });
  if (!['gdrive','gcs','github'].includes(provider))
    return NextResponse.json({ error: 'provider 無效' }, { status: 400 });
  if (ids.length === 0)
    return NextResponse.json({ error: '未指定要操作的項目' }, { status: 400 });

  const fail: { id: string; error: string }[] = [];

  await Promise.all(ids.map(async (id) => {
    try {
      if (provider === 'gdrive') {
        if (action === 'trash')     await trashGoogleDriveFile(id);
        if (action === 'restore')   await restoreGoogleDriveFile(id);
        if (action === 'permanent') await permanentDeleteGoogleDriveFile(id);
      } else if (provider === 'gcs') {
        if (action === 'trash')     await trashGCSFile(id);
        if (action === 'restore')   await restoreGCSFile(id);
        if (action === 'permanent') await permanentDeleteGCSFile(id);
      } else if (provider === 'github') {
        const numId = Number(id);
        if (action === 'trash')     await trashGitHubAsset(numId);
        if (action === 'restore')   await restoreGitHubAsset(numId);
        if (action === 'permanent') await permanentDeleteGitHubAsset(numId);
      }
    } catch (e: any) {
      fail.push({ id, error: e?.message ?? 'unknown' });
    }
  }));

  return NextResponse.json({
    ok:        fail.length === 0,
    succeeded: ids.length - fail.length,
    failed:    fail,
  });
}
