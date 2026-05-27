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

const TRASH_PREFIX = '垃圾桶/';
const UPLOAD_PREFIX = 'uploads/';

// ── List uploaded files（自動排除垃圾桶內容）─────────────────────────────────
export async function listGCSFiles(opts?: { trashed?: boolean }): Promise<
  { name: string; size: number; updated: string; downloadUrl: string }[]
> {
  const storage = getStorage();
  const prefix  = opts?.trashed ? TRASH_PREFIX : UPLOAD_PREFIX;
  const [files] = await storage.bucket(BUCKET()).getFiles({ prefix });

  return Promise.all(
    files.map(async (f) => {
      const [meta] = await f.getMetadata();
      const [url]  = await f.getSignedUrl({
        version: 'v4',
        action:  'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      return {
        name:        (meta.name as string).replace(prefix, ''),
        size:        Number(meta.size ?? 0),
        updated:     meta.updated as string,
        downloadUrl: url,
      };
    }),
  );
}

// ── 移到垃圾桶（複製到 垃圾桶/ 前綴後刪除原檔）─────────────────────────────
export async function trashGCSFile(displayName: string): Promise<void> {
  const bucket    = getStorage().bucket(BUCKET());
  const srcPath   = `${UPLOAD_PREFIX}${displayName}`;
  const dstPath   = `${TRASH_PREFIX}${displayName}`;
  await bucket.file(srcPath).copy(bucket.file(dstPath));
  await bucket.file(srcPath).delete();
}

// ── 從垃圾桶還原 ──────────────────────────────────────────────────────────
export async function restoreGCSFile(displayName: string): Promise<void> {
  const bucket  = getStorage().bucket(BUCKET());
  const srcPath = `${TRASH_PREFIX}${displayName}`;
  const dstPath = `${UPLOAD_PREFIX}${displayName}`;
  await bucket.file(srcPath).copy(bucket.file(dstPath));
  await bucket.file(srcPath).delete();
}

// ── 永久刪除（從垃圾桶徹底刪除）─────────────────────────────────────────
export async function permanentDeleteGCSFile(displayName: string): Promise<void> {
  const bucket = getStorage().bucket(BUCKET());
  await bucket.file(`${TRASH_PREFIX}${displayName}`).delete();
}
