# K8s MCP Server - API 契約文檔

> 版本：1.0.0
> 更新日期：2025-12-17
> 文檔類型：DbC (Design by Contract)

---

## 1. 協議概覽

### 1.1 通訊協議

| 協議 | 版本 | 說明 |
|------|------|------|
| MCP | 2024-11-05 | Model Context Protocol |
| JSON-RPC | 2.0 | 訊息格式 |
| HTTP | 1.1 | 傳輸層 |
| SSE | - | Server-Sent Events |

### 1.2 傳輸模式

| 模式 | 端點 | 客戶端 |
|------|------|--------|
| Stdio | stdin/stdout | Claude CLI |
| SSE | `/sse` + `/messages` | n8n |
| HTTP | `/mcp` | Dify |

---

## 2. HTTP 端點契約

### 2.1 健康檢查

```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "service": "k8s-mcp-server",
  "version": "1.0.0",
  "timestamp": "2025-12-17T10:00:00.000Z",
  "mode": "hybrid",
  "transports": ["sse", "streamable_http"],
  "tools": [
    {"name": "kubectl_get", "description": "..."},
    // ... 17 個工具
  ]
}
```

### 2.2 伺服器資訊

```
GET /info
```

**Response**:
```json
{
  "name": "kubernetes-mcp-server",
  "version": "1.0.0",
  "protocolVersion": "2024-11-05",
  "transports": ["stdio", "sse", "streamable_http"],
  "endpoints": {
    "health": "/health",
    "mcp": "/mcp",
    "sse": "/sse",
    "sse-status": "/sse-status",
    "messages": "/messages",
    "tools": "/tools",
    "info": "/info"
  },
  "capabilities": {
    "tools": {},
    "resources": false,
    "prompts": false
  },
  "statistics": {
    "activeSSEConnections": 0,
    "availableTools": 17
  }
}
```

### 2.3 工具列表

```
GET /tools
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "kubectl_get",
        "description": "...",
        "inputSchema": {...}
      }
      // ... 17 個工具
    ]
  }
}
```

### 2.4 MCP 端點 (Dify)

```
POST /mcp
Content-Type: application/json
```

**Request**:
```json
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
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "..."
      }
    ]
  }
}
```

### 2.5 SSE 端點 (n8n)

```
GET /sse
```

**Events**:
```
event: connected
data: {"sessionId":"...","messageEndpoint":"/messages?sessionId=..."}

event: endpoint
data: /messages?sessionId=...

event: ping
data: {"timestamp":...}

event: message
data: {...MCP Response...}
```

### 2.6 SSE 訊息端點

```
POST /messages?sessionId=<sessionId>
Content-Type: application/json
```

---

## 3. MCP 工具契約

### 3.1 kubectl_get

**功能**：查詢 Kubernetes 資源

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "resource": {
      "type": "string",
      "enum": ["pods", "nodes", "deployments", "services", "replicasets",
               "daemonsets", "statefulsets", "jobs", "cronjobs", "configmaps",
               "secrets", "pv", "pvc", "ingress", "hpa", "namespaces",
               "events", "serviceaccounts", "clusterroles", "clusterrolebindings"],
      "description": "資源類型 (必需)"
    },
    "namespace": {
      "type": "string",
      "description": "命名空間 (可選，預設 'default')"
    },
    "allNamespaces": {
      "type": "boolean",
      "default": false,
      "description": "查詢所有命名空間"
    },
    "name": {
      "type": "string",
      "description": "資源名稱 (可選)"
    },
    "labelSelector": {
      "type": "string",
      "description": "標籤選擇器 (如: 'app=nginx,env=prod')"
    },
    "labels": {
      "type": "object",
      "description": "標籤物件 (替代 labelSelector)"
    },
    "cluster": {
      "type": "string",
      "description": "叢集 ID (可選)"
    }
  },
  "required": ["resource"]
}
```

**前置條件**:
- `resource` 必須是支援的類型
- `namespace` 和 `allNamespaces` 不能同時使用
- 若指定 `cluster`，叢集必須可用

**後置條件**:
- 返回 JSON 格式的資源列表

**錯誤情況**:
- 無效資源類型：`Unsupported resource type: {type}`
- 參數衝突：`namespace and allNamespaces cannot be used together`

---

### 3.2 kubectl_logs

**功能**：獲取 Pod 日誌

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "pod": {
      "type": "string",
      "description": "Pod 名稱 (必需)"
    },
    "namespace": {
      "type": "string",
      "default": "default",
      "description": "命名空間"
    },
    "container": {
      "type": "string",
      "description": "容器名稱 (多容器 Pod 必需)"
    },
    "lines": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 100,
      "description": "返回行數"
    },
    "since": {
      "type": "string",
      "description": "時間範圍 (如: '1h', '30m', '10s')"
    },
    "follow": {
      "type": "boolean",
      "default": false,
      "description": "串流模式 (安全禁用)"
    },
    "previous": {
      "type": "boolean",
      "default": false,
      "description": "查看前一個實例日誌"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["pod"]
}
```

