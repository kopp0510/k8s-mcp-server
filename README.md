# Kubernetes MCP Server

一個簡單、可靠的 MCP (Model Context Protocol) Server，專為 Kubernetes 環境和 n8n 整合而設計。

## 🌟 特色

- ✅ **n8n 原生支援** - 完美支援 n8n MCP Client 節點
- 🔄 **SSE 連接** - 使用 Server-Sent Events 提供即時雙向通訊
- 🐳 **Kubernetes 整合** - 提供 kubectl 工具存取
- 🛡️ **健壯設計** - 從最基礎開始，逐步擴展功能
- 📝 **中文友好** - 完整的中文介面和文檔

## 🚀 快速開始

### 本地開發

1. **安裝依賴**
```bash
npm install
```

2. **啟動 SSE 模式 (n8n 專用)**
```bash
npm run start:http
# 或指定端口
npm run start:http -- --port 3001
```

3. **檢查服務狀態**
```bash
curl http://localhost:3001/health
```

### Docker 部署

```bash
docker build -t k8s-mcp-server .
docker run -p 3001:3000 k8s-mcp-server
```

## 🔌 在 n8n 中使用

### 第一步：啟動 MCP Server

確保 MCP Server 在 SSE 模式下運行：

```bash
cd k8s-mcp/k8s-mcp-server
npm run start:http -- --port 3001
```

伺服器啟動後，你會看到：

```
🚀 MCP Server 已啟動在 http://localhost:3001
📡 SSE 端點: http://localhost:3001/sse (n8n 連接這裡)
📨 訊息端點: http://localhost:3001/messages
💚 健康檢查: http://localhost:3001/health
ℹ️  SSE 模式 - 專為 n8n 設計
```

### 第二步：設定 n8n MCP Client

1. **在 n8n 中新增 MCP Client 節點**

2. **設定連線類型為 "Server-Sent Events (SSE)"**

3. **建立 SSE 憑證**：
   - **SSE URL**: `http://localhost:3001/sse`
   - **其他 Headers**: 可選，如果需要認證

4. **測試連線**：
   - 選擇 "List Tools" 操作
   - 執行工作流程
   - 應該會看到可用的工具列表

### 第三步：使用工具

選擇 "Execute Tool" 操作：

**取得 Pod 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "pods", "namespace": "default"}`

**取得 Node 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "nodes"}`

**查看 Pod 日誌**：
- **Tool Name**: `kubectl_logs`
- **Parameters**: `{"pod": "your-pod-name", "namespace": "default"}`

**描述資源詳細資訊**：
- **Tool Name**: `kubectl_describe`
- **Parameters**: `{"resource": "pod", "name": "your-pod-name", "namespace": "default"}`

## 🛠️ 可用工具

### kubectl_get

強大的 Kubernetes 資源取得工具，支援多種資源類型。

**參數**：
- `resource` (必需): 資源類型，支援 "pods" 或 "nodes"
- `namespace` (可選): Kubernetes 命名空間，僅對 pods 有效，預設為 "default"
- `name` (可選): 特定資源名稱

**範例 1 - 取得所有 Pod**：
```json
{
  "resource": "pods",
  "namespace": "kube-system"
}
```

**範例 2 - 取得所有 Node**：
```json
{
  "resource": "nodes"
}
```

**範例 3 - 取得特定 Pod**：
```json
{
  "resource": "pods",
  "namespace": "default",
  "name": "my-pod-123"
}
```

**Pod 輸出範例**：
```
📦 找到 12 個 Pod (命名空間: kube-system):

• coredns-76f75df574-abc123
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T10:00:00Z
  節點: k8s-node-1

• kube-proxy-xyz789
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T10:00:00Z
  節點: k8s-node-1
```

**Node 輸出範例**：
```
🖥️ 找到 3 個 Node:

• k8s-master-1
  狀態: Ready
  角色: control-plane,master
  版本: v1.28.0
  作業系統: linux/amd64
  容器運行時: containerd://1.7.0
  建立時間: 2024-01-01T08:00:00Z

• k8s-node-1
  狀態: Ready
  角色: <none>
  版本: v1.28.0
  作業系統: linux/amd64
  容器運行時: containerd://1.7.0
  建立時間: 2024-01-01T08:15:00Z
```

### kubectl_logs

取得 Pod 的日誌，支援多種篩選和格式選項。

**參數**：
- `pod` (必需): Pod 名稱
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `container` (可選): 容器名稱，預設為第一個容器
- `lines` (可選): 顯示的日誌行數，預設為 100
- `since` (可選): 時間範圍，如 "1h", "30m", "2d"

**範例 1 - 基本日誌**：
```json
{
  "pod": "my-app-abc123",
  "namespace": "default"
}
```

**範例 2 - 指定容器和行數**：
```json
{
  "pod": "my-app-abc123",
  "namespace": "production",
  "container": "app",
  "lines": 50
}
```

**範例 3 - 最近一小時的日誌**：
```json
{
  "pod": "my-app-abc123",
  "since": "1h"
}
```

