# CLAUDE.md — FileUploader 專案交接文件

> ⚠️ **此檔專供 Claude AI 接手新 session 時快速進入狀況使用**
> 每次重大進度後請更新「📈 已完成」「🚧 待辦」「🔄 變更歷史」三個區塊。

---

## 🎯 一句話總覽

彰化商業銀行檔案傳輸平台（FileUploader），Next.js + **Fly.io**，**已實作**：Email OTP 登入 + 白名單管理 + IP Rate Limit／封鎖 + 記住裝置（30天）+ IP 封鎖警示信 + TOTP 備援登入 + Brevo 寄信 + UX v2.0 全 30 項 + Mobile RWD + Lottie + PWA/SW + **i18n 繁中/英文**。

> 🔴 **2026-08-06/07 重大變更：主站已從 Vercel 遷移到 Fly.io。**
> 原因：`vercel.app` 與 `zeabur.app` 都被行內資安處的 **F-ISAC 網域封鎖**，同仁連不進去。
> `tdoc-fileflow.fly.dev` **已在行內實測可達、可登入**，Vercel 舊站保留作備援。

---

## ⏭️ 接手後第一件事

1. 讀完本檔（~3 分鐘）
2. **立刻執行** `npm run mem0:load` → 載入跨 session 的專案記憶
3. 看「🚧 待辦」確認目前要做什麼
4. 看「🛡️ 工程紀律 12 條鐵則」**先內化**，再看「👤 使用者偏好」**務必遵守**
5. 直接動工或先問使用者確認

---

## 📋 專案基本資料

| 項目 | 內容 |
|------|------|
| Repo | https://github.com/studio-yang/fileuploader |
| 部署 URL（主）| **https://tdoc-fileflow.fly.dev** ← 行內唯一連得進去的 |
| 部署 URL（備援）| https://chb-fileuploader.vercel.app ← ⚠️ 行內被 F-ISAC 擋 |
| 平台 | **Fly.io**（`fly deploy` 手動部署，非 push 自動）／ Vercel 備援 |
| Fly app 名稱 | `tdoc-fileflow`，region `nrt`（東京）|
| Owner | 彰銀資訊部 員工 **176752** |
| Owner Email | alan0109@mail2000.com.tw |
| 主要分支 | `main` |
| 本機路徑 | `C:\Users\Alan\Projects\fileuploader` |

---

## 🧱 技術棧

- **Next.js 14.2.5** App Router + TypeScript
- **Tailwind CSS**（含 `liquid-glass-*` 自訂 utilities）
- **設計風格**：iOS visionOS / Liquid Glass，深色 slate-blue 中性底
- **部署**：Vercel（已配 `vercel.json`）
- **儲存**：Google Drive（既有）、GitHub Releases、Upstash Redis（`ioredis` 連線）

### 套件（重點）
```
next            14.2.5
react           18
tailwindcss     3
googleapis      (gdrive 上傳用)
react-dropzone  (拖拉上傳)
brevo           (寄 OTP / 封鎖警示信，透過 REST API fetch，取代 resend)
jose            (JWT 簽發/驗證)
ioredis         5.x  ← 白名單/封鎖/裝置/TOTP 資料存取（取代 @upstash/redis）
otpauth         (TOTP 備援登入)
qrcode          (TOTP QR Code 產生)
```

---

## 🔐 環境變數（Vercel + 本機 .env.local）

| Var | 用途 | Sensitive |
|-----|------|-----------|
| `BREVO_API_KEY` | Brevo 寄信 API Key | ✅ |
| `BREVO_SENDER` | 寄件人信箱（`alan0109@mail2000.com.tw`，已在 Brevo 驗證）| ❌ |
| `OTP_RECIPIENT` | 系統管理員 email（`alan0109@mail2000.com.tw`）| ❌ |
| `AUTH_SECRET` | JWT 簽章金鑰（96 字元 hex）| ✅ |
| `REDIS_URL` | Upstash Redis 連線字串（`rediss://...`），由 Vercel Storage 注入 | auto |
| Google OAuth 系列 | gdrive 上傳用，既有未變動 | ✅ |
| `RESEND_API_KEY` | 舊 Resend Key，已停用，可保留或刪除 | — |

