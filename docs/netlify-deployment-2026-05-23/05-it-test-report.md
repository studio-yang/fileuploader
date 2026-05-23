# 測試報告（IT 驗證）

## 測試環境

- 本機作業環境：Codex workspace
- 原始碼來源：`studio-yang/fileuploader`
- 分支：`main`
- 測試日期：2026-05-23

## 測試案例

| 編號 | 測試項目 | 輸入條件 | 預期結果 | 實際結果 | 是否通過 |
|---|---|---|---|---|---|
| TC-001 | 檢查 Git 狀態 | 執行 `git status --short` | 僅出現本次預期異動 | 僅出現 `.gitignore`、`netlify.toml`、`docs/` 異動 | 通過 |
| TC-002 | Netlify 設定檢查 | 檢查 `netlify.toml` | 包含 build command、Node 20、安全標頭 | 已包含 `npm run build`、`NODE_VERSION = "20"` 與安全標頭 | 通過 |
| TC-003 | Next.js 建置 | 執行 `npm run build` | 建置成功 | 建置成功；本機沙盒執行曾因 Windows `spawn EPERM` 失敗，改一般權限後通過 | 通過 |
| TC-004 | Netlify 首次部署 | 由 Netlify 匯入 GitHub repo | Deploy 成功且啟用 Next.js adapter | 待 Netlify 環境執行 | 待測 |
| TC-005 | Google Drive 檔案列表 | 呼叫 `/api/files?provider=gdrive` | 回傳檔案列表或空陣列 | 待 Netlify 環境執行 | 待測 |
| TC-006 | GitHub 小檔上傳 | 上傳小於 4.5 MB 檔案 | Release asset 產生並回傳下載連結 | 待 Netlify 環境執行 | 待測 |
| TC-007 | 安全標頭 | 檢查 Netlify response headers | 回傳本次設定的安全標頭 | 待 Netlify 環境執行 | 待測 |

## 資安測試項目

- SQL Injection：本次未涉及 SQL 或資料庫查詢。
- XSS：本次未更動畫面輸出邏輯。
- Secret Exposure：未將任何實際 Token、金鑰或環境變數值寫入 repo。
- Security Headers：已加入 Netlify 網站層級安全標頭設定。
- Dependency Warning：`npm ci` 顯示既有 `next@14.2.5` 有安全更新警告，本次未新增 dependency，建議另開升級任務評估。

## 測試結論

本機建置驗證已通過。實際 Netlify deploy、API 呼叫與上傳功能需於 Netlify production 環境完成後補登結果。
