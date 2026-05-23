# CLAUDE.md — FileUploader 專案交接文件

> ⚠️ **此檔專供 Claude AI 接手新 session 時快速進入狀況使用**
> 每次重大進度後請更新「📈 已完成」「🚧 待辦」「🔄 變更歷史」三個區塊。

---

## 🎯 一句話總覽

彰化商業銀行**單人使用**的檔案傳輸平台（FileUploader），Next.js + Vercel，已實作 Email OTP 登入，**正在做 Email 白名單管理（設計已定，未實作）**。

---

## ⏭️ 接手後第一件事

1. 讀完本檔（~3 分鐘）
2. 看「🚧 待辦」確認目前要做什麼
3. 看「👤 使用者偏好」**務必遵守**（特別是「不寫文件、極簡 token」）
4. 直接動工或先問使用者確認

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
- **部署**：Vercel（已配 `vercel.json`，曾配 Netlify 但已淘汰）
- **儲存**：Google Drive（既有）、GitHub Releases、Vercel KV（新增，做白名單用）

### 套件（重點）
```
next            14.2.5
react           18
tailwindcss     3
googleapis      (gdrive 上傳用)
react-dropzone  (拖拉上傳)
resend          (寄 OTP 信)
jose            (JWT 簽發/驗證)
@vercel/kv      (將要加 — 白名單用)
```

---

## 🔐 環境變數（Vercel + 本機 .env.local）

| Var | 值（本檔不存 secret）| Sensitive | 用途 |
|-----|--------------------|-----------|------|
| `RESEND_API_KEY` | `re_...` ⮕ **見本機 `.env.local`** | ✅ | Resend 寄信 |
| `OTP_RECIPIENT` | `alan0109@mail2000.com.tw` | ❌ | 系統管理員 email（自動加入白名單）|
| `AUTH_SECRET` | 96 字元 hex ⮕ **見本機 `.env.local`** | ✅ | JWT 簽章金鑰 |
| `KV_*` 系列 | Vercel KV 整合自動注入（KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN / KV_REST_API_READ_ONLY_TOKEN）| auto | Upstash Redis 連線（白名單）|
| Google OAuth | 既有，未變動 | - | gdrive 上傳 |

> 💡 **真實 secret 從不寫入本檔**（本檔會 commit 到 public repo）。本機 `.env.local` 已被 `.gitignore` 忽略，可放 secret。Vercel 端**三個環境**（Production/Preview/Development）都需設定。
> 若 Claude 需要 secret 值，請從本機 `.env.local` 讀取（已存在）。

---

## 🗂 檔案地圖（重點）

```
fileuploader/
├── CLAUDE.md                          ← 本檔
├── src/
│   ├── app/
│   │   ├── page.tsx                   主站（已加 RWD、改背景、改 footer 文案）
│   │   ├── globals.css                樣式（背景已淡化、saturate 已降）
│   │   ├── layout.tsx                 root
│   │   ├── login/page.tsx             🆕 登入頁（OTP 自動驗證）
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── request-otp/route.ts   🆕 產 OTP + Resend 寄信
│   │       │   ├── verify-otp/route.ts    🆕 驗 OTP + 簽 session
│   │       │   └── logout/route.ts        🆕 清 cookie
│   │       └── upload/                既有（gdrive/github/gcs）
│   ├── middleware.ts                  🆕 守門（除 /login 與 /api/auth/* 外都需登入）
│   ├── lib/
│   │   ├── auth.ts                    🆕 JWT + OTP hash + 產碼 helper
│   │   ├── gdriveResumable.ts         既有
│   │   ├── utils.ts                   既有
│   │   ├── types.ts                   既有
│   │   └── providers/                 既有
│   └── components/upload/             既有（已修 ProviderSelector 文字色）
├── .env.local                         本機環境變數（git-ignored）
└── package.json
```

---

## 📈 已完成的工作（依時序）