> ⚠️ **寄信改用 Brevo**（不需安裝套件，直接 fetch Brevo REST API）。
> Resend 限制：未驗證網域時只能寄給帳號本人，無法寄給其他收件人。
> ⚠️ **Redis 實際注入的是 `REDIS_URL`（Redis 協定格式），不是 `KV_REST_API_URL`。**
> 程式碼用 `ioredis` 直接讀 `REDIS_URL`，若未來換成 Vercel KV 需重查 env var 名稱。
> 真實 secret 從不寫入本檔，見本機 `.env.local`（git-ignored）。

---

## 🗂 檔案地圖（重點）

```
fileuploader/
├── CLAUDE.md
├── src/
│   ├── app/
│   │   ├── page.tsx                     主站（RWD、背景淡化、header 管理員入口+登出）
│   │   ├── globals.css                  樣式（中性 slate 底色、saturate 降低）
│   │   ├── layout.tsx                   root
│   │   ├── login/page.tsx               登入頁（OTP + TOTP 備援 + 記住裝置 Modal）
│   │   ├── admin/page.tsx               管理頁（白名單 + 封鎖 IP + TOTP 設定）
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── request-otp/         Email OTP 產生 + Rate Limit + 封鎖警示信
│   │       │   ├── verify-otp/          OTP 驗證 + session cookie
│   │       │   ├── verify-totp/         TOTP 備援登入驗證
│   │       │   ├── check-device/        頁面載入時偵測已記住裝置 + 自動寄 OTP
│   │       │   ├── remember-device/     儲存裝置 token（30 天）
│   │       │   ├── me/                  回傳 { email, isAdmin }
│   │       │   └── logout/              清 cookie
│   │       ├── admin/
│   │       │   ├── whitelist/           GET/POST/DELETE 白名單
│   │       │   ├── blocklist/           GET/DELETE 封鎖 IP
│   │       │   ├── totp/                GET/POST/DELETE TOTP 設定
│   │       │   └── block-action/        email 動作按鈕（公開，JWT 驗證）
│   │       └── upload/                  既有（gdrive/github/gcs）
│   ├── middleware.ts                     守門（admin gate + block-action 豁免）
│   └── lib/
│       ├── auth.ts                      JWT + OTP hash + isAdminEmail
│       ├── whitelist.ts                 白名單 Redis CRUD（ioredis）
│       ├── rateLimit.ts                 Rate limit + IP 封鎖（ioredis）
│       ├── device.ts                    記住裝置 CRUD（ioredis，TTL 30天）
│       ├── totp.ts                      TOTP 產生/驗證/Redis 存取
│       ├── blockNotify.ts               IP 封鎖警示信（含動作按鈕）
│       └── [既有] gdriveResumable / utils / types / providers
```

---

## 📈 已完成的工作（依時序）

| Commit | 內容 |
|--------|------|
| `667b7a1` | RWD、背景淡化 |
| `3531a70` | 去藍飽和、文字對比修正 |
| `98e9ec3` | Footer 文案 |
| `705071d` | **Magic-link OTP 登入系統** |
| `ac9ee72` | OTP 6 位自動驗證、錯誤清空 |
| `46c80bc` | **Email 白名單 + 管理介面** |
| `443c1f1` | **Rate Limit + 永久 IP 封鎖**（3 分鐘 5 次）、admin 解鎖 UI |
| `00f24d4` | **ioredis 替換**（修正 KV 連線失敗：`REDIS_URL` 是 Redis 協定，非 REST）|
| `737de9c` | **記住裝置**（30 天 cookie、自動偵測 + 自動寄 OTP、記住裝置 Modal）|
| `d7fde25` | **IP 封鎖警示信 + TOTP 備援登入**（郵件含城市/裝置/動作按鈕；管理後台 TOTP 設定；登入頁備援切換）|

