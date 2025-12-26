# ============================================
# 優化版 Dockerfile - Multi-stage Build
# 目標：從 ~2GB 減少到 ~400MB
# ============================================

# ============================================
# Stage 1: 工具下載階段
# ============================================
FROM alpine:3.21 AS tools-builder

ARG TARGETARCH

# 安裝下載工具和 Python（gcloud SDK 需要）
RUN apk add --no-cache curl tar gzip python3

# 設定架構變數並儲存
RUN ARCH=$(case ${TARGETARCH:-amd64} in \
        amd64) echo "amd64" ;; \
        arm64) echo "arm64" ;; \
        *) echo "amd64" ;; \
    esac) && \
    GCLOUD_ARCH=$(case ${TARGETARCH:-amd64} in \
        amd64) echo "x86_64" ;; \
        arm64) echo "arm" ;; \
        *) echo "x86_64" ;; \
    esac) && \
    echo "ARCH=${ARCH}" > /tmp/arch.env && \
    echo "GCLOUD_ARCH=${GCLOUD_ARCH}" >> /tmp/arch.env

# 下載 kubectl
RUN . /tmp/arch.env && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${ARCH}/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# 下載 helm
RUN . /tmp/arch.env && \
    HELM_VERSION=$(curl -s https://api.github.com/repos/helm/helm/releases/latest | grep tag_name | cut -d '"' -f 4) && \
    curl -fsSL -o helm.tar.gz "https://get.helm.sh/helm-${HELM_VERSION}-linux-${ARCH}.tar.gz" && \
    tar -xzf helm.tar.gz && \
    mv linux-${ARCH}/helm /usr/local/bin/helm && \
    rm -rf helm.tar.gz linux-${ARCH}

# 下載並精簡 gcloud SDK（只保留 gke-gcloud-auth-plugin 所需的檔案）
RUN . /tmp/arch.env && \
    curl -O "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.1-linux-${GCLOUD_ARCH}.tar.gz" && \
    tar -xf google-cloud-cli-458.0.1-linux-${GCLOUD_ARCH}.tar.gz && \
    ./google-cloud-sdk/install.sh --quiet --path-update=false && \
    ./google-cloud-sdk/bin/gcloud components install gke-gcloud-auth-plugin --quiet && \
    # 清理不需要的大型元件
    rm -rf google-cloud-sdk/.install \
           google-cloud-sdk/platform/bundledpythonunix \
           google-cloud-sdk/lib/googlecloudsdk/generated_clients \
           google-cloud-sdk/lib/third_party/grpc \
           google-cloud-sdk/data/cli/*.json \
           google-cloud-sdk/lib/surface \
           google-cloud-sdk/bin/anthoscli \
           google-cloud-sdk/bin/bq \
           google-cloud-sdk/bin/gsutil \
           google-cloud-sdk/lib/third_party/apis \
           google-cloud-sdk/lib/third_party/dulwich \
           google-cloud-sdk/lib/third_party/fancy_urllib \
           google-cloud-sdk/lib/third_party/httplib2 \
           google-cloud-sdk/platform/gsutil \
           google-cloud-sdk/platform/bq && \
    rm -rf google-cloud-cli-*.tar.gz && \
    # 移動精簡後的 SDK
    mv google-cloud-sdk /opt/google-cloud-sdk

# ============================================
# Stage 2: Node.js 依賴建構階段
# ============================================
FROM node:18-alpine AS node-builder

WORKDIR /app

# 複製 package files 並安裝依賴
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ============================================
# Stage 3: 最終階段（精簡版）
# ============================================
FROM node:18-alpine

# 設定標籤
LABEL maintainer="danlio"
LABEL description="Kubernetes MCP Server with SSE support for n8n (Optimized)"
LABEL version="2.0.0"
LABEL project="k8s-mcp-server"

# 安裝最小必要的執行時依賴
# python3 是 gke-gcloud-auth-plugin 的依賴
RUN apk add --no-cache curl bash python3 libstdc++

# 從 tools-builder 複製工具
COPY --from=tools-builder /usr/local/bin/kubectl /usr/local/bin/
COPY --from=tools-builder /usr/local/bin/helm /usr/local/bin/
COPY --from=tools-builder /opt/google-cloud-sdk /opt/google-cloud-sdk

# 建立 symlinks
RUN ln -s /opt/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud && \
    ln -s /opt/google-cloud-sdk/bin/gke-gcloud-auth-plugin /usr/local/bin/gke-gcloud-auth-plugin

# 建立非 root 使用者
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 建立應用程式目錄
WORKDIR /app

# 從 node-builder 複製 node_modules
COPY --from=node-builder /app/node_modules ./node_modules

# 複製應用程式程式碼
COPY package*.json ./
COPY src/ ./src/

# 設定權限
RUN chown -R nodejs:nodejs /app

# 切換到非 root 使用者
USER nodejs

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3000
ENV USE_GKE_GCLOUD_AUTH_PLUGIN=True
ENV PATH="/opt/google-cloud-sdk/bin:${PATH}"

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# 預設埠
EXPOSE 3000

# 啟動命令
CMD ["node", "src/index.js", "--http", "--port", "3000"]
