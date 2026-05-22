import { NextRequest, NextResponse } from 'next/server';
import { listGCSFiles }          from '@/lib/providers/gcs';
import { listGoogleDriveFiles }  from '@/lib/providers/gdrive';
import { listGitHubAssets }      from '@/lib/providers/github';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider') ?? 'all';

  try {
    const results: Record<string, any[]> = {};

    if (provider === 'gcs' || provider === 'all') {
      results.gcs = await listGCSFiles().catch(() => []);
    }
    if (provider === 'gdrive' || provider === 'all') {
      results.gdrive = await listGoogleDriveFiles().catch(() => []);
    }
    if (provider === 'github' || provider === 'all') {
      results.github = await listGitHubAssets().catch(() => []);
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