---

## 🚧 待辦（目前進度）

### 🔴 現在最優先（2026-08-07 交接）

| # | 待辦 | 說明 |
|---|------|------|
| 1 | **10 個 commit 尚未 push** | `git push origin main`。Claude 的權限被守衛擋住，**必須由使用者手動執行** |
| 2 | **行內實測 Drive 上傳／下載** | 認證已驗證通過（`oauth.ok: true`），但「瀏覽器 → googleapis.com」這段在行內尚未實測。這是最後一塊拼圖 |
| 3 | **量測 refresh token 存活天數** | 見「Drive OAuth 401」章節。`2026-08-07` 的新 token 是第一個有明確起算點的樣本，**別浪費這次機會** |
| 4 | 每週看 Fly Billing | 無支出上限，只能人工盯 |

### ⚠️ 行內網路封鎖的已知範圍（很重要）

- ❌ `vercel.app`、`zeabur.app` — 確認被擋
- ✅ `fly.dev` — **實測可通**
- ⚠️ 使用者回報「行內會阻擋 Drive/GitHub 關連的網址」，但也說**過去在行內用 Drive 上傳下載都正常**。兩者矛盾，**尚未釐清**，待辦 #2 會給出答案
- 若證實 Drive/GitHub 網域真的被擋 → 檔案必須改走伺服器端（**零件已存在**：`/api/download/gdrive/[fileId]`、`/api/upload/gdrive` 都是現成的伺服器端串流路由，工作是「重新接線」而非從零開發）

### ✅ 已完成：UI/UX 全面優化（方案 4） — 全 30 項

> 圖例：☐ 未做 / 🔄 進行中 / ✅ 完成
> 中途若 session 被打斷（rate limit、context 滿），下個 session 從本清單接續。
> 完成的項目立刻打 ✅ 並 commit。

**Tier S（快速見效）✅ 完成**
- ✅ S1 Toast 系統 + 5 秒 Undo Toast（取代 alert）
- ✅ S2 Tab active 狀態加底線 + bold
- ✅ S3 Header counter 在下載中心隱藏
- ✅ S4 永久刪除加「輸入確認字樣」防誤刪
- ✅ S5 Counter 點擊跳到該狀態檔案

**Tier A（明顯改善）✅ 完成**
- ✅ A1 檔案 icon 改用 lucide-react
- ✅ A2 排序按鈕加 ↑↓ + 雙擊反向
- ✅ A3 垃圾桶入口顯示項目數 badge
- ✅ A4 主要按鈕 hover lift 動效
- ✅ A5 確認對話框文案重寫
- ✅ A6 Empty state 加 CTA
- ✅ A7 Loading 改 skeleton
- ✅ A8 長檔名 tooltip
- ✅ A9 複製成功 ripple/pulse 動畫

**Tier B（進階體驗）✅ 完成**
- ✅ B1 Keyboard shortcuts（Ctrl+A 全選 · Del 刪除 · Esc 取消）
- ✅ B2 圖片 hover 預覽
- ✅ B3 Mobile header hamburger
- ✅ B4 上傳完成 confetti（純 CSS emoji 粒子）
- ✅ B5 管理頁分頁切換（白名單 / 封鎖 IP / 備援登入）
- ✅ B6 Light/Dark theme
- ✅ B7 First-time onboarding

**Tier C（設計系統）✅ 完成**
- ✅ C1 Typography tokens（globals.css: --fs-h1/h2/h3/body/caption/micro + .t-* utility classes）
- ✅ C2 Semantic color tokens（--color-success/warning/danger/info/neutral + _bg 版本）
- ✅ C3 Elevation tokens（--elev-0/1/2/3/4/modal）
- ✅ C4 ARIA labels（checkbox/icon 按鈕）+ light theme 對比拉到 WCAG AA
- ✅ C5 抽出共用 Button 元件（`@/components/ui/Button`，含 6 variants × 3 sizes）

最後完成：UI/UX 全面優化方案 4（30 項全做完）。

