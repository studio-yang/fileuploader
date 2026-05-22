import { Storage } from '@google-cloud/storage';

let _storage: Storage | null = null;

function getStorage(): Storage {
  if (_storage) return _storage;

  const keyBase64 = process.env.GCS_SERVICE_ACCOUNT_KEY ?? '';
  const credentials = JSON.parse(
    Buffer.from(keyBase64, 'base64').toString('utf-8'),
  );

  _storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials,
  });
  return _storage;
}

const BUCKET = () => process.env.GCS_BUCKET_NAME!;

// ── Presigned upload URL (max 7 days) ────────────────────────────────────────
export async function generateGCSUploadUrl(
  fileName:    string,
  contentType: string,
): Promise<{ uploadUrl: string; downloadUrl: string }> {
  const storage = getStorage();
  const file    = storage.bucket(BUCKET()).file(`uploads/${Date.now()}_${fileName}`);

  const [uploadUrl] = await file.getSignedUrl({
    version:     'v4',
    action:      'write',
    expires:     Date.now() + 60 * 60 * 1000, // 1 hour
    contentType,
  });

  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action:  'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { uploadUrl, downloadUrl };
}

// ── Resumable upload session URI (for very large files via client) ─────────────
export async function createGCSResumableSession(
  fileName:    string,
  contentType: string,
  fileSize:    number,
): Promise<{ sessionUri: string; downloadUrl: string }> {
  const storage = getStorage();
  const objName = `uploads/${Date.now()}_${fileName}`;
  const file    = storage.bucket(BUCKET()).file(objName);

  const [sessionUri] = await file.createResumableUpload({
    metadata: { contentType },
    origin:   process.env.ALLOWED_ORIGINS?.split(',')[0],
  });

  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action:  'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return { sessionUri, downloadUrl };
}

// ── Server-side stream upload (for small files < 32 MB) ──────────────────────
export async function uploadStreamToGCS(
  fileName:    string,
  contentType: string,
  stream:      NodeJS.ReadableStream,
): Promise<string> {
  const storage  = getStorage();
  const objName  = `uploads/${Date.now()}_${fileName}`;
  const file     = storage.bucket(BUCKET()).file(objName);
  const writeStream = file.createWriteStream({ metadata: { contentType } });

  await new Promise<void>((resolve, reject) => {
    stream.pipe(writeStream)
      .on('finish', resolve)
      .on('error',  reject);
  });

  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action:  'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return downloadUrl;
}

// ── List uploaded files ───────────────────────────────────────────────────────
export async function listGCSFiles(): Promise<
  { name: string; size: number; updated: string; downloadUrl: string }[]
> {
  const storage = getStorage();
  const [files] = await storage.bucket(BUCKET()).getFiles({ prefix: 'uploads/' });

  return Promise.all(
    files.map(async (f) => {
      const [meta] = await f.getMetadata();
      const [url]  = await f.getSignedUrl({
        version: 'v4',
        action:  'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      return {
        name:        (meta.name as string).replace('uploads/', ''),
        size:        Number(meta.size ?? 0),
        updated:     meta.updated as string,
        downloadUrl: url,
      };
    }),
  );
}
