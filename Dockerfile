# FileFlow — Fly.io 部署用 Dockerfile
# 用途：Fly.io 一律用 Dockerfile 建置（無 Buildpack 選項），對應 fly.toml。
# 注意：Vercel 使用 nextjs preset，會忽略此檔，不影響現有部署。

# ---------- 建置階段 ----------
FROM node:20-alpine AS builder
WORKDIR /app

# package-lock.json 是 npm 11 產生的，node:20-alpine 內建 npm 10 會解出不同的相依樹而讓
# npm ci 失敗（Missing: gaxios@7 …）。這裡只對齊 npm 版本，不動 Node 執行環境。
RUN npm install -g npm@11

# mem0ai（只有本機的 scripts/mem0-*.mjs 在用）會帶進原生模組 better-sqlite3，
# alpine 沒有 Python / 編譯器就裝不起來。工具鏈只留在 builder 階段，不進 runner。
RUN apk add --no-cache python3 make g++

# 先只複製套件清單，讓 layer cache 生效（原始碼變動時不用重裝套件）
COPY package.json package-lock.json ./
RUN npm ci

# 複製其餘原始碼並建置
COPY . .

# NEXT_PUBLIC_* 於 next build 時就會被內嵌，必須在建置階段給值（由 fly.toml 的 build.args 傳入）
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# ---------- 執行階段 ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 直接沿用建置階段的完整產物（含 node_modules / .next / public）
# 本專案 next.config.js 未啟用 standalone，故保留完整 node_modules 才能 next start
COPY --from=builder /app ./

# Fly.io 不會注入 PORT，固定監聽 8080，需與 fly.toml 的 internal_port 一致。
# ⚠️ -H :: 不可省略也不能寫成 0.0.0.0：
#    1) 不指定 -H 時，next start 會拿 Fly 注入的 HOSTNAME=<machine-id> 當綁定位址而退回只聽 localhost
#    2) Fly 內部網路（health check、fly-proxy）走 IPv6，綁 0.0.0.0 只有 IPv4，一樣 connection refused
#    綁 :: 讓 Node 以雙棧模式監聽，IPv4／IPv6 都通。
EXPOSE 8080
CMD ["sh", "-c", "npm run start -- -p ${PORT:-8080} -H ::"]
