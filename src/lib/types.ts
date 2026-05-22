export type StorageProvider = 'gcs' | 'gdrive' | 'github' | 'local';

export interface UploadTarget {
  provider: StorageProvider;
  label:    string;
  icon:     string;
  color:    string;
  maxSize:  number; // bytes; -1 = unlimited
  description: string;
}

export interface FileItem {
  id:           string;
  file:         File;
  name:         string;
  size:         number;
  type:         string;
  status:       'pending' | 'uploading' | 'success' | 'error';
  progress:     number;          // 0-100
  speed?:       number;          // bytes/s
  eta?:         number;          // seconds remaining
  error?:       string;
  downloadUrl?: string;
  uploadedAt?:  number;
}

export interface UploadResult {
  success:     boolean;
  fileName:    string;
  downloadUrl: string;
  provider:    StorageProvider;
  size:        number;
  error?:      string;
}

export interface PresignedUrlRequest {
  fileName:    string;
  fileType:    string;
  fileSize:    number;
  provider:    StorageProvider;
}

export interface PresignedUrlResponse {
  uploadUrl:   string;
  downloadUrl: string;
  fields?:     Record<string, string>; // for S3-style POST
  headers?:    Record<string, string>;
}

export interface ChunkUploadState {
  fileId:        string;
  totalChunks:   number;
  uploadedChunks: number;
  sessionUri?:   string; // GCS resumable
}
