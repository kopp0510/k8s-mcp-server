# Kubernetes & Helm MCP Server

A simple, reliable MCP (Model Context Protocol) Server designed for Kubernetes and Helm environment management, with n8n and Dify integration support.

## Features

- **Multi-Platform Support** - Perfect support for n8n and Dify MCP clients
- **Dual Transport Mode** - Supports both SSE and Streamable HTTP transport protocols
- **Kubernetes Integration** - Provides complete kubectl tool access
- **Helm Support** - Provides Helm chart and release management functionality
- **Modular Architecture** - Clear separation between entry point and server implementation
- **Error Handling** - Complete prerequisite checks and error propagation handling
- **Security Protection** - Prevents dangerous operations in unauthenticated states
- **Resource Monitoring** - Complete resource usage monitoring functionality
- **Label Filtering** - Powerful label filtering and search functionality
- **Multi-Resource Support** - Supports 19 different Kubernetes resource types
- **MCP Protocol Compliance** - Fully compliant with MCP 2024-11-05 protocol specification

## Version Information

- **Current Version**: 2.1.4
- **Completion Rate**: 100%
- **Supported Tools**: 17 major tools
- **Error Handling**: Complete refactoring
- **Authentication**: GKE cluster authentication integration
- **Security**: kubectl/helm dangerous operation prevention
- **Dify Compatibility**: Full support for Streamable HTTP transport
- **n8n Compatibility**: Full support for SSE transport

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
  - Prerequisite checks
  - GKE cluster authentication

- **`src/server.js`** - Server implementation, responsible for:
  - MCP Server configuration and tool registration
  - Express application creation (SSE mode)
  - MCP message processing
  - SSE connection management
  - Error propagation handling
  - Security checks

## Installation

### Prerequisites

- Node.js >= 16.0.0
- kubectl >= 1.20.0
- helm >= 3.0.0
- Valid kubeconfig configuration
- (Optional) metrics-server for resource monitoring features

### Local Installation

```bash
# Clone project
git clone https://github.com/your-username/k8s-mcp-server.git

# Enter project directory
cd k8s-mcp-server

# Install dependencies
npm install

# Start server (SSE mode)
npm run start:http

# Or start server (Stdio mode)
npm start
```

### Docker Installation

```bash
# Build image
./build.sh

# Run container (SSE mode)
docker run -d --name k8s-mcp-server \
  -p 3001:3001 \
  -v ~/.kube:/home/nodejs/.kube:ro \
  your-registry/k8s-mcp-server:latest \
  npm run start:http

# Or run container (Stdio mode)
docker run -i --rm \
  -v ~/.kube:/home/nodejs/.kube:ro \
  your-registry/k8s-mcp-server:latest \
  npm start
```

### Kubernetes Deployment

```bash
# Deploy MCP Server
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=k8s-mcp-server

# Check service endpoints
kubectl get svc k8s-mcp-server-service
```

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

## Using with Dify

### Step 1: Start MCP Server

Ensure the MCP Server is running in HTTP mode:

```bash
cd k8s-mcp/k8s-mcp-server
npm run start:http -- --port 3001
```

After the server starts, you will see:

```
MCP Server started at http://localhost:3001
MCP (Streamable HTTP): http://localhost:3001/mcp (Dify compatible)
SSE endpoint: http://localhost:3001/sse (n8n compatible)
Health check: http://localhost:3001/health
Hybrid mode - supports both SSE and Streamable HTTP transport
```

### Step 2: Configure Dify MCP Settings

Add the following to your Dify MCP SERVERS CONFIG:

```json
{
  "k8s-mcp-server": {
    "transport": "streamable_http",
    "url": "http://k8s-all-in-one-kubectl-mcp-tool.n8n:3000/mcp",
    "timeout": 30
  }
}
```

**Important Configuration Notes**:
- **transport**: Must use `"streamable_http"` (recommended)
- **url**: Point to your MCP Server's `/mcp` endpoint
- **timeout**: Recommended 30 seconds

### Step 3: Use in Dify Workflows

1. **Add Agent node to your workflow**
2. **Set MCP RESOURCES AS TOOLS to True**
3. **Set MCP PROMPTS AS TOOLS to True**
4. **Tools will automatically load into the agent**

### Step 4: Usage Examples

**Get Pod List**:
```
Please help me view all Pods in the default namespace
```

**Check Node Resource Usage**:
```
Please show CPU and memory usage for all nodes
```

**Scale Deployment**:
```
Please scale the my-web-app Deployment to 3 replicas
```

## Using with n8n

### Step 1: Start MCP Server

Ensure the MCP Server is running in HTTP mode (supports both SSE and Streamable HTTP):

```bash
cd k8s-mcp/k8s-mcp-server
npm run start:http -- --port 3001
```

After the server starts, you will see:

