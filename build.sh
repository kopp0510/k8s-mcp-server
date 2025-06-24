#!/bin/bash

# K8s MCP Server Docker Build Script
# Usage: ./build.sh [tag]

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Kubernetes MCP Server Docker Build${NC}"

# Get version tag
TAG=${1:-latest}
IMAGE_NAME="k8s-mcp-server"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Docker daemon is not running!${NC}"
    echo -e "${YELLOW}Please start Docker Desktop or Docker daemon first${NC}"
    exit 1
fi

echo -e "${YELLOW}Build Information:${NC}"
echo "   Image Name: ${FULL_IMAGE}"
echo "   Architecture: $(uname -m)"
echo "   Date: $(date)"
echo ""

# Build Docker image
echo -e "${YELLOW}Starting Docker image build...${NC}"
docker build \
  --tag "${FULL_IMAGE}" \
  --label "build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --label "build.version=${TAG}" \
  .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker image build successful!${NC}"
    echo ""
    echo -e "${YELLOW}Image Information:${NC}"
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    echo -e "${YELLOW}Run Commands:${NC}"
    echo "   Start container: docker run -p 3000:3000 --name mcp-server ${FULL_IMAGE}"
    echo "   View logs: docker logs mcp-server"
    echo "   Stop container: docker stop mcp-server && docker rm mcp-server"
    echo ""
    echo -e "${YELLOW}n8n Connection URLs:${NC}"
    echo "   SSE endpoint: http://localhost:3000/sse"
    echo "   Health check: http://localhost:3000/health"
else
    echo -e "${RED}Docker image build failed!${NC}"
    exit 1
fi