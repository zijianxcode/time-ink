# 第一阶段：构建静态文件
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 第二阶段：使用 Python 提供静态文件（轻量且简单）
FROM python:3.11-alpine

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/out ./out

EXPOSE 8000

# 使用 Python http.server
CMD sh -c "cd /app/out && python -m http.server ${PORT:-8000} --bind 0.0.0.0"