---

## 🚨 高優先未解問題：Drive OAuth 401 已復發 5 次

> ⚠️ **使用者明確要求**：堅持用 Drive（已訂 2TB 付費版），不要再建議改 GCS 或 Service Account。
> 必須找根本原因。

### 已知無效的「快速修法」
- ❌ Service Account：個人帳號 SA 沒儲存配額
- ❌ Client Secret rotation：反而觸發 token 失效（**官方確認**：換 secret 會讓該 client 底下所有 refresh token 一次失效）
- ❌ OAuth Playground 重產 refresh token：撐不久就再壞

### 2026-08-07 調查進度（重要，別重複走冤枉路）

**已排除的原因：**
| 原因 | 判定依據 |
|------|---------|
| ❌ 發佈狀態「測試中」→ 7 天過期 | **已確認發佈狀態本來就是「正式版」** |
| ❌ Token 6 個月未使用 | 天天在用 |
| ❌ 改密碼 + Gmail scope | 用的是 Drive scope |

**目前最大嫌疑：單一帳號 refresh token 累積超過上限（50）**
超過時 Google 會**靜默撤銷最舊的**，形成自我強化迴圈：
壞掉 → 重產 → 舊的沒清 → 總數 +1 → 更快被擠掉 → 再重產…
這解釋了「重產一次撐不久就再壞」。

**下一步該做的事（關鍵）：**
1. 🔬 **量測 token 存活天數** — `2026-08-07` 產生了一顆新 token 並驗證有效（`oauth.ok: true`），**這是第一次有明確起算點**。每 2～3 天打健檢看 `oauth.ok`，記下變 `false` 的日期
   - 約 7 天死 → 仍有政策性過期，重查驗證狀態
   - **重產新 token 後就死 → 確認是 50 上限**
   - 無規律 → 查帳戶活動有無外部撤銷
2. 若要重置累積量：[Google 帳戶 → 第三方存取權](https://myaccount.google.com/permissions) 移除該應用 → 再產一顆
   ⚠️ 這會連 Vercel 在用的那顆一起殺掉
3. 使用者用個人 Google 帳號，**沒 Workspace** → Domain-Wide Delegation 不適用

### 健檢端點（診斷 Drive 必用）
```
https://tdoc-fileflow.fly.dev/api/upload/gdrive-health
```
看 `env.ok` / `oauth.ok` / `folder.ok` 三個欄位。`oauth.ok` 才是 refresh token 有效性的證明。
⚠️ 這支曾因被 Next.js 靜態化而**回傳建置時的假快照**，已於 `dba61ad` 加 `force-dynamic` 修正。

### 最新 commit
- `1889ab6` `/api/files/proxy` 解決外部 URL CORS
- Pack 功能（ZIP + 7z web worker + 後端密碼 + 壓縮率 slider）已完整

### 🔄 下次接手時的進化選單（已存 mem0，跑 `npm run mem0:load` 看完整版）

**UX v2.0 進化提案**（共 20 項，分 4 Tier）

| Tier | 內容（精簡）|
|------|------|
| S+ 業界標配 | 1) ⌘K Command Palette  2) 右鍵 Context Menu  3) 列表自動同步  4) 記住 provider |
| A+ 視覺進化 | 5) Magnetic buttons  6) Cursor-follow glow  7) Spring animations  8) Lottie 空狀態  9) Toast stagger  10) Shimmer skeleton |
| B+ 智能化 | 11) 釘選  12) 重複偵測  13) 批次進度條  14) 分享對話框  15) 稽核 Log  16) 拖曳重排 |
| S++ 結構級 | 17) PWA  18) Service Worker  19) Grid View  20) i18n |

**推薦組合**：1 + 2 + 4 + 5 + 6 共 ~1,530 tokens，做完跳一個 League。

### ✅ UX v2.0 全部完成（共 20 項）

- #8 Lottie 空狀態動畫、#17 PWA、#18 Service Worker、#20 i18n zh-TW/en

