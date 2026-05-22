export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const dm    = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (seconds < 60)  return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    zip:  'application/zip',
    tar:  'application/x-tar',
    gz:   'application/gzip',
    mp4:  'video/mp4',
    mp3:  'audio/mpeg',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    gif:  'image/gif',
    svg:  'image/svg+xml',
    txt:  'text/plain',
    csv:  'text/csv',
    json: 'application/json',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Upload a file directly to GCS via signed URL with progress callback
export async function uploadWithProgress(
  url:          string,
  file:         File | Blob,
  contentType:  string,
  onProgress:   (percent: number, speed: number, eta: number) => void,
  signal?:      AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr       = new XMLHttpRequest();
    const startTime = Date.now();
    let   lastLoaded = 0;
    let   lastTime   = startTime;

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const now     = Date.now();
      const elapsed = (now - lastTime) / 1000;
      const delta   = e.loaded - lastLoaded;
      const speed   = elapsed > 0 ? delta / elapsed : 0;
      const pct     = Math.round((e.loaded / e.total) * 100);
      const eta     = speed > 0 ? (e.total - e.loaded) / speed : 0;
      onProgress(pct, speed, eta);
      lastLoaded = e.loaded;
      lastTime   = now;
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error',  () => reject(new Error('Network error')));
    xhr.addEventListener('abort',  () => reject(new Error('Upload cancelled')));

    signal?.addEventListener('abort', () => xhr.abort());

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    // GCS signed URL CORS requires exact content-type header
    xhr.send(file);
  });
}

// Chunked resumable upload to GCS session URI
export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks

export async function resumableChunkUpload(
  sessionUri:  string,
  file:        File,
  onProgress:  (percent: number, speed: number, eta: number) => void,
  signal?:     AbortSignal,
): Promise<void> {
  const totalSize  = file.size;
  let   offset     = 0;
  const startTime  = Date.now();

  while (offset < totalSize) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    const end   = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunk = file.slice(offset, end);

    const res = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
        'Content-Type':  file.type || 'application/octet-stream',
      },
      body:   chunk,
      signal,
    });

    if (res.status !== 200 && res.status !== 201 && res.status !== 308) {
      throw new Error(`Chunk upload failed: HTTP ${res.status}`);
    }

    offset = end;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed   = elapsed > 0 ? offset / elapsed : 0;
    const pct     = Math.round((offset / totalSize) * 100);
    const eta     = speed > 0 ? (totalSize - offset) / speed : 0;
    onProgress(pct, speed, eta);
  }
}
