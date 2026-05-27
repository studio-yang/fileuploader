# AGENTS.md - FileUploader Codex 專案介面文件

本檔是面向 Codex 的專案入口文件。專案知識來源以 `CLAUDE.md` 為準；若兩者衝突，先以 `CLAUDE.md` 的專案事實為準，並回報需要同步文件。

## 專案概覽

FileUploader 是彰化商業銀行檔案傳輸平台，使用 Next.js 14 App Router、TypeScript、Tailwind CSS、Vercel 部署。已實作 Email OTP 登入、白名單管理、IP Rate Limit 與封鎖、記住裝置、封鎖警示信、TOTP 備援登入，以及 Brevo 寄信。

目前 `CLAUDE.md` 記錄：無進行中需求，等待使用者提出新需求。

## Codex 工作原則

1. 回覆一律使用台灣風格繁體中文，專業術語可保留英文。
2. 動工前先讀相關程式碼：直接呼叫者、共用工具、API route、middleware。
3. 只做使用者要求的範圍，不順手重構、不改無關格式。
4. 不把任何密鑰、token、連線字串、OAuth 憑證寫入 repo。
5. 涉及登入、OTP、cookie、Redis、檔案下載或上傳時，優先檢查 OWASP Top 10 風險。
6. 使用程式碼做確定性工作；Codex 只用於摘要、判斷、設計與說明。
7. 完成重要步驟後要 checkpoint：說明做了什麼、驗證了什麼、還剩什麼。
8. 若測試或建置未執行，必須明說，不可宣稱測試通過。

## 專案地圖

```text
fileuploader/
├── AGENTS.md                    Codex 入口文件
├── CLAUDE.md                    Claude 專案交接文件與主要知識來源
├── .codex/
│   ├── config.toml              Codex 最小安全設定
│   └── agents/                  Codex agents TOML 放置位置
├── .agents/
│   └── skills/                  Codex/Agents skills 放置位置
├── src/
│   ├── middleware.ts            登入守門與公開路由豁免
│   ├── app/
│   │   ├── page.tsx             主站上傳介面
│   │   ├── login/page.tsx       Email OTP 與 TOTP 登入頁
│   │   ├── admin/page.tsx       白名單、封鎖 IP、TOTP 管理頁
│   │   └── api/
│   │       ├── auth/            OTP、TOTP、session、remember-device API
│   │       ├── admin/           whitelist、blocklist、TOTP、block-action API
│   │       ├── upload/          gdrive、github、presigned upload API
│   │       ├── download/        gdrive download proxy
│   │       └── files/           檔案清單 API
│   ├── components/upload/       上傳 UI 元件
│   └── lib/
│       ├── auth.ts              JWT、OTP hash、admin 判斷
│       ├── whitelist.ts         Redis 白名單存取
│       ├── rateLimit.ts         Rate limit 與 IP 封鎖
│       ├── device.ts            記住裝置 token
│       ├── totp.ts              TOTP 產生、驗證與 Redis 存取
│       ├── blockNotify.ts       IP 封鎖警示信
│       └── providers/           儲存 provider 實作
├── docs/                        換版與資安文件
├── package.json                 npm scripts 與相依套件
├── vercel.json                  Vercel 設定
└── netlify.toml                 Netlify 設定
```

## 環境與密鑰

本機密鑰只允許放在 `.env.local` 或部署平台環境變數中，不可寫入 `AGENTS.md`、`.codex/config.toml`、測試檔或文件範例。

重要環境變數名稱請參考 `CLAUDE.md`，但不要在 Codex 回覆或設定檔中貼出真實值。

## 常用指令

```powershell
npm run build
```

本機 build 若出現 Google OAuth refresh token 相關錯誤，先確認是否為 `CLAUDE.md` 記錄的預期本機限制；不要未經確認就改 OAuth 流程。

## 新需求流程

1. 先讀 `CLAUDE.md` 的「待辦」、「使用者偏好」、「工程紀律」。
2. 釐清需求範圍與成功標準。
3. 讀相關 `src/app/api/`、`src/lib/`、`src/middleware.ts`。
4. 小範圍修改。
5. 執行可行的驗證，例如 `npm run build`。
6. 回報異動、驗證結果、未執行項目與殘餘風險。

## Claude 轉 Codex 狀態

- `CLAUDE.md` 已作為本檔的專案知識來源。
- 目前未找到專案層 `.claude/skills/`，所以沒有可複製的 Claude skills。
- 目前未找到專案層 `.claude/agents/*.md`，所以沒有可轉換的 Claude agents。
- 若日後新增 Claude skills 或 agents，請同步到 `.agents/skills/` 或 `.codex/agents/`。
