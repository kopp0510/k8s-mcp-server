# Kubernetes MCP Server

一個簡單、可靠的 MCP (Model Context Protocol) Server，專為 Kubernetes 環境和 n8n 整合而設計。

## 特色

- **n8n 原生支援** - 完美支援 n8n MCP Client 節點
- **SSE 連接** - 使用 Server-Sent Events 提供即時雙向通訊
- **Kubernetes 整合** - 提供 kubectl 工具存取
- **健壯設計** - 從最基礎開始，逐步擴展功能
- **中文友好** - 完整的中文介面和文檔
- **模組化架構** - 清晰的入口點和伺服器分離設計

## 檔案結構

```
src/
├── index.js              # 主程式入口，處理生命週期和參數解析
├── server.js             # MCP + Express 整合，伺服器實現
├── tools/                # 工具模組
│   ├── base-tool.js      # 基底工具類別
│   ├── kubectl-get.js    # 資源查詢工具
│   ├── kubectl-logs.js   # 日誌查看工具
│   └── kubectl-describe.js # 資源描述工具
└── utils/                # 工具函數
    ├── logger.js         # 日誌系統
    ├── validator.js      # 輸入驗證
    └── kubectl.js        # kubectl 執行工具
```

### 架構說明

- **`src/index.js`** - 程式主入口，負責：
  - 命令列參數解析
  - 環境變數設定
  - 生命週期管理
  - 優雅關閉處理
  - 錯誤處理

- **`src/server.js`** - 伺服器實現，負責：
  - MCP Server 設定和工具註冊
  - Express 應用程式建立 (SSE 模式)
  - MCP 訊息處理
  - SSE 連接管理

## 快速開始

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

## 在 n8n 中使用

### 第一步：啟動 MCP Server

確保 MCP Server 在 SSE 模式下運行：

```bash
cd k8s-mcp/k8s-mcp-server
npm run start:http -- --port 3001
```

伺服器啟動後，你會看到：

```
MCP Server 已啟動在 http://localhost:3001
SSE 端點: http://localhost:3001/sse (n8n 連接這裡)
訊息端點: http://localhost:3001/messages
健康檢查: http://localhost:3001/health
SSE 模式 - 專為 n8n 設計
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

**取得 Deployment 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "deployments", "namespace": "default"}`

**取得 Service 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "services", "namespace": "default"}`

**取得 ReplicaSet 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "replicasets", "namespace": "default"}`

**取得 DaemonSet 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "daemonsets", "namespace": "kube-system"}`

**取得 StatefulSet 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "statefulsets", "namespace": "default"}`

**取得 Job 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "jobs", "namespace": "default"}`

**取得 CronJob 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "cronjobs", "namespace": "default"}`

**取得 ConfigMap 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "configmaps", "namespace": "default"}`

**取得 Secret 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "secrets", "namespace": "default"}`

**取得 PersistentVolume 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "pv"}`

**取得 PersistentVolumeClaim 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "pvc", "namespace": "default"}`

**取得 Ingress 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "ingress", "namespace": "default"}`

**取得 HorizontalPodAutoscaler 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "hpa", "namespace": "default"}`

**查看 Pod 日誌**：
- **Tool Name**: `kubectl_logs`
- **Parameters**: `{"pod": "your-pod-name", "namespace": "default"}`

**描述資源詳細資訊**：
- **Tool Name**: `kubectl_describe`
- **Parameters**: `{"resource": "pod", "name": "your-pod-name", "namespace": "default"}`

## 可用工具

### kubectl_get

強大的 Kubernetes 資源取得工具，支援多種資源類型。

**參數**：
- `resource` (必需): 資源類型，支援 "pods", "nodes", "deployments", "services", "replicasets", "daemonsets", "statefulsets", "jobs", "cronjobs", "configmaps", "secrets", "pv", "pvc", "ingress" 或 "hpa"
- `namespace` (可選): Kubernetes 命名空間，適用於除了 nodes 和 pv 以外的所有資源（cluster-scoped 資源），預設為 "default"
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

**範例 4 - 取得所有 Deployment**：
```json
{
  "resource": "deployments",
  "namespace": "default"
}
```

