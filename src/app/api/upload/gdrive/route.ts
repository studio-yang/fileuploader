import { NextRequest, NextResponse } from 'next/server';
import { uploadToGoogleDrive } from '@/lib/providers/gdrive';
import { Readable } from 'stream';
import busboy from 'busboy';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    // Convert Web ReadableStream → Node Readable
    const nodeStream = Readable.fromWeb(req.body as any);

    const result = await new Promise<{
      fileId: string; downloadUrl: string; webViewLink: string
    }>((resolve, reject) => {
      const bb = busboy({ headers: { 'content-type': contentType }, limits: { fileSize: 5 * 1024 * 1024 * 1024 } });
      let   fileName = 'upload';
      let   mimeType = 'application/octet-stream';

      bb.on('file', (fieldname, fileStream, info) => {
        fileName = info.filename || fileName;
        mimeType = info.mimeType || mimeType;
        const readable = Readable.from(fileStream);
        uploadToGoogleDrive(fileName, mimeType, readable)
          .then(resolve)
          .catch(reject);
      });
      bb.on('error', reject);
      nodeStream.pipe(bb);
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[gdrive upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
