# 需求規格文件

## 基本資料

- 需求編號：REQ-20260523-NETLIFY-001
- 需求來源：使用者要求將既有 Vercel 網站同步支援 Netlify 部署
- 系統名稱：FileFlow
- 異動日期：2026-05-23

## 功能描述與業務目的

本次需求是在保留既有 Vercel 部署的前提下，新增 Netlify 部署支援。目的為讓同一份 GitHub 原始碼可由 Netlify 連動建置，提供第二個 HTTPS 部署環境。

## 功能範圍

- 新增 Netlify 建置設定。
- 指定 Node.js 20 與 `npm run build` 作為 Netlify 建置基準。
- 將既有 Vercel 網站安全標頭轉換為 Netlify headers 設定。
- 補充本次部署異動文件。

## Out of Scope

- 不搬移或取代現有 Vercel 正式站台。
- 不變更檔案上傳流程、API route 邏輯或儲存供應商設定。
- 不新增 Netlify 自訂 Functions。
- 不提交任何真實環境變數、Token 或金鑰。

## 相關參考

- `package.json`
- `vercel.json`
- `netlify.toml`
- Netlify Next.js / OpenNext 部署機制
