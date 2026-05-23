# 程式差異比對表

## `.gitignore`

| 項目 | Before | After | 差異說明 |
|---|---|---|---|
| Netlify 本機資料夾 | 未設定 | `.netlify` | 避免 Netlify CLI 或本機連線資訊被 commit。 |

## `netlify.toml`

| 項目 | Before | After | 差異說明 |
|---|---|---|---|
| Netlify 建置設定 | 無 | `[build] command = "npm run build"` | 讓 Netlify 使用與現有 Next.js 專案一致的 build script。 |
| Netlify 發布目錄 | 無 | `publish = ".next"` | 依 Netlify Next.js 建議設定發布 Next.js build output，避免部署成空站或 404。 |
| Node.js 版本 | 無 | `NODE_VERSION = "20"` | 固定建置環境，降低平台預設版本變動風險。 |
| 安全標頭 | 僅存在於 `vercel.json` | `[[headers]] for = "/*"` | 將網站層級安全標頭轉換為 Netlify 格式。 |

## 新增文件

| 項目 | Before | After | 差異說明 |
|---|---|---|---|
| 異動文件 | 無本次 Netlify 部署文件 | `docs/netlify-deployment-2026-05-23/` | 依工作區規範建立本次異動必要文件。 |
