import { NextRequest, NextResponse } from 'next/server';
import { listGCSFiles }          from '@/lib/providers/gcs';
import { listGoogleDriveFiles }  from '@/lib/providers/gdrive';
import { listGitHubAssets }      from '@/lib/providers/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') ?? 'all';
  const trashed  = req.nextUrl.searchParams.get('view') === 'trash';
  const opts     = { trashed };

  try {
    const results: Record<string, any[]> = {};

    if (provider === 'gcs' || provider === 'all') {
      results.gcs = await listGCSFiles(opts).catch(() => []);
    }
    if (provider === 'gdrive' || provider === 'all') {
      results.gdrive = await listGoogleDriveFiles(opts).catch(() => []);
    }
    if (provider === 'github' || provider === 'all') {
      results.github = await listGitHubAssets(opts).catch(() => []);
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