| Commit | 內容 |
|--------|------|
| `667b7a1` | **RWD** — 行動版直向堆疊、header 縮減、icon-only tabs；背景由深 navy 改為中度 slate-blue |
| `3531a70` | **去藍飽和** — slate 中性化、saturate 180%→125%、ProviderSelector / nav tab 藍字改白 |
| `98e9ec3` | Footer 文案改為「FileUploader Designed By CHB IT Department 176752 © 2026 · Next.js + Vercel」|
| `705071d` | **Magic-link OTP 登入系統** — `/login` 頁、3 個 auth API、middleware 守門、JWT cookie 8h、Resend 寄信、無狀態 OTP (challenge cookie 5 分鐘 TTL) |
| `ac9ee72` | OTP 輸入到第 6 位自動驗證；錯誤自動清空輸入框 |

---

## 🚧 待辦（目前進度）

### 🔴 進行中：Email 白名單管理

**規格已確認**（使用者選定）：
- 設計 **A：卡片列表**（沿用 Liquid Glass 風格）
- 路徑 `/admin`
- 操作：新增 + 刪除（**無編輯**，要改＝刪除後重加）
- 系統管理員（`OTP_RECIPIENT`）**自動納入**白名單、**不可刪除**、有徽章標示
- 上限 100 筆
- 排序：管理員置頂，其他依加入時間（新→舊）
- 刪除前彈確認框
- 主站 Header 加「⚙ 白名單」入口（**僅管理員看得到**）

**KV 狀態**：✅ 使用者已建好 Vercel KV（Upstash Redis 30 MB 免費版，Region: Tokyo，HA: None），已連結到 `fileuploader` 專案，三個環境都打勾。Custom Prefix 留空。

**接下來要做的檔案/異動**：
1. 新 `src/lib/whitelist.ts` — KV 讀寫 helper（list/add/remove/has）
2. 新 `src/app/api/admin/whitelist/route.ts` — GET/POST/DELETE
3. 新 `src/app/admin/page.tsx` — UI（卡片列表）
4. 改 `src/lib/auth.ts` — session 加 email 欄位、加 `isAdmin()` helper
5. 改 `src/app/api/auth/request-otp/route.ts` — 收 `email` 參數、查白名單、寄到該 email
6. 改 `src/app/api/auth/verify-otp/route.ts` — 綁定 email 比對
7. 改 `src/middleware.ts` — 保護 `/admin`，只允許管理員
8. 改 `src/app/login/page.tsx` — 加 email 輸入欄
9. 改 `src/app/page.tsx` — 加「⚙ 白名單」入口（僅管理員）

**預估**：~8,500 tokens（上限 ~10,500）

**未確認事項**（動工前再問使用者）：
- KV 環境變數是否要使用者貼，還是用 `vercel env pull`？
- 是否需要「最後登入時間」「登入次數」紀錄？（目前規格沒有，但白名單已存儲，加上很容易）

### 🟡 已知但暫不處理
- Rate limit（防 OTP 寄信被濫用）
- 登出 UI（API `/api/auth/logout` 已就緒，主站沒按鈕）
- Resend 寄件人改為自有網域（目前用 `onboarding@resend.dev`）
- 自動稽核 log（每次登入/上傳/下載）

---

## 👤 使用者偏好（極重要，違反會被打槍）

### 語言
- **繁體中文（台灣風格）**：「軟體」非「软件」、「網路」非「网络」
- 專業術語保留英文（SQL Injection、XSS、IIS、OWASP）

### Token 使用
- **極簡優先**：使用者多次強調「最少 token」、「不要產出文件」
- 不要重複解釋已說過的東西
- 不要產出 CLAUDE.md（user 全域）規範的 11 份必要文件 — **使用者明確說過不要文件**
- 預估 token 時要**誠實+具體**，不要灌水也不要低估