**範例 5 - 取得特定 Deployment**：
```json
{
  "resource": "deployments",
  "namespace": "production",
  "name": "my-app"
}
```

**範例 6 - 取得所有 Service**：
```json
{
  "resource": "services",
  "namespace": "default"
}
```

**範例 7 - 取得特定 Service**：
```json
{
  "resource": "services",
  "namespace": "kube-system",
  "name": "kube-dns"
}
```

**範例 8 - 取得所有 ReplicaSet**：
```json
{
  "resource": "replicasets",
  "namespace": "default"
}
```

**範例 9 - 取得特定 ReplicaSet**：
```json
{
  "resource": "replicasets",
  "namespace": "production",
  "name": "my-app-7c8d9f5b6"
}
```

**範例 10 - 取得所有 DaemonSet**：
```json
{
  "resource": "daemonsets",
  "namespace": "kube-system"
}
```

**範例 11 - 取得特定 DaemonSet**：
```json
{
  "resource": "daemonsets",
  "namespace": "kube-system",
  "name": "fluentd-elasticsearch"
}
```

**範例 12 - 取得所有 StatefulSet**：
```json
{
  "resource": "statefulsets",
  "namespace": "default"
}
```

**範例 13 - 取得特定 StatefulSet**：
```json
{
  "resource": "statefulsets",
  "namespace": "production",
  "name": "mysql-cluster"
}
```

**範例 14 - 取得所有 Job**：
```json
{
  "resource": "jobs",
  "namespace": "default"
}
```

**範例 15 - 取得所有 CronJob**：
```json
{
  "resource": "cronjobs",
  "namespace": "default"
}
```

**範例 16 - 取得所有 ConfigMap**：
```json
{
  "resource": "configmaps",
  "namespace": "default"
}
```

**範例 17 - 取得特定 ConfigMap**：
```json
{
  "resource": "configmaps",
  "namespace": "kube-system",
  "name": "kube-proxy"
}
```

**範例 18 - 取得所有 Secret**：
```json
{
  "resource": "secrets",
  "namespace": "default"
}
```

**範例 19 - 取得特定 Secret**：
```json
{
  "resource": "secrets",
  "namespace": "kube-system",
  "name": "default-token"
}
```

**範例 20 - 取得所有 PersistentVolume**：
```json
{
  "resource": "pv"
}
```

**範例 21 - 取得特定 PersistentVolume**：
```json
{
  "resource": "pv",
  "name": "pv-storage-001"
}
```

**範例 22 - 取得所有 PersistentVolumeClaim**：
```json
{
  "resource": "pvc",
  "namespace": "default"
}
```

**範例 23 - 取得特定 PersistentVolumeClaim**：
```json
{
  "resource": "pvc",
  "namespace": "production",
  "name": "mysql-pvc"
}
```

**範例 24 - 取得所有 Ingress**：
```json
{
  "resource": "ingress",
  "namespace": "default"
}
```

**範例 25 - 取得特定 Ingress**：
```json
{
  "resource": "ingress",
  "namespace": "production",
  "name": "web-ingress"
}
```

**範例 26 - 取得所有 HorizontalPodAutoscaler**：
```json
{
  "resource": "hpa",
  "namespace": "default"
}
```

**範例 27 - 取得特定 HPA**：
```json
{
  "resource": "hpa",
  "namespace": "production",
  "name": "web-hpa"
}
```

**Pod 輸出範例**：
```
找到 12 個 Pod (命名空間: kube-system):

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
找到 3 個 Node:

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

**Deployment 輸出範例**：
```
找到 5 個 Deployment (命名空間: default):

• my-web-app
  Ready: 3/3
  Up-to-date: 3
  Available: 3
  建立時間: 2024-01-01T09:00:00Z

• api-service
  Ready: 2/2
  Up-to-date: 2
  Available: 2
  建立時間: 2024-01-01T09:15:00Z

• background-worker
  Ready: 1/1
  Up-to-date: 1
  Available: 1
  建立時間: 2024-01-01T09:30:00Z
```

**Service 輸出範例**：
```
找到 4 個 Service (命名空間: default):