### 🟡 其他已知但暫不處理（等使用者要求才動）
- **登入失敗鎖定**（連續輸入錯誤 OTP N 次後封鎖）
- **白名單擴充欄位**（最後登入時間、登入次數、備註）
- **下載端保護**（GD URL 仍公開，站台本身已關起來）

---

## 🛡️ 工程紀律 12 條鐵則（最高優先，超越其他規範）

> ⚠️ 以下 12 條規則適用於每一個任務，除非明確被覆寫。
> 原則：**非簡單工作時，謹慎優先於速度**。
> 簡單瑣事可自行判斷，重要工作必須嚴格遵守。

### 規則 1 — 動手前先思考
- 明確說出你的假設，不確定時**詢問而非猜測**
- 遇到模糊地帶，列出多種可能的解讀
- 若有更簡單的做法，**主動提出反對意見**
- 卡住時停下來，明確說出哪裡不清楚

### 規則 2 — 簡單優先
- 用**最少的程式碼**解決問題，不做投機性開發
- 不增加使用者沒要求的功能
- 單次使用的程式不做抽象化封裝
- 自我檢驗：資深工程師看了會不會覺得過度設計？會的話就簡化

### 規則 3 — 外科手術式異動（極度重要）
- **只動該動的程式**，只清理你自己造成的問題
- **禁止**順手「改善」鄰近的程式碼、註解或格式
- **禁止**重構沒壞的程式
- 必須**遵循現有程式的風格**

### 規則 4 — 目標導向執行
- 定義明確的成功標準，反覆驗證直到達成
- 不照本宣科按步驟做，而是定義成功標準後自行迭代
- 強健的成功標準讓你能獨立完成任務

### 規則 5 — Claude 只用於判斷類工作
- ✅ Claude 適用於：分類、起草、摘要、資訊擷取
- ❌ Claude **不適用於**：路由、重試、確定性轉換
- 凡是程式碼能解決的，就用程式碼，不要用 AI 判斷

### 規則 6 — Token 預算不是建議，是強制（避免 Context 爆掉）
- **單一任務上限：4,000 tokens**
- **單次 session 上限：30,000 tokens**
- 接近上限時：**主動摘要並開新 session**
- 超出預算必須**明白告知使用者**，禁止偷偷超用

### 規則 7 — 衝突要明說，不要折中
- 遇到兩種模式衝突時，**選一個**（較新的、測試過的優先）
- 必須**解釋為什麼這樣選**
- 把另一個方案**標記為待清理**
- 禁止把衝突的模式混在一起

### 規則 8 — 寫程式前先讀程式
- 加入新程式前，先讀：exports、直接呼叫者、共用工具
- 「看起來無關」是危險訊號
- 不理解現有程式的結構時，**主動詢問**

### 規則 9 — 測試要驗證「意圖」，不只是「行為」
- 測試必須說明**為什麼**這個行為重要，不只是**做了什麼**
- 業務邏輯變更時，**測試應該要會失敗**，才是好測試

### 規則 10 — 每個重要步驟都要 Checkpoint（避免 Context 爆掉）
- 完成一個步驟就**摘要**：做了什麼、驗證了什麼、還剩什麼
- 不要從一個「你無法描述清楚」的狀態繼續做下去
- 失去頭緒時：**停下來，重新陳述目前狀態**

### 規則 11 — 遵循現有程式的慣例，即使你不認同
- 在現有專案內，**遵循慣例 > 個人喜好**
- 真心覺得某個慣例有害？**提出來討論**，不要自己偷偷改
- 不能因為自己覺得更好就分岔另一種風格

### 規則 12 — 失敗要大聲說
- 「完成」這兩個字，**只要有任何步驟被跳過就是錯的**
- 「測試通過」**只要有任何測試被跳過就是錯的**
- 預設要**主動揭露不確定性**，禁止隱藏

---

## 👤 使用者偏好（極重要，違反會被打槍）

### 語言
- **繁體中文（台灣風格）**：「軟體」非「软件」、「網路」非「网络」