### 風格
- **直接、結論先行**：先給答案，再展開細節
- **主動提出反對意見**（規則 1）：使用者多次拋出資安/設計上有問題的方案，應該直接點出問題並建議替代方案，而不是順著做
- 提供選項時用**表格**+ 推薦標記，不要長篇大論
- 重要警告用 ⚠️ 標示

### 工作模式
- 改完**立刻 commit + push**（Vercel 自動部署）
- Commit message：**簡短英文 imperative**（如 `Add X feature`、`Fix Y bug`），對齊現有風格
- 不寫單元測試（使用者沒要求）
- 不做使用者沒要求的事（不順手重構、不順手「改善」）

### 已知雷區
- 使用者曾提：「固定密碼 CHB 加密」、「TOTP 加密檔案」、「帳號=密碼=工號 176752」— **這些都不安全，已被否決，不要再順著做**
- 最終確定的方案：**Email OTP magic-link 登入**（已實作）+ **白名單管理**（待實作）

---

## ⚙️ 工作慣例與環境

### Git
- 主分支：`main`
- 推到 origin/main 後 Vercel **自動部署**
- 已知警告（**不必處理**）：`LF will be replaced by CRLF` — Windows 環境正常
- Commit 風格參考最近的：
  ```
  Add mobile RWD layout and lighten background tone
  Update footer credit to CHB IT Department
  Add magic-link OTP login gate via Resend email
  ```

### Build
- 指令：`npm run build`
- **已知預期錯誤**（**不必修**）：
  ```
  [gdrive-token] Error: No refresh token or refresh handler callback is set.
  ```
  原因：本機沒有 Google OAuth refresh token；Vercel 上有完整 env，不會發生。

### 部署
- Vercel 自動：push 到 main 即觸發
- 環境變數修改後，**現有 deployment 大部分情況會即時讀取**（serverless function 重啟即生效）；若沒生效，到 Vercel Dashboard → Deployments → ⋯ → **Redeploy**

### 本機開發
```powershell
cd C:\Users\Alan\Projects\fileuploader
npm run dev      # http://localhost:3000
npm run build    # 驗證
```

---

## 🎨 設計決策歷史

### 配色（globals.css）
- **底色**：`#141b2d-#1e2a4a`（深 navy） → `#2a3552-#3d4a78`（中度 slate） → `#232733-#313749`（中性 slate，**現行**）
- **背景光暈 opacity**：5 個 radial gradient 全砍半（避免藍主宰）
- **`backdrop-filter: saturate`**：180% → **125%**；200% → 135%；避免毛玻璃放大背景色
- **參考風格**：Apple macOS Sequoia / Linear / Notion 的中性 dark mode

### RWD（page.tsx）
- Body：`flex` → `flex-col lg:flex-row`
- Sidebar：`w-[280px]` → `w-full lg:w-[280px]`
- Sidebar sticky：只在 `lg:` 以上啟用
- Logo 文字：手機顯示「CHB 檔案傳輸」，桌機「CHB 外部檔案傳輸平台」
- Nav tabs：手機 icon-only，桌機 icon+文字
- Padding：`px-6` → `px-3 sm:px-6 lg:px-10`

### 文字對比修正（ProviderSelector）
- active 時 `color: p.iosColor`（藍字）→ 改 `var(--text-primary)`（白字）— 避免藍字寫在藍底
- Header nav active tab：`text-tech-blue` → `text-primary` 同理

---

## 🔐 認證系統設計（已實作）

```
未登入 → middleware 攔截 → 跳 /login
  ↓
/login 頁
  ├─ Step 1: 點「寄送驗證碼」
  │   ↓ POST /api/auth/request-otp
  │   - 產 6 位數 OTP
  │   - Resend 寄到 OTP_RECIPIENT (環境變數，目前固定為 alan0109@mail2000.com.tw)
  │   - 設 httpOnly cookie `otp_challenge`（JWT 簽，內含 OTP hash，TTL 5min）
  ├─ Step 2: 輸入 6 位數（達 6 位自動驗證）
  │   ↓ POST /api/auth/verify-otp { otp }
  │   - 讀 cookie，hash 比對
  │   - 通過 → 設 httpOnly cookie `session`（JWT，TTL 8h）
  │   - 失敗 → 清空 input，顯示錯誤
  ↓
登入成功 → /
```

