# 程式異動說明

## `.gitignore`

新增 `.netlify`，避免 Netlify 本機 CLI 產生的站台連線資料與快取資訊進入版本控管。

## `netlify.toml`

新增 Netlify 專用設定檔，指定：

- 建置指令：`npm run build`
- 發布目錄：`.next`
- Node.js 版本：20
- Next.js adapter：`@netlify/plugin-nextjs`，未指定版本，避免 pin 到固定版本
- 網站安全標頭：`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`Strict-Transport-Security`

## `next.config.js`

新增全站 `headers()` 設定，讓 Netlify Next.js server handler 產生的動態回應也套用安全標頭。

## 影響範圍

- 影響 Netlify 部署與建置流程。
- 不影響 Vercel 部署設定。
- 不影響 `src/` 內既有前端畫面、API route 或檔案上傳流程。
- 會影響所有 Next.js route 的 response headers。

## 相依關係

- Netlify 需從 GitHub repository 匯入本專案。
- Netlify production 環境需設定既有 API 所需環境變數。
- 大檔上傳仍應使用瀏覽器直傳 Google Drive 的 resumable upload 流程。
