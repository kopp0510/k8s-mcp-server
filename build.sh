#!/bin/bash

# K8s MCP Server Docker Build Script
# 使用方法: ./build.sh [tag]

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Kubernetes MCP Server Docker Build${NC}"

# 取得版本標籤
TAG=${1:-latest}
IMAGE_NAME="k8s-mcp-server"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"

# 檢查 Docker 是否運行
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Docker daemon 沒有運行！${NC}"
    echo -e "${YELLOW}請先啟動 Docker Desktop 或 Docker daemon${NC}"
    exit 1
fi

echo -e "${YELLOW}建構資訊:${NC}"
echo "   Image Name: ${FULL_IMAGE}"
echo "   Architecture: $(uname -m)"
echo "   Date: $(date)"
echo ""

# 建構 Docker image
echo -e "${YELLOW}開始建構 Docker image...${NC}"
docker build \
  --tag "${FULL_IMAGE}" \
  --label "build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --label "build.version=${TAG}" \
  .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker image 建構成功！${NC}"
    echo ""
    echo -e "${YELLOW}Image 資訊:${NC}"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    echo -e "${YELLOW}執行指令:${NC}"
    echo "   啟動容器: docker run -p 3000:3000 --name mcp-server ${FULL_IMAGE}"
    echo "   查看日誌: docker logs mcp-server"
    echo "   停止容器: docker stop mcp-server && docker rm mcp-server"
    echo ""
    echo -e "${YELLOW}n8n 連接 URL:${NC}"
    echo "   SSE 端點: http://localhost:3000/sse"
    echo "   健康檢查: http://localhost:3000/health"
else
    echo -e "${RED}Docker image 建構失敗！${NC}"
    exit 1
fi