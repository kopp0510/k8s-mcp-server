# 使用官方 Node.js 18 Alpine 映像
FROM node:18-alpine

# 設定標籤
LABEL maintainer="danlio"
LABEL description="Kubernetes MCP Server with SSE support for n8n"
LABEL version="1.0.0"
LABEL project="k8s-mcp-server"

# 安裝必要工具：kubectl 和 curl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/ && \
    # 驗證安裝
    kubectl version --client && \
    apk del curl

# 建立非 root 使用者
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 建立應用目錄
WORKDIR /app

# 複製 package 檔案並安裝依賴
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 複製應用程式碼
COPY src/ ./src/

# 設定權限
RUN chown -R nodejs:nodejs /app

# 切換到非 root 使用者
USER nodejs

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# 預設端口
EXPOSE 3000

# 啟動指令 (SSE 模式)
CMD ["node", "src/index.js", "--http", "--port", "3000"]