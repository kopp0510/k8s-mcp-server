# Use official Node.js 18 Alpine image
FROM node:18-alpine

# Set labels
LABEL maintainer="danlio"
LABEL description="Kubernetes MCP Server with SSE support for n8n"
LABEL version="1.0.0"
LABEL project="k8s-mcp-server"

# Install required tools: kubectl, helm, gcloud CLI and curl
RUN apk add --no-cache curl bash python3 py3-pip && \
    # Install kubectl
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/ && \
    # Install helm - download binary directly
    HELM_VERSION=$(curl -s https://api.github.com/repos/helm/helm/releases/latest | grep tag_name | cut -d '"' -f 4) && \
    curl -fsSL -o helm.tar.gz "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" && \
    tar -xzf helm.tar.gz && \
    mv linux-amd64/helm /usr/local/bin/helm && \
    rm -rf helm.tar.gz linux-amd64 && \
    # Install gcloud CLI to /usr/local/google-cloud-sdk
    curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.1-linux-x86_64.tar.gz && \
    tar -xf google-cloud-cli-458.0.1-linux-x86_64.tar.gz && \
    mv google-cloud-sdk /usr/local/google-cloud-sdk && \
    /usr/local/google-cloud-sdk/install.sh --quiet --path-update=false && \
    rm -rf google-cloud-cli-458.0.1-linux-x86_64.tar.gz && \
    # Install GKE auth plugin (required for GKE clusters)
    /usr/local/google-cloud-sdk/bin/gcloud components install gke-gcloud-auth-plugin --quiet && \
    # Create symlink for gcloud and auth plugin to make them globally available
    ln -s /usr/local/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud && \
    ln -s /usr/local/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil && \
    ln -s /usr/local/google-cloud-sdk/bin/gke-gcloud-auth-plugin /usr/local/bin/gke-gcloud-auth-plugin && \
    # Verify installation
    kubectl version --client && \
    helm version --client && \
    gcloud version && \
    gke-gcloud-auth-plugin --version && \
    # Clean up build dependencies but keep python3 for gcloud
    apk del curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create application directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY src/ ./src/

# Set permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV USE_GKE_GCLOUD_AUTH_PLUGIN=True

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Default port
EXPOSE 3000

# Start command (SSE mode)
CMD ["node", "src/index.js", "--http", "--port", "3000"]