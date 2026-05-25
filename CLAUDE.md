# CLAUDE.md — FileUploader 專案交接文件

> ⚠️ **此檔專供 Claude AI 接手新 session 時快速進入狀況使用**
> 每次重大進度後請更新「📈 已完成」「🚧 待辦」「🔄 變更歷史」三個區塊。

---

## 🎯 一句話總覽

彰化商業銀行檔案傳輸平台（FileUploader），Next.js + Vercel，**已實作**：Email OTP 登入 + 白名單管理 + IP Rate Limit／封鎖 + 記住裝置（30天）+ IP 封鎖警示信 + TOTP 備援登入 + Brevo 寄信（任意收件人）。**目前無進行中需求**。

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
| 部署 URL | https://chb-fileuploader.vercel.app |
| 平台 | Vercel（自動部署 main 分支）|
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

### ✅ 無進行中需求

最後完成：換用 Brevo 寄信，解決 Resend 無法寄給非帳號本人的限制（`3ee0d5f`）。等使用者下新需求。

### 🟡 已知但暫不處理（等使用者要求才動）
- **稽核 Log**（每次登入/上傳/下載寫入 Redis 或 file）
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

> 記憶儲存在 mem0 雲端（`user_id: chb-fileuploader`），跨 session 永久保留。
> Scripts 位於 `scripts/mem0-*.mjs`，需要 `.env.local` 中的 `MEM0_API_KEY`。
> **何時該存記憶**：換了套件、改了架構決策、踩過坑、使用者明確的偏好。

---

## ⚙️ 工作慣例與環境

### Build
- `npm run build`
- **預期錯誤（不必修）**：`[gdrive-token] Error: No refresh token` — 本機無 Google OAuth token，Vercel 上正常

### 部署
- push 到 main → Vercel 自動部署
- env var 改後通常即時生效；若沒生效 → Vercel Dashboard → Deployments → Redeploy

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

> 「我已讀完 CLAUDE.md，目前無進行中需求。最後完成的是換用 Brevo 寄信（`3ee0d5f`）。請問有什麼新需求？」

---

*最後更新：2026-05-24*
*更新者：Claude Opus 4.7 (session 2)*
