# K8s MCP Server - 行為範例文檔

> 版本：1.0.0
> 更新日期：2025-12-17
> 文檔類型：EDD (Example Driven Design)

---

## 1. MCP 協議流程範例

### 1.1 初始化流程

**Given**: MCP 客戶端準備初始化

**When**: 發送初始化請求

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
}
```

**Then**: 返回伺服器資訊

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "kubernetes-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

### 1.2 工具列表查詢

**When**: 請求工具列表

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Then**: 返回 17 個工具定義

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "kubectl_get",
        "description": "獲取 Kubernetes 資源",
        "inputSchema": {
          "type": "object",
          "properties": {
            "resource": {"type": "string"},
            "namespace": {"type": "string"},
            "cluster": {"type": "string"}
          },
          "required": ["resource"]
        }
      }
      // ... 其他 16 個工具
    ]
  }
}
```

---

## 2. Kubectl 工具範例

### 2.1 kubectl_get - 資源查詢

#### 基本查詢

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "kubectl_get",
    "arguments": {
      "resource": "pods",
      "namespace": "default"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "json",
      "text": "{\"apiVersion\":\"v1\",\"items\":[...]}"
    }]
  }
}
```

#### 標籤選擇器查詢

```json
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "pods",
    "namespace": "production",
    "labelSelector": "app=nginx,tier=frontend"
  }
}
```

#### 跨命名空間查詢

```json
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "pods",
    "allNamespaces": true,
    "labelSelector": "app=nginx"
  }
}
```

#### 指定叢集查詢

```json
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "deployments",
    "namespace": "default",
    "cluster": "gke-production"
  }
}
```

### 2.2 kubectl_logs - Pod 日誌

#### 基本日誌查看

```json
{
  "name": "kubectl_logs",
  "arguments": {
    "pod": "nginx-deployment-abc123",
    "namespace": "default",
    "lines": 100
  }
}
```

#### 指定容器日誌

```json
{
  "name": "kubectl_logs",
  "arguments": {
    "pod": "my-app-pod-xyz789",
    "namespace": "production",
    "container": "app-container",
    "lines": 200,
    "since": "1h"
  }
}
```

#### 查看前一個實例日誌

```json
{
  "name": "kubectl_logs",
  "arguments": {
    "pod": "crashed-pod-123",
    "namespace": "default",
    "previous": true,
    "lines": 500
  }
}
```

### 2.3 kubectl_describe - 資源描述

```json
{
  "name": "kubectl_describe",
  "arguments": {
    "resource": "deployment",
    "name": "nginx-deployment",
    "namespace": "default"
  }
}