• my-web-app-service
  類型: ClusterIP
  Cluster IP: 10.96.123.45
  端口: 80/TCP -> 8080/TCP
  建立時間: 2024-01-01T09:00:00Z

• api-service-lb
  類型: LoadBalancer
  Cluster IP: 10.96.123.46
  External IP: 203.0.113.10
  端口: 443/TCP -> 8443/TCP
  建立時間: 2024-01-01T09:15:00Z

• database-service
  類型: ClusterIP
  Cluster IP: 10.96.123.47
  端口: 5432/TCP -> 5432/TCP
  建立時間: 2024-01-01T09:30:00Z
```

**ReplicaSet 輸出範例**：
```
找到 3 個 ReplicaSet (命名空間: default):

• my-web-app-7c8d9f5b6
  Desired: 3
  Current: 3
  Ready: 3
  Owner: Deployment/my-web-app
  建立時間: 2024-01-01T09:00:00Z

• api-service-5f6a7b8c9
  Desired: 2
  Current: 2
  Ready: 2
  Owner: Deployment/api-service
  建立時間: 2024-01-01T09:15:00Z

• background-worker-4d5e6f7a8
  Desired: 1
  Current: 1
  Ready: 1
  Owner: Deployment/background-worker
  建立時間: 2024-01-01T09:30:00Z
```

**DaemonSet 輸出範例**：
```
找到 2 個 DaemonSet (命名空間: kube-system):

• fluentd-elasticsearch
  Desired: 3
  Current: 3
  Ready: 3
  Up-to-date: 3
  Available: 3
  建立時間: 2024-01-01T08:00:00Z

• node-exporter
  Desired: 3
  Current: 3
  Ready: 3
  Up-to-date: 3
  Available: 3
  建立時間: 2024-01-01T08:15:00Z
```

**StatefulSet 輸出範例**：
```
找到 2 個 StatefulSet (命名空間: default):

• mysql-cluster
  Ready: 3/3
  Replicas: 3
  Current Revision: mysql-cluster-7c8d9f5b6
  Update Revision: mysql-cluster-7c8d9f5b6
  建立時間: 2024-01-01T10:00:00Z

• redis-cluster
  Ready: 5/5
  Replicas: 5
  Current Revision: redis-cluster-5f6a7b8c9
  Update Revision: redis-cluster-5f6a7b8c9
  建立時間: 2024-01-01T10:15:00Z
```

**Job 輸出範例**：
```
找到 3 個 Job (命名空間: default):

• backup-job-20240101
  Completions: 1/1
  Duration: 5m32s
  狀態: Complete
  建立時間: 2024-01-01T02:00:00Z
  完成時間: 2024-01-01T02:05:32Z

• data-migration-job
  Completions: 0/1
  Duration: 2m15s
  狀態: Running
  建立時間: 2024-01-01T03:00:00Z

• cleanup-job-failed
  Completions: 0/1
  Duration: 10m
  狀態: Failed
  建立時間: 2024-01-01T01:00:00Z
```

**CronJob 輸出範例**：
```
找到 2 個 CronJob (命名空間: default):

• daily-backup
  Schedule: 0 2 * * *
  Suspend: false
  Active: 0
  Last Schedule: 2024-01-01T02:00:00Z
  建立時間: 2024-01-01T00:00:00Z

• weekly-cleanup
  Schedule: 0 0 * * 0
  Suspend: false
  Active: 1
  Last Schedule: 2024-01-01T00:00:00Z
  建立時間: 2024-01-01T00:00:00Z
```

**ConfigMap 輸出範例**：
```
找到 4 個 ConfigMap (命名空間: default):

• app-config
  Data: 3 項
  - database.host: mysql.default.svc.cluster.local
  - database.port: 3306
  - app.debug: false
  建立時間: 2024-01-01T09:00:00Z

• nginx-config
  Data: 2 項
  - nginx.conf: [1.2KB]
  - default.conf: [0.8KB]
  建立時間: 2024-01-01T09:15:00Z

• env-config
  Data: 5 項
  - NODE_ENV: production
  - LOG_LEVEL: info
  - PORT: 3000
  - REDIS_URL: redis://redis:6379
  - API_VERSION: v1
  建立時間: 2024-01-01T09:30:00Z
