# 第一阶段：构建静态文件
FROM node:18-alpine AS builder

WORKDIR /app

# 设置 Node.js 内存限制（避免构建时 OOM）
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY . .
RUN npm run build || (echo "Build failed!" && exit 1)

# 第二阶段：使用 Python 提供静态文件（轻量且简单）
FROM python:3.11-alpine

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/out ./out

EXPOSE 8000

# 使用 Python http.server（Python 3.11 使用 -b 参数）
CMD sh -c "cd /app/out && python -m http.server ${PORT:-8000} -b 0.0.0.0"