```
MCP Server started at http://localhost:3001
MCP (Streamable HTTP): http://localhost:3001/mcp (Dify compatible)
SSE endpoint: http://localhost:3001/sse (n8n connects here)
Message endpoint: http://localhost:3001/messages
Health check: http://localhost:3001/health
Hybrid mode - supports both SSE and Streamable HTTP transport
```

## Usage

### 1. Health Check

```bash
# Check server status
curl http://localhost:3001/health
```

### 2. SSE Connection Test

```bash
# Test SSE connection
curl -N http://localhost:3001/sse
```

### 3. n8n Integration

1. Add MCP Client node in n8n
2. Set MCP Server URL:
   ```
   http://localhost:3001/sse
   ```
3. Choose desired Kubernetes or Helm tool
4. Set tool parameters and execute

### 4. Cursor Editor Integration

1. Configure `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "k8s-mcp-server": {
         "command": "node",
         "args": ["/path/to/k8s-mcp-server/src/index.js"]
       }
     }
   }
   ```
2. Restart Cursor editor
3. Use tools in MCP panel

## API Endpoints

| Endpoint | Method | Description | Purpose |
|----------|--------|-------------|---------|
| `/health` | GET | Health check | Service status check |
| `/mcp` | POST/GET | MCP Streamable HTTP endpoint | Dify connection |
| `/sse` | GET | SSE connection endpoint | n8n connection |
| `/messages` | POST | MCP message processing endpoint | SSE mode message processing |
| `/sse-status` | GET | SSE connection status monitoring | Debugging |
| `/tools` | GET | Tool list | Debugging |
| `/info` | GET | Server information | Debugging |

### Transport Mode Description

#### Streamable HTTP Mode (for Dify)
- **Endpoint**: `/mcp`
- **Method**: POST
- **Advantages**: Simple and direct, no session management required
- **Suitable for**: Dify and other MCP clients that support Streamable HTTP

#### SSE Mode (for n8n)
- **Endpoint**: `/sse` + `/messages`
- **Method**: GET (SSE) + POST (messages)
- **Advantages**: Supports real-time bidirectional communication
- **Suitable for**: n8n and other MCP clients that support SSE

## Running Modes

### HTTP Mode (Recommended, Multi-Platform Support)
```bash
npm run start:http
```
- **Hybrid Mode**: Supports both SSE and Streamable HTTP simultaneously
- **Dify Compatible**: Supports Streamable HTTP via `/mcp` endpoint
- **n8n Compatible**: Supports Server-Sent Events via `/sse` endpoint
- **Multi-Transport**: One server supports both transport methods
- **Health Check**: Provides `/health` endpoint
- **Debug Tools**: Provides `/tools`, `/info`, `/sse-status` debug endpoints

### Stdio Mode (Cursor Editor and Command Line Tools)
```bash
npm start
```
- **Standard Input/Output Mode**: Direct communication via stdin/stdout
- **Cursor Compatible**: Suitable for Cursor editor MCP integration
- **Command Line Tools**: Suitable for scripts and command line MCP clients
- **Lightweight**: No HTTP server required, minimal resource usage

### Mode Selection Guide

| Purpose | Recommended Mode | Command | Endpoint |
|---------|------------------|---------|----------|
| Dify Integration | HTTP | `npm run start:http` | `/mcp` |
| n8n Integration | HTTP | `npm run start:http` | `/sse` |
| Cursor Editor | Stdio | `npm start` | - |
| Command Line Tools | Stdio | `npm start` | - |
| Development Debug | HTTP | `npm run start:http` | `/health`, `/tools` |

## Troubleshooting

### Dify Connection Issues

#### 1. Check if MCP Server is Running Properly
```bash
curl http://localhost:3001/health
```

#### 2. Test Streamable HTTP Endpoint
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

#### 3. Common Error Solutions

**Error**: `'NoneType' is not iterable`
- **Cause**: Old version MCP Server response format issue
- **Solution**: Update to v2.1.4 or newer version

**Error**: `Method not found: notifications/initialized`
- **Cause**: Incomplete MCP protocol implementation
- **Solution**: Ensure using latest version and use `streamable_http` transport

**Error**: `400 Bad Request`
- **Cause**: Incorrect configuration URL
- **Solution**: Confirm URL points to `/mcp` endpoint, not `/sse`

#### 4. Dify Configuration Checklist
- [ ] transport set to `"streamable_http"`
- [ ] URL points to `/mcp` endpoint
- [ ] Server responds normally to health check
- [ ] Firewall not blocking the corresponding port
- [ ] MCP RESOURCES AS TOOLS set to True

## Tool Documentation

### Kubernetes Tools

#### 1. kubectl_get
- **Function**: Get Kubernetes resources
- **Supported Resources**: pods, nodes, deployments, services, etc. (19 resource types)
- **Features**: Supports label filtering, namespace filtering, formatted output
- **Use Cases**: Resource queries, status monitoring, problem diagnosis

