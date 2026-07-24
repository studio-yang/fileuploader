# FileFlow — Koyeb 部署備用 Dockerfile
# 用途：當 Koyeb 的 Buildpack 自動偵測失敗時，把 Builder 改成 Dockerfile 即可。
# 注意：Vercel 使用 nextjs preset，會忽略此檔，不影響現有部署。

# ---------- 建置階段 ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 先只複製套件清單，讓 layer cache 生效（原始碼變動時不用重裝套件）
COPY package.json package-lock.json ./
RUN npm ci

# 複製其餘原始碼並建置
COPY . .
RUN npm run build

# ---------- 執行階段 ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 直接沿用建置階段的完整產物（含 node_modules / .next / public）
# 本專案 next.config.js 未啟用 standalone，故保留完整 node_modules 才能 next start
COPY --from=builder /app ./

# Koyeb 會注入 PORT 環境變數（預設 8000）；Next.js 會讀取此變數
EXPOSE 8000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-8000}"]