### 安全性
- OTP：6 位數，SHA-256 hash 保存
- OTP 儲存：**無狀態**（JWT challenge cookie）— 不用 DB
- Session：JWT (jose, HS256), 8h TTL
- Cookie：`HttpOnly + Secure(prod) + SameSite=Lax`
- 中介層：除 `/login` 與 `/api/auth/*` 外**全擋**
- 未登入呼 API：回 **401 JSON**（非 302）

### 改成「使用者輸入 email」後（待實作）
- 登入頁加 email 輸入欄
- request-otp 收 `{ email }`，先查白名單，命中才寄
- challenge cookie 加入 `email`，verify-otp 比對 email 一致
- session 改帶 `email`（取代 `u: 'admin'`），用於 admin 權限判斷

---

## 💡 給 Claude 的接手提示

### 此使用者「會這樣做」
- ✅ 一個需求拋出來會先**徵詢評估**，再決定動工
- ✅ 通常會說「請先評估，不要動工」或「請評估 token 成本」
- ✅ 喜歡看 UI 設計**預覽 / mockup**（可用 `AskUserQuestion` 的 `preview` 欄位提供）
- ✅ 改完後常追問「Vercel 環境變數要設嗎」「Sensitive 要開嗎」這類部署細節

### 此使用者「不會這樣做」
- ❌ 不寫單元測試
- ❌ 不要 11 份必要文件（雖然全域 CLAUDE.md 寫了，但**本專案明確說不要**）
- ❌ 不接受「文件太長」的回應（會被嫌浪費 token）

### 你（Claude）「應該這樣做」
- 動工前先報 token 估算
- 改完立刻 commit + push（不必問）
- 對話結尾**給選項**讓使用者選下一步
- 若使用者拋出**不安全**的方案，**先反對再給替代**（規則 1+7）

### 你「不要這樣做」
- ❌ 不要過度解釋
- ❌ 不要主動寫文件（除非使用者明確要求）
- ❌ 不要建議「我們再多加 XX 功能吧」這種使用者沒問的事
- ❌ 不要假裝完成 — build 失敗就說失敗（規則 12）

---

## 🔄 變更歷史（近 10 筆）

| Commit | 訊息 | 日期（近似）|
|--------|------|------------|
| `ac9ee72` | Auto-submit OTP on 6 digits; clear input on error | 2026-05-24 |
| `705071d` | Add magic-link OTP login gate via Resend email | 2026-05-24 |
| `98e9ec3` | Update footer credit to CHB IT Department | 2026-05-24 |
| `3531a70` | Tone down blue saturation and fix blue-on-blue text contrast | 2026-05-24 |
| `667b7a1` | Add mobile RWD layout and lighten background tone | 2026-05-24 |
| `f43bef5` | Record Netlify deployment verification（**舊**，已改 Vercel）|  |
| `ef6ca7c` | Add Next.js security headers | |
| `9a0697a` | Enable Netlify Next.js adapter（舊）| |
| `e9f982d` | Set Netlify Next.js publish directory（舊）| |
| `28b1f9c` | Add Netlify deployment config（舊）| |

---

## 📞 接手時建議的第一句話

> 「我已讀完 CLAUDE.md，目前進度是 [Email 白名單管理 — 設計已選 A 卡片列表、KV 已建好、待寫程式]。確認要繼續這個方向嗎？還是有新需求？」

---

*最後更新：2026-05-24*
*更新者：Claude (Sonnet 4.5)*
