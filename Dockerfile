# 第一阶段：构建 Next.js 静态文件
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建静态文件
RUN npm run build

# 第二阶段：使用轻量级服务器提供静态文件
FROM python:3.11-alpine

WORKDIR /app

# 从构建阶段复制静态文件
COPY --from=builder /app/out ./out

# 暴露端口
EXPOSE 8000

# 使用 Python http.server 提供静态文件
# 使用 shell form 确保 PORT 环境变量正确展开
CMD sh -c "cd /app/out && python -m http.server ${PORT:-8000}"
