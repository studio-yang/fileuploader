# FileFlow 🚀

> 支援超大型檔案上傳/下載的 HTTPS 加密站台  
> 儲存目標：Google Cloud Storage · Google Drive · GitHub Releases  
> 部署平台：Vercel（自動 HTTPS）

---

## 架構說明

```
Browser
  ├─ GCS (大型) ──► Presigned PUT / Resumable Session ──► Google Cloud Storage
  │                 (直傳，完全繞過 Vercel 限制)
  ├─ GCS (小型) ──► Presigned PUT URL ──► Google Cloud Storage
  ├─ Google Drive ─► POST /api/upload/gdrive ──► Vercel ──► Google Drive API
  └─ GitHub       ─► POST /api/upload/github ──► Vercel ──► GitHub Releases API
```

### 為什麼 GCS 要用 Presigned URL？
Vercel Serverless Function 免費版限制 request body 4.5 MB，大型檔案如果走 Vercel 一定會失敗。  
Presigned URL 讓瀏覽器**直接上傳到 GCS**，Vercel 只負責發放簽名 URL，完全不碰檔案本體。

---

## 快速部署步驟

### 1. Fork/Clone 並推送到 GitHub

```bash
git clone https://github.com/your-username/fileflow.git
cd fileflow
git remote set-url origin https://github.com/你的帳號/你的repo.git
git push -u origin main
```

### 2. 準備 Google Cloud Storage

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇一個 Project
3. 啟用 **Cloud Storage API**
4. 建立 Bucket（建議選 asia-east1 台灣/亞洲區域）
5. 設定 Bucket CORS（允許瀏覽器直傳）：

```json
[
  {
    "origin": ["https://你的domain.vercel.app"],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
```

用 gcloud 套用 CORS：
```bash
gsutil cors set cors.json gs://你的bucket名稱
```

6. 建立 Service Account，授予 **Storage Object Admin** 角色
7. 下載 JSON 金鑰，轉為 Base64：
```bash
base64 -i your-key.json | tr -d '\n'
```

### 3. 準備 Google Drive 直傳（Service Account）

> **這是大型檔案（> 60 MB）直傳的必要設定**，讓瀏覽器繞過 Vercel 直接上傳到 Google Drive。

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → **Service Accounts**
2. 建立新的 Service Account（名稱例如 `fileflow-uploader`）
3. 下載 JSON 金鑰，轉為 Base64：
```bash
base64 -i your-service-account-key.json | tr -d '\n'
```
4. 將 Base64 字串設為環境變數 `GDRIVE_SERVICE_ACCOUNT_KEY`
5. 到 Google Drive，建立目標資料夾 → 右鍵 → 共用 → 加入 Service Account 的 Email（授予「編輯者」權限）
6. 複製資料夾 ID（URL 中 `/folders/` 後面那段），設為 `GOOGLE_DRIVE_FOLDER_ID`

> **⚠️ CORS 注意**：Google Drive API 已原生支援瀏覽器 CORS，不需要額外設定。

### 3b. 準備 Google Drive API（舊版 OAuth，可選）

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → API & Services → 啟用 **Google Drive API**
2. 建立 OAuth 2.0 Client ID（Desktop App 類型）
3. 取得 Refresh Token（使用 [OAuth Playground](https://developers.google.com/oauthplayground/)）：
   - Scope: `https://www.googleapis.com/auth/drive.file`
   - Exchange Authorization Code → 取得 refresh_token

### 4. 準備 GitHub Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 授予 Repository → **Contents: Read and write**（需要 Releases 寫入權限）

### 5. 部署到 Vercel

1. 前往 [vercel.com](https://vercel.com) → Import Git Repository → 選擇你的 repo
2. 在 **Environment Variables** 設定以下變數：

| 變數名稱 | 說明 |
|---|---|
| `GCS_PROJECT_ID` | GCP Project ID |
| `GCS_BUCKET_NAME` | GCS Bucket 名稱 |
| `GCS_SERVICE_ACCOUNT_KEY` | Service Account JSON 的 Base64 編碼 |
| `GOOGLE_DRIVE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth Refresh Token |
| `GOOGLE_DRIVE_FOLDER_ID` | （選填）目標資料夾 ID |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_OWNER` | GitHub 帳號名稱 |
| `GITHUB_REPO` | GitHub Repo 名稱 |
| `ALLOWED_ORIGINS` | 你的 Vercel 域名（用於 CORS） |

3. 點擊 **Deploy** → 等待 Build 完成
4. 完成！Vercel 自動提供 HTTPS 加密的 `.vercel.app` 域名

---

## 功能說明

| 功能 | 說明 |
|---|---|
| 拖曳上傳 | 支援直接拖曳檔案到頁面 |
| 多檔上傳 | 一次選多個檔案，依序上傳 |
| 即時進度 | 顯示上傳進度、速度、剩餘時間 |
| 大型檔案 | GCS Presigned URL 直傳，無大小限制* |
| 斷點續傳 | GCS Resumable Upload（>32 MB 自動啟用） |
| 取消上傳 | 上傳中可隨時取消 |
| 下載連結 | 上傳完成後即可複製下載連結 |
| 檔案列表 | 瀏覽各儲存體已上傳的檔案 |
| HTTPS | Vercel 自動提供 TLS 加密 |
| 資安標頭 | HSTS、X-Frame-Options、CSP 等標頭 |

*GCS 免費方案有流量限制，超過後依使用量計費。

---

## 本機開發

```bash
cp .env.example .env.local
# 填入你的設定
npm install
npm run dev
# 開啟 http://localhost:3000
```

---

## 注意事項

- **Vercel 免費版**：API Route body 限制 4.5 MB。GCS 走 Presigned URL 不受影響；GitHub/GDrive 受限。升級 Pro 可調整。
- **GitHub Releases** 單一 Asset 上限 2 GB，Release 本身無上限。
- **Google Drive** 免費空間 15 GB，超過需購買 Google One。
- `.env.local` 絕對不能 commit 到 Git！已在 `.gitignore` 保護。