**輸出範例**：
```
Pod: my-app-abc123 (namespace: default), container: app
行數: 50, 時間範圍: (all)
日誌長度: 1024 字元

=== 日誌內容 ===

2024-01-01T12:00:01Z [INFO] 應用程式啟動中...
2024-01-01T12:00:02Z [INFO] 連接到資料庫成功
2024-01-01T12:00:03Z [INFO] HTTP 伺服器監聽端口 8080
2024-01-01T12:00:10Z [INFO] 收到新請求: GET /api/health
2024-01-01T12:00:11Z [INFO] 健康檢查通過

💡 提示: 顯示最新 100 行日誌
```

### kubectl_describe

取得 Kubernetes 資源的詳細描述資訊，包含狀態、事件和配置。

**參數**：
- `resource` (必需): 資源類型，支援 "pod", "node", "service", "deployment", "configmap", "secret"
- `name` (必需): 資源名稱
- `namespace` (可選): Kubernetes 命名空間，僅對有命名空間的資源有效，預設為 "default"

**範例 1 - 描述 Pod**：
```json
{
  "resource": "pod",
  "name": "my-app-abc123",
  "namespace": "default"
}
```

**範例 2 - 描述 Node**：
```json
{
  "resource": "node",
  "name": "k8s-worker-01"
}
```

**範例 3 - 描述 Service**：
```json
{
  "resource": "service",
  "name": "my-service",
  "namespace": "production"
}
```

**Pod 描述輸出範例**：
```
📋 🐳 POD 詳細資訊: my-app-abc123 (命名空間: default)
======================================================

**Name:**
  my-app-abc123

**Namespace:**
  default

**Priority:**
  0

**Node:**
  k8s-worker-01/10.0.1.5

🏷️ **標籤:**
  app=my-app
  version=v1.0.0

🏥 **狀態條件:**
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True

📅 **事件記錄:**
```
Normal  Scheduled  2m    default-scheduler  Successfully assigned default/my-app-abc123 to k8s-worker-01
Normal  Pulling    2m    kubelet            Pulling image "my-app:v1.0.0"
Normal  Pulled     1m    kubelet            Successfully pulled image "my-app:v1.0.0"
Normal  Created    1m    kubelet            Created container my-app
Normal  Started    1m    kubelet            Started container my-app
```

💡 **提示**: 使用 `kubectl_logs` 查看 Pod 日誌，使用 `kubectl_get` 查看資源列表
```

## 🔧 API 端點

| 端點 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/sse` | GET | SSE 連接端點 (n8n 連接) |
| `/messages` | POST | MCP 訊息處理端點 |

## 🐞 疑難排解

### n8n 連接失敗

1. **檢查伺服器是否正在運行**：
```bash
curl http://localhost:3001/health
```

2. **測試 SSE 連接**：
```bash
curl -N http://localhost:3001/sse
```
應該會看到：
```
event: endpoint
data: /messages?sessionId=xxxxxxxxx
```

3. **檢查防火牆設定**：
確保端口 3001 沒有被防火牆阻擋。

4. **檢查 n8n 網路設定**：
如果 n8n 在 Docker 中運行，可能需要使用容器網路 IP。

### Docker 網路問題

如果 n8n 在 Docker 中運行，使用：
```
http://host.docker.internal:3001/sse  # MacOS/Windows
http://172.17.0.1:3001/sse            # Linux
```

### Kubernetes 部署

在 Kubernetes 中，使用 Service 名稱：
```
http://k8s-mcp-server-service:3001/sse
```

## 📋 運行模式

### SSE 模式 (推薦，n8n 專用)
```bash
npm run start:http
```
- 支援 Server-Sent Events
- 專為 n8n MCP Client 設計
- 提供即時雙向通訊

### Stdio 模式 (命令列工具)
```bash
npm start
```
- 標準輸入/輸出模式
- 適用於命令列 MCP 客戶端
- 輕量級，適合腳本使用

## 🔄 開發計劃

### 已完成 ✅
- [x] 基本 kubectl get pods 工具
- [x] kubectl get nodes 工具
- [x] kubectl logs 工具
- [x] kubectl describe 工具 (pod, node, service, deployment, configmap, secret)
- [x] 模組化工具架構
- [x] SSE 連接支援 (n8n 相容)
- [x] 健康檢查端點
- [x] 輸入驗證和安全性
- [x] 智慧錯誤處理和格式化輸出

### 開發中 🚧
- [ ] kubectl exec 工具
- [ ] kubectl apply/delete 工具
- [ ] 更多資源類型支援

### 規劃中 📋
- [ ] Helm 圖表管理
- [ ] 叢集監控工具 (metrics, events)
- [ ] 認證和權限管理 (RBAC)
- [ ] 配置檔案支援
- [ ] 更多資源類型 (services, deployments, configmaps)
- [ ] 批次操作支援

## 📄 授權

MIT License - 詳見 LICENSE 檔案