```

**Secret 輸出範例**：
```
找到 3 個 Secret (命名空間: default):

• database-credentials
  類型: Opaque
  Data: 2 項
  - username: [8 bytes]
  - password: [16 bytes]
  建立時間: 2024-01-01T08:00:00Z

• tls-certificate
  類型: kubernetes.io/tls
  Data: 2 項
  - tls.crt: [1.4KB]
  - tls.key: [1.7KB]
  建立時間: 2024-01-01T08:15:00Z

• registry-secret
  類型: kubernetes.io/dockerconfigjson
  Data: 1 項
  - .dockerconfigjson: [256 bytes]
  建立時間: 2024-01-01T08:30:00Z
```

**PersistentVolume 輸出範例**：
```
找到 3 個 PersistentVolume:

• pv-storage-001
  Capacity: 10Gi
  Access Modes: ReadWriteOnce
  Reclaim Policy: Retain
  Status: Available
  Storage Class: fast-ssd
  建立時間: 2024-01-01T07:00:00Z

• pv-storage-002
  Capacity: 50Gi
  Access Modes: ReadWriteMany
  Reclaim Policy: Delete
  Status: Bound
  Claim: default/mysql-pvc
  Storage Class: standard
  建立時間: 2024-01-01T07:15:00Z

• pv-storage-003
  Capacity: 100Gi
  Access Modes: ReadWriteOnce
  Reclaim Policy: Retain
  Status: Available
  Storage Class: slow-hdd
  建立時間: 2024-01-01T07:30:00Z
```

**PersistentVolumeClaim 輸出範例**：
```
找到 2 個 PersistentVolumeClaim (命名空間: default):

• mysql-pvc
  Status: Bound
  Volume: pv-storage-002
  Capacity: 50Gi
  Access Modes: ReadWriteMany
  Storage Class: standard
  建立時間: 2024-01-01T08:00:00Z

• redis-pvc
  Status: Pending
  Volume:
  Capacity: 20Gi
  Access Modes: ReadWriteOnce
  Storage Class: fast-ssd
  建立時間: 2024-01-01T08:15:00Z
```

**Ingress 輸出範例**：
```
找到 2 個 Ingress (命名空間: default):

• web-ingress
  Class: nginx
  Hosts:
  - api.example.com -> my-api-service:80
  - web.example.com -> my-web-service:80
  Address: 203.0.113.10
  建立時間: 2024-01-01T09:00:00Z

• admin-ingress
  Class: traefik
  Hosts:
  - admin.example.com -> admin-service:8080
  Address: 203.0.113.11
  建立時間: 2024-01-01T09:15:00Z
```

**HorizontalPodAutoscaler 輸出範例**：
```
找到 2 個 HorizontalPodAutoscaler (命名空間: default):

• web-hpa
  Scale Target: Deployment/my-web-app
  Min Replicas: 2
  Max Replicas: 10
  Current Replicas: 3
  CPU: 45% / 70%
  Memory: 60% / 80%
  建立時間: 2024-01-01T10:00:00Z

• api-hpa
  Scale Target: Deployment/my-api-service
  Min Replicas: 1
  Max Replicas: 5
  Current Replicas: 2
  CPU: 30% / 50%
  建立時間: 2024-01-01T10:15:00Z
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

提示: 顯示最新 100 行日誌
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
POD 詳細資訊: my-app-abc123 (命名空間: default)
======================================================

**Name:**
  my-app-abc123

**Namespace:**
  default

**Priority:**
  0

**Node:**
  k8s-worker-01/10.0.1.5

**標籤:**
  app=my-app
  version=v1.0.0

**狀態條件:**
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True

**事件記錄:**
```
Normal  Scheduled  2m    default-scheduler  Successfully assigned default/my-app-abc123 to k8s-worker-01
Normal  Pulling    2m    kubelet            Pulling image "my-app:v1.0.0"
Normal  Pulled     1m    kubelet            Successfully pulled image "my-app:v1.0.0"
Normal  Created    1m    kubelet            Created container my-app
Normal  Started    1m    kubelet            Started container my-app
```

