# 退版操作指引

## 退版觸發條件

- Netlify build 持續失敗且無法於換版時窗內排除。
- Netlify 網址首頁無法正常載入。
- Netlify API route 因環境變數或平台限制造成主要功能不可用。
- 安全標頭或部署設定造成不可接受的相容性問題。

## 退版前準備事項

1. 確認既有 Vercel 站台仍可正常服務。
2. 保留 Netlify deploy log 與錯誤訊息。
3. 通知測試人員暫停驗收 Netlify 網址。

## 退版步驟

1. 在 Netlify 後台暫停或刪除本次新增的 Netlify project。
2. 若已設定自訂網域，將 DNS 指回既有 Vercel 或停用 Netlify alias。
3. 若需回復程式設定，從 GitHub revert 新增 `netlify.toml` 與 `.gitignore` 中 `.netlify` 的變更。
4. 確認 GitHub main 分支回到退版後狀態。
5. 通知相關人員改回使用既有 Vercel 網址。

## 退版後驗證項目

| 驗證項目 | 預期結果 |
|---|---|
| Vercel 網址可開啟 | 首頁與功能維持正常。 |
| GitHub main 分支狀態正確 | 不含需退回的 Netlify 設定。 |
| Netlify 網址不再對外提供服務 | 避免使用者誤連異常環境。 |

## 負責人與聯絡方式

- 退版負責人：
- 聯絡電話：
- 備援聯絡人：