**前置條件**:
- Pod 必須存在
- 若有多個容器，必須指定 `container`

**後置條件**:
- 返回日誌內容 + 元資訊

---

### 3.3 kubectl_describe

**功能**：獲取資源詳細描述

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "resource": {
      "type": "string",
      "enum": ["pod", "node", "service", "deployment", "configmap",
               "secret", "serviceaccount", "clusterrole", "clusterrolebinding"],
      "description": "資源類型 (必需)"
    },
    "name": {
      "type": "string",
      "description": "資源名稱 (必需)"
    },
    "namespace": {
      "type": "string",
      "default": "default",
      "description": "命名空間"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["resource", "name"]
}
```

---

### 3.4 kubectl_cluster_info

**功能**：獲取叢集資訊

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "dump": {
      "type": "boolean",
      "default": false,
      "description": "返回詳細叢集狀態"
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

---

### 3.5 kubectl_get_yaml

**功能**：獲取資源 YAML

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "resource": {
      "type": "string",
      "description": "資源類型 (必需)"
    },
    "name": {
      "type": "string",
      "description": "資源名稱"
    },
    "namespace": {
      "type": "string"
    },
    "allNamespaces": {
      "type": "boolean"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["resource"]
}
```

---

### 3.6 kubectl_top_nodes

**功能**：節點資源監控

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "sortBy": {
      "type": "string",
      "enum": ["cpu", "memory"],
      "description": "排序欄位"
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

**前置條件**:
- metrics-server 必須已安裝

---

### 3.7 kubectl_top_pods

**功能**：Pod 資源監控

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "namespace": {
      "type": "string",
      "default": "default"
    },
    "allNamespaces": {
      "type": "boolean"
    },
    "sortBy": {
      "type": "string",
      "enum": ["cpu", "memory"]
    },
    "containers": {
      "type": "boolean",
      "default": false,
      "description": "顯示容器級別"
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

---

### 3.8 kubectl_top_containers

**功能**：容器資源監控

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "namespace": {
      "type": "string",
      "default": "default"
    },
    "allNamespaces": {
      "type": "boolean"
    },
    "sortBy": {
      "type": "string"
    },
    "podName": {
      "type": "string",
      "description": "過濾特定 Pod"
    },
    "containerName": {
      "type": "string",
      "description": "容器名稱模糊匹配"
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

---

### 3.9 kubectl_scale_deployment

**功能**：Deployment 擴縮容

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "deploymentName": {
      "type": "string",
      "description": "Deployment 名稱 (必需)"
    },
    "replicas": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "description": "目標副本數 (必需)"
    },
    "namespace": {
      "type": "string",
      "default": "default"
    },
    "wait": {
      "type": "boolean",
      "default": false,
      "description": "等待完成"
    },
    "timeout": {
      "type": "integer",
      "minimum": 30,
      "maximum": 1800,
      "default": 300,
      "description": "超時秒數"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["deploymentName", "replicas"]
}
```

---

### 3.10 kubectl_restart_deployment

**功能**：Deployment 重啟

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "deploymentName": {
      "type": "string",
      "description": "Deployment 名稱 (必需)"
    },
    "namespace": {
      "type": "string",
      "default": "default"
    },
    "wait": {
      "type": "boolean",
      "default": false
    },
    "timeout": {
      "type": "integer",
      "default": 300
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["deploymentName"]
}
```

---

### 3.11 kubectl_edit_hpa

**功能**：HPA 配置編輯

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "hpaName": {
      "type": "string",
      "description": "HPA 名稱 (必需)"
    },
    "minReplicas": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "description": "最小副本數"
    },
    "maxReplicas": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "description": "最大副本數"
    },
    "namespace": {
      "type": "string",
      "default": "default"
    },
    "wait": {
      "type": "boolean",
      "default": false
    },
    "timeout": {
      "type": "integer",
      "default": 120
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["hpaName"]
}
```

**驗證規則**:
- 至少提供 `minReplicas` 或 `maxReplicas` 其一
- `minReplicas` 不能大於 `maxReplicas`

---

### 3.12 helm_list

**功能**：Helm Release 列表

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "namespace": {
      "type": "string"
    },
    "allNamespaces": {
      "type": "boolean",
      "default": true
    },
    "status": {
      "type": "string",
      "enum": ["all", "deployed", "failed", "uninstalled", "superseded", "pending"]
    },
    "filter": {
      "type": "string",
      "description": "名稱過濾 (支援正則)"
    },
    "short": {
      "type": "boolean",
      "default": false
    },
    "date": {
      "type": "boolean",
      "default": true
    },
    "reverse": {
      "type": "boolean",
      "default": false
    },
    "max": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 256
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

---

### 3.13 helm_status

**功能**：Release 狀態查詢

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "releaseName": {
      "type": "string",
      "description": "Release 名稱 (必需)"
    },
    "namespace": {
      "type": "string"
    },
    "revision": {
      "type": "integer",
      "description": "版本號 (預設最新)"
    },
    "showResources": {
      "type": "boolean",
      "default": false
    },
    "showHooks": {
      "type": "boolean",
      "default": false
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["releaseName"]
}
```