// Response 包含事件、狀態等詳細資訊
```

### 2.4 kubectl_top_* - 資源監控

#### 節點資源監控

```json
{
  "name": "kubectl_top_nodes",
  "arguments": {
    "sortBy": "cpu"
  }
}
```

#### Pod 資源監控

```json
{
  "name": "kubectl_top_pods",
  "arguments": {
    "namespace": "default",
    "sortBy": "memory",
    "containers": true
  }
}
```

#### 容器資源監控

```json
{
  "name": "kubectl_top_containers",
  "arguments": {
    "namespace": "production",
    "podName": "my-app",
    "containerName": "app"
  }
}
```

### 2.5 kubectl_scale_deployment - 擴縮容

#### 擴展副本數

```json
{
  "name": "kubectl_scale_deployment",
  "arguments": {
    "deploymentName": "nginx-deployment",
    "replicas": 5,
    "namespace": "default"
  }
}
```

#### 等待擴展完成

```json
{
  "name": "kubectl_scale_deployment",
  "arguments": {
    "deploymentName": "nginx-deployment",
    "replicas": 10,
    "namespace": "production",
    "wait": true,
    "timeout": 300
  }
}
```

#### 縮減到零 (停止服務)

```json
{
  "name": "kubectl_scale_deployment",
  "arguments": {
    "deploymentName": "maintenance-app",
    "replicas": 0,
    "namespace": "default"
  }
}
```

### 2.6 kubectl_restart_deployment - 重啟

```json
{
  "name": "kubectl_restart_deployment",
  "arguments": {
    "deploymentName": "nginx-deployment",
    "namespace": "default",
    "wait": true
  }
}
```

### 2.7 kubectl_edit_hpa - HPA 編輯

#### 調整副本範圍

```json
{
  "name": "kubectl_edit_hpa",
  "arguments": {
    "hpaName": "nginx-hpa",
    "minReplicas": 3,
    "maxReplicas": 20,
    "namespace": "default"
  }
}
```

#### 只調整最小副本

```json
{
  "name": "kubectl_edit_hpa",
  "arguments": {
    "hpaName": "nginx-hpa",
    "minReplicas": 5,
    "namespace": "production"
  }
}
```

---

## 3. Helm 工具範例

### 3.1 helm_list - Release 列表

#### 列出所有 Release

```json
{
  "name": "helm_list",
  "arguments": {
    "allNamespaces": true
  }
}
```

#### 按狀態過濾

```json
{
  "name": "helm_list",
  "arguments": {
    "namespace": "production",
    "status": "deployed"
  }
}
```

#### 名稱過濾

```json
{
  "name": "helm_list",
  "arguments": {
    "filter": "nginx-.*",
    "allNamespaces": true
  }
}
```

### 3.2 helm_status - Release 狀態

```json
{
  "name": "helm_status",
  "arguments": {
    "releaseName": "nginx-ingress",
    "namespace": "ingress-nginx",
    "showResources": true
  }
}
```

### 3.3 helm_get_values - 配置值

#### 查看用戶配置

```json
{
  "name": "helm_get_values",
  "arguments": {
    "releaseName": "nginx-ingress",
    "namespace": "ingress-nginx",
    "output": "yaml"
  }
}
```

#### 查看完整配置 (含預設值)

```json
{
  "name": "helm_get_values",
  "arguments": {
    "releaseName": "nginx-ingress",
    "namespace": "ingress-nginx",
    "allValues": true,
    "output": "json"
  }
}
```

### 3.4 helm_history - 歷史記錄

```json
{
  "name": "helm_history",
  "arguments": {
    "releaseName": "nginx-ingress",
    "namespace": "ingress-nginx",
    "max": 10,
    "output": "table"
  }
}
```

### 3.5 helm_repo_list - 倉庫列表

```json
{
  "name": "helm_repo_list",
  "arguments": {
    "output": "json"
  }
}
```

---

## 4. 叢集管理範例

### 4.1 cluster_list - 叢集列表

#### 詳細格式

```json
{
  "name": "cluster_list",
  "arguments": {
    "format": "detailed"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "可用叢集:\n\n1. local (預設)\n   類型: local\n   狀態: 就緒\n\n2. gke-production\n   類型: gke\n   專案: my-project\n   區域: asia-east1\n   狀態: 需要認證"
  }]
}
```

#### JSON 格式

```json
{
  "name": "cluster_list",
  "arguments": {
    "format": "json",
    "includeStats": true
  }
}
```

### 4.2 gke_auth - GKE 認證

```json
{
  "name": "gke_auth",
  "arguments": {
    "cluster": "gke-production",
    "verify": true
  }
}

// Response (成功)
{
  "content": [{
    "type": "text",
    "text": "GKE 認證成功!\n\n叢集: gke-production\n專案: my-project\n區域: asia-east1\n\n叢集資訊:\n..."
  }]
}
```

---

## 5. 錯誤處理範例

### 5.1 驗證錯誤

#### 無效資源類型

```json
// Request
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "invalid-resource"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "Error: Unsupported resource type: invalid-resource"
  }],
  "isError": true
}
```

#### 危險字元

```json
// Request
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "pods",
    "namespace": "default; rm -rf /"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "Error: Forbidden character: ;"
  }],
  "isError": true
}
```

#### 參數衝突

```json
// Request
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "pods",
    "namespace": "default",
    "allNamespaces": true
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "Error: namespace and allNamespaces parameters cannot be used together"
  }],
  "isError": true
}
```

### 5.2 前置條件錯誤

```json
// Request (GKE 叢集未認證)
{
  "name": "kubectl_get",
  "arguments": {
    "resource": "pods",
    "cluster": "gke-production"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "錯誤: 前置條件檢查失敗\n\n錯誤詳情:\n叢集 gke-production 需要認證\n\n建議動作:\n1. 執行 gke_auth 工具\n2. 重新執行操作"
  }],
  "metadata": {
    "errorType": "PrerequisiteError",
    "cluster": "gke-production",
    "tool": "kubectl_get",
    "requiresAction": true
  }
}
```

### 5.3 執行錯誤

#### 資源不存在

```json
// Request
{
  "name": "kubectl_describe",
  "arguments": {
    "resource": "pod",
    "name": "non-existent-pod",
    "namespace": "default"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "Error: pods \"non-existent-pod\" not found"
  }],
  "isError": true
}
```

#### metrics-server 未安裝

```json
// Request
{
  "name": "kubectl_top_pods",
  "arguments": {
    "namespace": "default"
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "Error: Metrics API not available. Please install metrics-server."
  }],
  "isError": true
}
```

---

## 6. 平台整合範例

### 6.1 Dify 整合 (HTTP)

```bash
# 初始化
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "dify", "version": "1.0.0"}
    }
  }'