### Token 使用
- **極簡優先**：使用者多次強調「最少 token」、「不要產出文件」
- 不要產出全域 CLAUDE.md 規範的 11 份必要文件 — **本專案明確說不要**
- 預估 token 要**誠實+具體**

### 風格
- **直接、結論先行**
- 提供選項時用**表格** + 推薦標記
- 重要警告用 ⚠️

### 工作模式
- **Go beyond the basics**（別只做到基本款）— 每個回應都要打磨到像給真實客戶交付的成品
- 回答前先思考，必要時使用較高推理強度
- 改完**立刻 commit + push**
- Commit message：**簡短英文 imperative**
- 不寫單元測試
- **新需求流程**：使用者先說需求 → Claude 評估 + token 估算 → 使用者說「動工」→ 才開始

### 已知雷區
- 「固定密碼 CHB 加密」、「帳號=密碼=工號 176752」— **已被否決，不要做**

---

## 🧠 mem0 記憶系統（給 Claude 用）

| 指令 | 用途 | 時機 |
|------|------|------|
| `npm run mem0:load` | 載入所有專案記憶 | **每次接手必執行** |
| `npm run mem0:save -- "內容"` | 儲存一筆記憶 | 完成重要決策後 |
| `npm run mem0:search -- "關鍵字"` | 搜尋特定記憶 | 需要查找歷史決策時 |
| `npm run mem0:delete -- <id>` 或 `--keyword "字串"` | 刪除特定記憶 | 記憶過時或錯誤時 |

> 記憶儲存在 mem0 雲端（`user_id: chb-fileuploader`），跨 session 永久保留。
> Scripts 位於 `scripts/mem0-*.mjs`，需要 `.env.local` 中的 `MEM0_API_KEY`。
> **何時該存記憶**：換了套件、改了架構決策、踩過坑、使用者明確的偏好。

---

## ⚙️ 工作慣例與環境

### Build
- `npm run build`
- **預期錯誤（不必修）**：`[gdrive-token] Error: No refresh token` — 本機無 Google OAuth token，Vercel 上正常

### 部署（主站 = Fly.io）

```bash
fly deploy --remote-only        # 從本機檔案部署，不經 GitHub
fly status                      # STATE=started + CHECKS=passing 才算成功
fly logs                        # 除錯
fly secrets list                # 看有哪些 secrets（不顯示值）
fly ssh console -C "free -m"    # 進機器看記憶體
```

- ⚠️ **不是 push 自動部署** —— `fly deploy` 讀的是**本機檔案**，跟 GitHub 無關
- ⚠️ **不要用網頁版 Launch UI** —— 會覆寫 `fly.toml`、把 `[build.args]` 洗掉
- ⚠️ **`fly deploy` 常誤報失敗** —— 出現 `net/http: request canceled` / `wsarecv` 是本機連 Fly API 斷線，**先跑 `fly status` 確認**再決定要不要重跑
- 完整操作手冊：`docs/fly-deploy-manual.html`
- 備援：Vercel 仍可 push 到 main 自動部署（但行內連不進去）

### 🕳️ Fly.io 六個實戰坑（全部已修，勿回退）

> 共同點：**沒有一個是 Fly 的問題**，全是這 app 第一次離開 Vercel serverless 才浮現的。Vercel 幫忙擋掉了，所以以前遇不到。

