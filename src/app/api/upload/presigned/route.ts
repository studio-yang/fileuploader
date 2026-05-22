import { NextRequest, NextResponse } from 'next/server';
import { generateGCSUploadUrl, createGCSResumableSession } from '@/lib/providers/gcs';

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '5368709120');
// Use resumable for files > 32 MB
const RESUMABLE_THRESHOLD = 32 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: `File exceeds max size of ${MAX_SIZE} bytes` }, { status: 413 });
    }

    if (fileSize > RESUMABLE_THRESHOLD) {
      // Resumable session for large files
      const { sessionUri, downloadUrl } = await createGCSResumableSession(fileName, fileType, fileSize);
      return NextResponse.json({ mode: 'resumable', sessionUri, downloadUrl });
    } else {
      // Simple presigned PUT URL
      const { uploadUrl, downloadUrl } = await generateGCSUploadUrl(fileName, fileType);
      return NextResponse.json({ mode: 'presigned', uploadUrl, downloadUrl });
    }
  } catch (err: any) {
    console.error('[presigned]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
