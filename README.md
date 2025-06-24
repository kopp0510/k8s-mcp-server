# Kubernetes & Helm MCP Server

A simple, reliable MCP (Model Context Protocol) Server designed for Kubernetes and Helm environment management, with n8n integration support.

## Features

- **Native n8n Support** - Perfect support for n8n MCP Client nodes
- **SSE Connection** - Uses Server-Sent Events for real-time bidirectional communication
- **Kubernetes Integration** - Provides complete kubectl tool access
- **Helm Support** - Provides Helm chart and release management functionality
- **Modular Architecture** - Clear separation between entry point and server implementation

## File Structure

```
k8s-mcp-server/
├── src/                           # Source code directory
│   ├── index.js                   # Main program entry, handles lifecycle and parameter parsing
│   ├── server.js                  # MCP + Express integration, server implementation
│   ├── tools/                     # Tool modules
│   │   ├── base-tool.js           # Base tool class
│   │   ├── kubectl-get.js         # Resource query tool (supports label filtering)
│   │   ├── kubectl-logs.js        # Pod log viewing tool
│   │   ├── kubectl-describe.js    # Resource detailed description tool
│   │   ├── kubectl-cluster-info.js # Cluster information query tool
│   │   ├── kubectl-get-yaml.js    # Resource YAML format output tool
│   │   ├── kubectl-top-nodes.js   # Node resource usage monitoring
│   │   ├── kubectl-top-pods.js    # Pod resource usage monitoring
│   │   ├── kubectl-top-containers.js # Container resource usage monitoring
│   │   ├── kubectl-scale-deployment.js # Deployment scaling tool
│   │   ├── kubectl-restart-deployment.js # Deployment restart tool
│   │   ├── kubectl-edit-hpa.js    # HPA editing tool
│   │   ├── helm-list.js           # Helm release list tool
│   │   ├── helm-status.js         # Helm release status tool
│   │   ├── helm-repo-list.js      # Helm repository list tool
│   │   ├── helm-get-values.js     # Helm release configuration values tool
│   │   └── helm-history.js        # Helm release history tool
│   └── utils/                     # Utility functions
│       ├── logger.js              # Logging system
│       ├── validator.js           # Input validation (including label validation)
│       ├── kubectl.js             # kubectl execution tool
│       └── helm.js                # helm execution tool
├── package.json                   # Project configuration and dependencies
├── package-lock.json              # Dependency lock file
├── Dockerfile                     # Docker container build file
├── build.sh                       # Docker build script
├── .gitignore                     # Git ignore file configuration
├── .cursorignore                  # Cursor editor ignore file configuration
└── README.md                      # Project documentation
```

### Architecture Description

- **`src/index.js`** - Main program entry, responsible for:
  - Command line parameter parsing
  - Environment variable configuration
  - Lifecycle management
  - Graceful shutdown handling
  - Error handling

- **`src/server.js`** - Server implementation, responsible for:
  - MCP Server configuration and tool registration
  - Express application creation (SSE mode)
  - MCP message processing
  - SSE connection management

## Quick Start

### Local Development

1. **Install Dependencies**
```bash
npm install
```

2. **Start SSE Mode (for n8n)**
```bash
npm run start:http
# Or specify port
npm run start:http -- --port 3001
```

3. **Check Service Status**
```bash
curl http://localhost:3001/health
```

### Docker Deployment

#### 1. Build Image

```bash
docker build -t k8s-mcp-server .
```

#### 2. Start Container (requires kubeconfig mounting)

**⚠️ Important:** When starting the container, you need to mount the local `.kube/config` to the container's `/home/nodejs/.kube/config` path so that the MCP Server can access the Kubernetes cluster.

```bash
# Use local kubeconfig
docker run -p 3001:3000 \
  -v ~/.kube/config:/home/nodejs/.kube/config:ro \
  k8s-mcp-server
```

#### 3. Custom kubeconfig Path

```bash
# Use custom kubeconfig file
docker run -p 3001:3000 \
  -v /path/to/your/kubeconfig:/home/nodejs/.kube/config:ro \
  k8s-mcp-server
```

#### 4. Use Service Account Token (Kubernetes Internal Deployment)

```bash
# When deploying inside a Kubernetes cluster, you can use service account
docker run -p 3001:3000 \
  -v /var/run/secrets/kubernetes.io/serviceaccount:/var/run/secrets/kubernetes.io/serviceaccount:ro \
  -e KUBERNETES_SERVICE_HOST \
  -e KUBERNETES_SERVICE_PORT \
  k8s-mcp-server
```

#### 5. Verify Connection

After the container starts, you can check the Kubernetes connection status:

```bash
# Check service status
curl http://localhost:3001/health

# Test Kubernetes connection
curl -X POST http://localhost:3001/messages \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "kubectl_get",
      "arguments": {"resource": "nodes"}
    }
  }'
```

#### 6. Important Notes

**Permission Requirements:**
- Ensure the kubeconfig file has appropriate Kubernetes cluster access permissions
- It's recommended to use read-only service accounts for improved security
- The container runs as the `nodejs` user, ensure mounted files have appropriate read permissions

**Troubleshooting:**
```bash
# Check kubeconfig file permissions
ls -la ~/.kube/config

# Verify kubeconfig validity
kubectl --kubeconfig ~/.kube/config get nodes

# Check kubeconfig inside container
docker exec -it <container-id> cat /home/nodejs/.kube/config
```

**Docker Compose Example:**
```yaml
version: '3.8'
services:
  k8s-mcp-server:
    build: .
    ports:
      - "3001:3000"
    volumes:
      - ~/.kube/config:/home/nodejs/.kube/config:ro
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

## Using with n8n

### Step 1: Start MCP Server

Ensure the MCP Server is running in SSE mode:

```bash
cd k8s-mcp/k8s-mcp-server
npm run start:http -- --port 3001
```

After the server starts, you will see:

```
MCP Server started at http://localhost:3001
SSE endpoint: http://localhost:3001/sse (n8n connects here)
Message endpoint: http://localhost:3001/messages
Health check: http://localhost:3001/health
SSE mode - designed for n8n
```