| # | 症狀 | 真因 | 修法（在哪） |
|---|------|------|------------|
| 1 | `npm ci` 說 `Missing: gaxios@7` | lock 檔由 npm 11 產、鏡像內是 npm 10 | Dockerfile `npm install -g npm@11` |
| 2 | `gyp ERR! find Python` | `mem0ai` 帶進原生模組 `better-sqlite3`，alpine 無編譯器 | Dockerfile `apk add python3 make g++` |
| 3 | health check `connection refused` | Fly 注入 `HOSTNAME=<machine-id>`，`next start` 拿它當綁定位址而退回 localhost | Dockerfile CMD 加 `-H` |
| 4 | health check `connection refused`（**同訊息、不同病因**）| 綁 `0.0.0.0` 只有 IPv4，**Fly 內網是 IPv6** | CMD 改綁 `-H ::`（雙棧）|
| 5 | 機器停掉後外部一直 502 | **誤判** — 真因是 #4。IPv6 修好後 auto-stop 完全正常（冷啟動 10.3 秒）| `fly.toml` auto_stop 已重新啟用 |
| 6 | 環境變數明明有，API 卻說全部缺失 | 該 route 被 Next.js **靜態化**，回傳建置時快照。Vercel 建置時就注入 env 所以剛好正確，Fly 的 secrets 是執行期才注入 | `export const dynamic = 'force-dynamic'` |

⚠️ **坑 3/4 和坑 5 的教訓：一次只改一件事。** 當初同一輪改了 IPv6 綁定又關掉 auto-stop，導致歸因錯誤，把「auto-stop 不可用」寫進文件，事後才發現是冤枉的。

| 7 | 下載檔案時連線中斷、機器不斷重開 | **256MB 記憶體不足**，next-server 被 OOM killer 殺掉（2 分鐘內 7 次）。平常瀏覽沒事，一下載就掛 | `fly.toml` memory 改回 `512mb` |

⚠️ **坑 7 的教訓**：降記憶體省的是每月 NT$10，但 auto-stop 才是真正省錢的那項。兩者一起做時，降記憶體的邊際效益幾乎是零，卻換來核心功能壞掉。**別再為了 NT$10 動記憶體。**

⚠️ **坑 6 值得全域檢查**：build log 的路由表裡 `○` = 靜態、`ƒ` = 動態。**任何讀 `process.env` 的 GET route 若是 `○` 就會回傳假資料**。目前全站只有 `gdrive-health` 中招且已修。

### 💰 Fly.io 費用（無支出上限，要自己盯）

- 機器：`shared-cpu-1x / 512MB` + auto-stop → **約 US$0.8/月**（NT$26）。⚠️ **不可降到 256MB**，見坑 7
- 流量：東京 **US$0.04/GB，無免費額度**；進站免費、出站計費
- 🔴 **Fly 不提供支出上限，也沒有帳單警示**（預付點數也不是上限，用完直接扣卡）
- 🔴 因行內擋 Drive/GitHub 網域，檔案可能必須穿過 Fly，這筆流量費省不掉
- ✅ **請每週看一次 Fly 後台 Billing**，這是目前唯一的煞車
- 復原開關都寫在 `fly.toml` 註解裡（記憶體不夠改回 512、嫌冷啟動慢改回常駐）

---

## 🔐 認證系統設計（完整）

```
訪問任何頁面
  → middleware 攔截（白名單：/login、/api/auth/*、/api/admin/block-action）
  → 無 session → 跳 /login

/login 頁（載入時）
  → GET /api/auth/check-device
    ├─ 有 remembered_device cookie + Redis 有效 + 白名單通過
    │   → 自動寄 OTP → 直接顯示驗證碼輸入框（跳過 Email 輸入）
    └─ 否 → 顯示 Email 輸入框

Step 1（Email 輸入）
  → POST /api/auth/request-otp { email }
    - IP Rate Limit（3 分鐘 5 次）
    - 超限 → blockIp + 寄封鎖警示信給管理員（含解封/加白名單按鈕）
    - 白名單確認 → 寄 OTP → set otp_challenge cookie（JWT, 5min）

Step 2（驗證碼輸入）
  ├─ Email OTP → POST /api/auth/verify-otp { email, otp }
  └─ TOTP 備援 → POST /api/auth/verify-totp { email, code }
       （僅管理員可用，需先在管理後台設定）

驗證成功 → set session cookie（JWT, 8h）→ 顯示「記住裝置？」Modal
  ├─ 記住 → POST /api/auth/remember-device → set remembered_device cookie（30 天）
  └─ 不要 → 直接跳首頁
```

