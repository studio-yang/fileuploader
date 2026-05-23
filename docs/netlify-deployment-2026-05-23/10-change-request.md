# 換版申請書

## 基本資料

- 換版系統：FileFlow
- 需求編號：REQ-20260523-NETLIFY-001
- 預計換版日期與時間：
- 版本說明：新增 Netlify 部署支援

## 換版步驟

1. 確認 GitHub main 分支已包含 `netlify.toml`。
2. 登入 Netlify，選擇從 GitHub 匯入 `studio-yang/fileuploader`。
3. 設定 build command 為 `npm run build`。
4. Publish directory 使用 `.next`，讓 Netlify Next.js adapter 處理 build output。
5. 確認 Netlify build 有載入 `@netlify/plugin-nextjs`。
6. 設定 production 環境變數。
7. 觸發首次 deploy。
8. 檢查 deploy log，確認 Next.js adapter 正常啟用。
9. 開啟 Netlify 網址，執行 IT 測試與 UAT。

## 影響範圍與停機時間

- 影響範圍：新增 Netlify 部署環境。
- 既有 Vercel 站台：不受影響。
- 預計停機時間：0 分鐘。

## 風險評估

- 風險等級：低
- 主要風險：Netlify 環境變數漏設、GitHub 小檔上傳受 payload 限制、大檔誤走後端上傳流程。

## 換版前確認清單

| 項目 | 狀態 |
|---|---|
| GitHub main 分支更新完成 | 待確認 |
| Netlify production 環境變數設定完成 | 待確認 |
| 未將真實 Token 或金鑰 commit 到 repo | 待確認 |
| 已通知測試人員 Netlify 網址 | 待確認 |

## 審核欄位

- 申請人：
- IT 審核：
- 資安審核：
- 核准主管：