# 列出工具
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# 執行工具
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "kubectl_get",
      "arguments": {
        "resource": "pods",
        "namespace": "default"
      }
    }
  }'
```

### 6.2 n8n 整合 (SSE)

```javascript
// 1. 建立 SSE 連接
const eventSource = new EventSource('http://localhost:3000/sse');

let sessionId;

eventSource.addEventListener('connected', (e) => {
  const data = JSON.parse(e.data);
  sessionId = data.sessionId;
  console.log('Connected:', sessionId);
});

// 2. 發送 MCP 請求
async function sendMCPRequest(method, params) {
  const response = await fetch(
    `http://localhost:3000/messages?sessionId=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    }
  );
  return response.json();
}

// 3. 接收回應
eventSource.addEventListener('message', (e) => {
  const response = JSON.parse(e.data);
  console.log('Response:', response);
});

// 4. 使用範例
await sendMCPRequest('tools/call', {
  name: 'kubectl_get',
  arguments: { resource: 'pods' }
});
```

---

## 7. 常見使用案例

### 7.1 查看應用狀態

```javascript
// 1. 查看 Deployment
await callTool('kubectl_get', {
  resource: 'deployments',
  namespace: 'production',
  labelSelector: 'app=my-app'
});

// 2. 查看 Pod 狀態
await callTool('kubectl_get', {
  resource: 'pods',
  namespace: 'production',
  labelSelector: 'app=my-app'
});

// 3. 查看 Pod 日誌
await callTool('kubectl_logs', {
  pod: 'my-app-pod-abc123',
  namespace: 'production',
  lines: 100
});
```

### 7.2 故障診斷

```javascript
// 1. 描述 Pod 詳情
await callTool('kubectl_describe', {
  resource: 'pod',
  name: 'failing-pod-xyz',
  namespace: 'production'
});

// 2. 查看事件
await callTool('kubectl_get', {
  resource: 'events',
  namespace: 'production'
});

// 3. 查看之前容器日誌
await callTool('kubectl_logs', {
  pod: 'failing-pod-xyz',
  namespace: 'production',
  previous: true
});
```

### 7.3 擴縮容操作

```javascript
// 1. 查看當前狀態
await callTool('kubectl_get', {
  resource: 'deployments',
  name: 'my-app',
  namespace: 'production'
});

// 2. 擴展副本
await callTool('kubectl_scale_deployment', {
  deploymentName: 'my-app',
  replicas: 10,
  namespace: 'production',
  wait: true
});

// 3. 驗證結果
await callTool('kubectl_top_pods', {
  namespace: 'production',
  sortBy: 'cpu'
});
```

### 7.4 多叢集操作

```javascript
// 1. 列出可用叢集
await callTool('cluster_list', { format: 'detailed' });

// 2. 認證到 GKE
await callTool('gke_auth', { cluster: 'gke-production' });

// 3. 在 GKE 叢集執行操作
await callTool('kubectl_get', {
  resource: 'pods',
  namespace: 'default',
  cluster: 'gke-production'
});
```

---

## 8. 輸入驗證範例

### 8.1 有效輸入

```javascript
// ✅ 有效的資源名稱
'my-service'
'nginx-deployment'
'app-v1'

// ✅ 有效的標籤選擇器
'app=nginx'
'app=nginx,env=prod'
'tier!=frontend'

// ✅ 有效的叢集 ID
'local'
'gke-production'
'eks-staging'
```

### 8.2 無效輸入

```javascript
// ❌ 無效的資源名稱
'MyService'       // 大寫
'my_service'      // 底線
'-myapp'          // 以連字號開頭

// ❌ 無效的標籤值
'a'.repeat(64)    // 超過 63 字元
'-value'          // 以特殊字元開頭

// ❌ 危險輸入
'default; rm -rf /'  // 命令注入
'test`whoami`'       // 命令替換
'test$HOME'          // 變數展開
```

---

## 9. 測試命令速查

```bash
# 啟動伺服器
npm start                    # Stdio 模式
npm run start:http           # HTTP 模式 (port 3000)
PORT=3001 npm run start:http # 自訂 port

# 健康檢查
curl http://localhost:3000/health
curl http://localhost:3000/info

# 工具列表
curl http://localhost:3000/tools

# 執行工具
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"kubectl_get","arguments":{"resource":"pods"}}}'

# 執行測試
npm test
npm run test:unit
npm run test:integration
```