### Redis Key 規劃
| Key | 內容 |
|-----|------|
| `whitelist:emails` | sorted set，score=addedAt，member=email |
| `blocklist:ips` | sorted set，score=blockedAt，member=ip |
| `ratelimit:otp:{ip}` | INCR counter，TTL 180 秒 |
| `device:{token}` | string，value=email，TTL 30 天 |
| `totp:secret:{email}` | string，value=base32 secret，永久 |

---

## 🔄 變更歷史（近 10 筆）

| Commit | 訊息 | 日期 |
|--------|------|------|
| `dba61ad` | fix: force-dynamic on gdrive-health（修好回傳建置快照的假健檢）| 2026-08-07 |
| `1bc590d` | perf: 重開 auto-stop + 降 256MB（證實 502 死結真因是 IPv6）| 2026-08-06 |
| `6623b11` | docs: Fly 手冊補上實測結果與 5 個坑 | 2026-08-06 |
| `9f80db5` | fix: 讓 Fly 部署跑起來（npm 11 / 編譯工具鏈 / IPv6 綁定 / 常駐）| 2026-08-06 |
| `b145562` | chore: Fly app 改名 tdoc-fileflow | 2026-08-06 |
| `d7fb5ce` | docs: 修正 flyctl 安裝指令（Windows PowerShell 5.1 無 pwsh）| 2026-08-06 |
| `49ad71c` | chore: 備援平台從 Koyeb 改為 Fly.io | 2026-08-06 |
| `ca0e859` | feat: i18n zh-TW/en (#20) — next-intl 4.12, locale switcher, 全元件翻譯 |
| `797754a` | feat: Lottie empty state animation (#8) |
| `b0f9e68` | feat: PWA + Service Worker (#17 #18) |
| `508e231` | feat: UX v2.0 (17 items) + mobile RWD complete overhaul | 2026-05-28 |
| `3ee0d5f` | feat: switch email provider from Resend to Brevo | 2026-05-24 |
| `9d61a23` | docs: add 12 engineering discipline rules to CLAUDE.md | 2026-05-24 |
| `d7fde25` | feat: IP block email alert + TOTP emergency login backup | 2026-05-24 |
| `737de9c` | feat: remember device for 30 days, skip email input on return visit | 2026-05-24 |
| `00f24d4` | fix: switch to ioredis to support REDIS_URL from Vercel Redis integration | 2026-05-24 |
| `f8457eb` | fix: parse REDIS_URL as fallback when KV REST vars not found | 2026-05-24 |
| `443c1f1` | Add OTP rate limit and permanent IP blocklist with admin unblock UI | 2026-05-24 |
| `6c32afa` | Update CLAUDE.md after whitelist feature shipped | 2026-05-24 |
| `46c80bc` | Add email whitelist admin with KV-backed CRUD and per-email OTP | 2026-05-24 |
| `477b02a` | Add CLAUDE.md handover doc for AI session continuity | 2026-05-24 |
| `ac9ee72` | Auto-submit OTP on 6 digits; clear input on error | 2026-05-24 |
| `705071d` | Add magic-link OTP login gate via Resend email | 2026-05-24 |

---

## 📞 接手時建議的第一句話

> 「我已讀完 CLAUDE.md。主站已遷移到 Fly.io（`tdoc-fileflow.fly.dev`），行內實測可達且能登入，Drive 認證也驗證通過（`dba61ad`）。
> 目前有三件待辦：① 10 個 commit 還沒 push ② 行內 Drive 上傳尚未實測 ③ refresh token 存活天數要開始量測。
> 請問要先處理哪一項？」

---

*最後更新：2026-08-07*
*更新者：Claude Opus 5（session 5 — Vercel → Fly.io 遷移）*
*本次 session 摘要：因 F-ISAC 封鎖 `vercel.app`，將主站遷移至 Fly.io。踩過並修好 6 個坑（見「Fly.io 六個實戰坑」），行內實測站台可達、可登入，Drive 認證驗證通過。Koyeb 方案已廢棄並移除。*