**提示**: 使用 `kubectl_logs` 查看 Pod 日誌，使用 `kubectl_get` 查看資源列表
```

## API 端點

| 端點 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/sse` | GET | SSE 連接端點 (n8n 連接) |
| `/messages` | POST | MCP 訊息處理端點 |

## 疑難排解

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

## 運行模式

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

## 開發計劃

### 已完成 (16項)
- [x] **Get Pods** - 取得 Pod 列表和詳細資訊
- [x] **Get Nodes** - 取得 Node 列表和詳細資訊
- [x] **Get Deployments** - 取得 Deployment 列表和詳細資訊
- [x] **Get Services** - 取得 Service 列表和詳細資訊
- [x] **Get ReplicaSets** - 取得 ReplicaSet 列表和詳細資訊
- [x] **Get DaemonSets** - 取得 DaemonSet 列表和詳細資訊
- [x] **Get StatefulSets** - 取得 StatefulSet 列表和詳細資訊
- [x] **Get Jobs/CronJobs** - 取得 Job 和 CronJob 列表和詳細資訊
- [x] **Get ConfigMaps** - 取得 ConfigMap 列表和詳細資訊
- [x] **Get Secrets** - 取得 Secret 列表和詳細資訊
- [x] **Get PersistentVolumes** - 取得 PV 列表和詳細資訊
- [x] **Get PersistentVolumeClaims** - 取得 PVC 列表和詳細資訊
- [x] **Get Ingress** - 取得 Ingress 列表和詳細資訊
- [x] **Get HPA** - 取得 HorizontalPodAutoscaler 列表和詳細資訊
- [x] **Describe Resources** - 描述各種資源的詳細資訊
- [x] **Get Pod Logs** - 查看 Pod 日誌
- [x] 模組化工具架構
- [x] SSE 連接支援 (n8n 相容)
- [x] 健康檢查端點
- [x] 輸入驗證和安全性
- [x] 智慧錯誤處理和格式化輸出

### 未完成功能 (依分類整理)

#### 監控類 (6項)
- [ ] **Top Nodes** - 查看 Node 資源使用情況
- [ ] **Top Pods** - 查看 Pod 資源使用情況
- [ ] **Top Containers** - 查看容器資源使用情況
- [ ] **Get Node Metrics** - 取得 Node 指標
- [ ] **Get Pod Metrics** - 取得 Pod 指標
- [ ] **Get Events** - 取得叢集事件

#### 操作類 (8項)
- [ ] **Edit HPA** - 編輯 HorizontalPodAutoscaler
- [ ] **Scale Deployment** - 擴縮 Deployment
- [ ] **Restart Deployment** - 重啟 Deployment
- [ ] **Delete Pod** - 刪除 Pod
- [ ] **Apply YAML** - 應用 YAML 配置
- [ ] **Create Resource** - 創建資源
- [ ] **Update Resource** - 更新資源
- [ ] **Delete Resource** - 刪除資源

#### 互動類 (4項)
- [ ] **Exec into Pod** - 進入 Pod 執行指令
- [ ] **Port Forward** - 端口轉發
- [ ] **Copy Files** - 複製檔案到/從 Pod
- [ ] **Attach to Pod** - 附加到 Pod

#### 管理類 (5項)
- [ ] **List Namespaces** - 列出命名空間
- [ ] **Filter by Labels** - 按標籤篩選
- [ ] **Filter by Annotations** - 按註解篩選
- [ ] **Get Resource YAML** - 取得資源 YAML
- [ ] **Get Resource Status** - 取得資源狀態

#### 進階功能 (6項)
- [ ] **Stream Pod Logs** - 即時串流 Pod 日誌
- [ ] **Get Cluster Info** - 取得叢集資訊
- [ ] **Get ServiceAccounts** - 取得服務帳戶
- [ ] **Get Roles/RoleBindings** - 取得角色和角色綁定
- [ ] **Get ClusterRoles** - 取得叢集角色
- [ ] **Check Permissions** - 檢查權限

### 功能統計
- **已完成**: 16項核心功能
- **待開發**: 29項功能
- **總計**: 45項功能
- **完成度**: 35.6%

## 授權

MIT License - 詳見 LICENSE 檔案