#### 2. kubectl_logs
- **Function**: View Pod logs
- **Features**: Supports container selection, time range filtering, line limit
- **Use Cases**: Application debugging, log analysis, issue tracking

#### 3. kubectl_describe
- **Function**: Describe resource details
- **Supported Resources**: pod, node, service, deployment, etc.
- **Features**: Complete resource status and event records
- **Use Cases**: In-depth resource analysis, troubleshooting

#### 4. kubectl_cluster_info
- **Function**: View cluster information
- **Features**: Includes control plane and core service endpoints
- **Use Cases**: Cluster status check, connection testing

#### 5. kubectl_get_yaml
- **Function**: Get resource YAML format output
- **Features**: Supports multiple resource types, formatted output
- **Use Cases**: Configuration check, resource backup, template creation

#### 6-8. kubectl_top Series
- **Function**: Resource usage monitoring (nodes/pods/containers)
- **Features**: Supports CPU and memory usage monitoring
- **Prerequisites**: Requires metrics-server
- **Use Cases**: Performance monitoring, capacity planning, anomaly detection

#### 9. kubectl_scale_deployment
- **Function**: Scale Deployment replicas
- **Features**: Supports wait completion, timeout settings
- **Use Cases**: Load adjustment, service scaling, cost optimization

#### 10. kubectl_restart_deployment
- **Function**: Restart Deployment (rolling update)
- **Features**: Zero downtime, supports wait completion
- **Use Cases**: Configuration update, image update, fault recovery

#### 11. kubectl_edit_hpa
- **Function**: Edit HPA replica range
- **Features**: Safe parameter validation, supports wait completion
- **Use Cases**: Auto-scaling adjustment, performance optimization

### Helm Tools

#### 1. helm_list
- **Function**: List Helm releases
- **Features**: Supports multiple filtering and sorting options
- **Use Cases**: Release management, status monitoring

#### 2. helm_status
- **Function**: View release status
- **Features**: Detailed deployment information and resource status
- **Use Cases**: Deployment verification, problem diagnosis

#### 3. helm_get_values
- **Function**: View release configuration values
- **Features**: Supports multiple output formats
- **Use Cases**: Configuration check, value override verification

#### 4. helm_repo_list
- **Function**: List Helm repositories
- **Features**: Supports multiple output formats
- **Use Cases**: Repository management

#### 5. helm_history
- **Function**: View release deployment history
- **Features**: Complete version and change records
- **Use Cases**: Version tracking, rollback preparation

## Development Plan

### Completed Features (16 items)

#### Kubernetes Tools (11 items)
- [x] **kubectl_get** - Supports 19 resource types
- [x] **kubectl_logs** - Pod log viewing
- [x] **kubectl_describe** - Resource detailed description
- [x] **kubectl_cluster_info** - Cluster information query
- [x] **kubectl_get_yaml** - YAML format output
- [x] **kubectl_top_nodes** - Node resource monitoring
- [x] **kubectl_top_pods** - Pod resource monitoring
- [x] **kubectl_top_containers** - Container resource monitoring
- [x] **kubectl_scale_deployment** - Deployment scaling
- [x] **kubectl_restart_deployment** - Deployment restart
- [x] **kubectl_edit_hpa** - HPA editing

#### Helm Tools (5 items)
- [x] **helm_list** - Release list
- [x] **helm_status** - Release status
- [x] **helm_get_values** - Release configuration values
- [x] **helm_repo_list** - Repository list
- [x] **helm_history** - Release history records

### Future Plans (4 items)

#### Operation Tools
- [ ] **Apply YAML** - Apply YAML configuration
- [ ] **Create Resource** - Create resource
- [ ] **Update Resource** - Update resource
- [ ] **Delete Resource** - Delete resource

## Contributing

### Development Environment Setup

1. **Fork and Clone**
```bash
git clone https://github.com/your-username/k8s-mcp-server.git
cd k8s-mcp-server
```

2. **Install Dependencies**
```bash
npm install
```

3. **Run Tests**
```bash
npm test            # Basic tests
npm run test:labels # Label filtering tests
npm run test:all    # All tests
```

### Development Guidelines

1. **Code Style**
   - Use ES6 module syntax
   - Follow 4-space indentation
   - Use descriptive variable names
   - Add JSDoc comments for functions
   - Follow existing error handling patterns

2. **Security Requirements**
   - Validate all inputs
   - Use safe command execution
   - Follow least privilege principle
   - Add appropriate error handling
   - Document security considerations

3. **Testing Requirements**
   - Add tests for new features
   - Ensure backward compatibility
   - Test error cases
   - Verify security checks

4. **Documentation**
   - Update README.md
   - Add JSDoc comments
   - Document breaking changes
   - Include usage examples

### Pull Request Process

1. Create feature branch
2. Add tests and documentation
3. Run all tests
4. Submit pull request
5. Address review comments

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Open an issue on GitHub
- Join our community chat
- Check documentation