---

### 3.14 helm_repo_list

**功能**：Helm 倉庫列表

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "output": {
      "type": "string",
      "enum": ["table", "json", "yaml"],
      "default": "table"
    },
    "cluster": {
      "type": "string"
    }
  }
}
```

---

### 3.15 helm_get_values

**功能**：Release 配置值

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "releaseName": {
      "type": "string",
      "description": "Release 名稱 (必需)"
    },
    "namespace": {
      "type": "string"
    },
    "revision": {
      "type": "integer"
    },
    "output": {
      "type": "string",
      "enum": ["yaml", "json", "table"],
      "default": "yaml"
    },
    "allValues": {
      "type": "boolean",
      "default": false,
      "description": "包含預設值"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["releaseName"]
}
```

---

### 3.16 helm_history

**功能**：Release 歷史記錄

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "releaseName": {
      "type": "string",
      "description": "Release 名稱 (必需)"
    },
    "namespace": {
      "type": "string"
    },
    "max": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 256
    },
    "output": {
      "type": "string",
      "enum": ["table", "json", "yaml"],
      "default": "table"
    },
    "cluster": {
      "type": "string"
    }
  },
  "required": ["releaseName"]
}
```

---

### 3.17 cluster_list

**功能**：可用叢集列表

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "enum": ["table", "detailed", "json"],
      "default": "detailed"
    },
    "includeStats": {
      "type": "boolean",
      "default": false
    }
  }
}
```

---

### 3.18 gke_auth

**功能**：GKE 叢集認證

**輸入 Schema**:
```json
{
  "type": "object",
  "properties": {
    "cluster": {
      "type": "string",
      "description": "GKE 叢集 ID (必需)"
    },
    "verify": {
      "type": "boolean",
      "default": true,
      "description": "認證後驗證連線"
    },
    "region": {
      "type": "string",
      "description": "區域覆蓋"
    }
  },
  "required": ["cluster"]
}
```

---

## 4. 錯誤碼定義

### 4.1 JSON-RPC 錯誤碼

| 代碼 | 訊息 | 說明 |
|------|------|------|
| -32601 | Method not found | 未知方法 |
| -32603 | Internal error | 執行錯誤 |
| -32000 | Invalid session | SSE 會話無效 |

### 4.2 驗證錯誤

| 錯誤類型 | 訊息範例 |
|---------|---------|
| 無效資源 | `Unsupported resource type: xxx` |
| 參數衝突 | `namespace and allNamespaces cannot be used together` |
| 標籤無效 | `Invalid "in" expression format` |
| 名稱無效 | `Resource name format does not conform to Kubernetes specifications` |
| 長度超限 | `Label value length cannot exceed 63 characters` |
| 危險字元 | `Forbidden character: ;` |

### 4.3 前置條件錯誤

當叢集認證失敗時，返回 PrerequisiteError 格式：

```json
{
  "content": [{
    "type": "text",
    "text": "錯誤: 前置條件檢查失敗\n\n錯誤詳情:...\n\n建議動作:..."
  }],
  "metadata": {
    "errorType": "PrerequisiteError",
    "cluster": "gke-prod",
    "tool": "kubectl_get",
    "requiresAction": true,
    "suggestion": "請先執行 gke_auth 工具"
  }
}
```

---

## 5. 響應格式

### 5.1 成功響應

```json
{
  "content": [
    {
      "type": "text|json|yaml",
      "text": "..."
    }
  ]
}
```

### 5.2 錯誤響應

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: ..."
    }
  ],
  "isError": true
}
```

---

## 6. 輸入驗證規則

### 6.1 全局規則

- 危險字元：`;`, `&`, `|`, `>`, `<`, `` ` ``, `$`, `(`, `)`
- 最大長度：1000 字元
- 禁止 Null 字元：`\0`

### 6.2 資源名稱

```regex
^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
```
- 最大 253 字元

### 6.3 標籤鍵

- 前綴：最大 253 字元
- 本地：最大 63 字元

### 6.4 標籤值

```regex
^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$
```
- 最大 63 字元
- 允許空值

### 6.5 叢集 ID

```regex
^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$
```
- 最大 64 字元
- 禁止連續特殊字元
- 禁止保留詞
