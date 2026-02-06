# 单阶段构建：构建并提供静态文件
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 安装 serve 用于提供静态文件
RUN npm install -g serve

# 复制源代码
COPY . .

# 构建静态文件
RUN npm run build

# 暴露端口
EXPOSE 8000

# 使用 serve 提供静态文件
# 使用 shell form 确保 PORT 环境变量正确展开
CMD sh -c "serve -s out -l ${PORT:-8000}"
