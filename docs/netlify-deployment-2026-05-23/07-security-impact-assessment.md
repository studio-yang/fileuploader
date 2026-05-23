# 資安影響評估

## 異動摘要

本次新增 Netlify 部署設定與安全標頭，讓既有 Next.js 專案可由 Netlify 透過 GitHub 連動部署。

## 資安影響範圍

- 部署平台新增 Netlify，需於 Netlify 後台安全保存 production 環境變數。
- 新增安全標頭設定，降低 clickjacking、MIME sniffing 與 referrer 洩漏風險。
- 未新增資料庫、登入流程或權限模型。

## OWASP Top 10 對應檢查

| 項目 | 風險評估 | 說明 |
|---|---|---|
| Broken Access Control | 低 | 本次未更動權限邏輯。 |
| Cryptographic Failures | 低 | 未新增密碼或加密流程；Netlify 預設 HTTPS。 |
| Injection | 低 | 未新增 SQL 或命令執行。 |
| Insecure Design | 中 | 大檔若誤走 Netlify Function 會受平台限制；需維持瀏覽器直傳設計。 |
| Security Misconfiguration | 中 | 需正確設定 Netlify 環境變數與安全標頭。 |
| Vulnerable Components | 中 | 未新增 npm dependency，但 `npm ci` 顯示既有 `next@14.2.5` 有安全更新警告，建議另案升級。 |
| Identification and Authentication Failures | 低 | 未更動驗證流程。 |
| Software and Data Integrity Failures | 低 | 使用 GitHub 連動部署，需保護 repo 權限。 |
| Logging and Monitoring Failures | 低 | 未新增監控；部署後需查看 Netlify deploy/function logs。 |
| SSRF | 低 | 未新增後端外部 URL 輸入。 |

## 風險等級判定

- 整體風險：低
- 判定依據：本次主要為部署設定，不更動業務邏輯、上傳流程或敏感資料處理。

## 緩解措施

- `.netlify` 加入 `.gitignore`。
- 真實環境變數僅放在 Netlify 後台，不寫入 repo。
- 保留大型檔案瀏覽器直傳流程，避免 Netlify Function payload 限制。
- 新增 Netlify 與 Next.js 全站安全標頭。

## 殘餘風險

- Netlify 環境變數若漏設或值錯誤，API route 會失敗。
- GitHub 小檔上傳仍受 Netlify Function payload 限制，應避免用於大型檔案。
- 既有 `next@14.2.5` 顯示安全更新警告，本次部署設定未處理套件升級。

## 評估資訊

- 資安評估人員：Codex
- 日期：2026-05-23
