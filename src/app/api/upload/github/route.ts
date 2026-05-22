import { NextRequest, NextResponse } from 'next/server';
import { uploadToGitHubRelease } from '@/lib/providers/github';

export const runtime  = 'nodejs';
export const maxDuration = 60;

// GitHub Releases has a 2 GB per asset limit
const GH_MAX = 2 * 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const fileName    = req.headers.get('x-file-name')    ?? 'upload';
    const contentType = req.headers.get('x-content-type') ?? 'application/octet-stream';
    const fileSize    = parseInt(req.headers.get('x-file-size') ?? '0');

    if (fileSize > GH_MAX) {
      return NextResponse.json({ error: 'GitHub Releases limit is 2 GB per file' }, { status: 413 });
    }

    // Buffer entire body (Vercel free tier: 4.5 MB; Pro: configurable)
    const arrayBuffer = await req.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { downloadUrl, assetId } = await uploadToGitHubRelease(fileName, contentType, buffer);

    return NextResponse.json({ success: true, downloadUrl, assetId, fileName });
  } catch (err: any) {
    console.error('[github upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
