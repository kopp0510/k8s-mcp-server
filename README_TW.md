# Kubernetes & Helm MCP Server

一個簡單、可靠的 MCP (Model Context Protocol) Server，專為 Kubernetes 和 Helm 環境管理，支援 n8n 整合。

## 特色

- **n8n 原生支援** - 完美支援 n8n MCP Client 節點
- **SSE 連接** - 使用 Server-Sent Events 提供即時雙向通訊
- **Kubernetes 整合** - 提供完整的 kubectl 工具存取
- **Helm 支援** - 提供 Helm chart 和 release 管理功能
- **模組化架構** - 清晰的入口點和伺服器分離設計
- **錯誤處理機制** - 完整的前置條件檢查和錯誤穿透處理
- **安全性保護** - 防止未認證狀態下執行危險操作
- **資源監控** - 完整的資源使用監控功能
- **標籤篩選** - 強大的標籤篩選和搜尋功能
- **多資源支援** - 支援 19 種不同的 Kubernetes 資源類型

## 版本資訊

- **當前版本**: 2.1.3
- **完成度**: 100%
- **支援工具**: 16 個主要工具
- **錯誤處理**: 全面完成重構
- **認證機制**: GKE 叢集認證整合
- **安全機制**: kubectl/helm 危險操作阻止

## 檔案結構

```
k8s-mcp-server/
├── src/                           # 原始碼目錄
│   ├── index.js                   # 主程式入口，處理生命週期和參數解析
│   ├── server.js                  # MCP + Express 整合，伺服器實現
│   ├── tools/                     # 工具模組
│   │   ├── base-tool.js           # 基底工具類別，包含前置條件檢查
│   │   ├── kubectl-get.js         # 資源查詢工具 (支援標籤篩選)
│   │   ├── kubectl-logs.js        # Pod 日誌查看工具
│   │   ├── kubectl-describe.js    # 資源詳細描述工具
│   │   ├── kubectl-cluster-info.js # 叢集資訊查詢工具
│   │   ├── kubectl-get-yaml.js    # 資源 YAML 格式輸出工具
│   │   ├── kubectl-top-nodes.js   # Node 資源使用情況監控
│   │   ├── kubectl-top-pods.js    # Pod 資源使用情況監控
│   │   ├── kubectl-top-containers.js # 容器資源使用情況監控
│   │   ├── kubectl-scale-deployment.js # Deployment 擴縮工具
│   │   ├── kubectl-restart-deployment.js # Deployment 重啟工具
│   │   ├── kubectl-edit-hpa.js    # HPA 編輯工具
│   │   ├── helm-list.js           # Helm release 列表工具
│   │   ├── helm-status.js         # Helm release 狀態工具
│   │   ├── helm-repo-list.js      # Helm repository 列表工具
│   │   ├── helm-get-values.js     # Helm release 配置值工具
│   │   └── helm-history.js        # Helm release 歷史記錄工具
│   └── utils/                     # 工具函數
│       ├── logger.js              # 日誌系統
│       ├── validator.js           # 輸入驗證 (包含標籤驗證)
│       ├── kubectl.js             # kubectl 執行工具
│       └── helm.js                # helm 執行工具
├── package.json                   # 專案配置和依賴
├── package-lock.json              # 依賴鎖定檔案
├── Dockerfile                     # Docker 容器建構檔案
├── build.sh                       # Docker 建構腳本
├── .gitignore                     # Git 忽略檔案配置
├── .cursorignore                  # Cursor 編輯器忽略檔案配置
└── README.md                      # 專案說明文檔
```

### 架構說明

- **`src/index.js`** - 程式主入口，負責：
  - 命令列參數解析
  - 環境變數設定
  - 生命週期管理
  - 優雅關閉處理
  - 錯誤處理
  - 前置條件檢查
  - GKE 叢集認證

- **`src/server.js`** - 伺服器實現，負責：
  - MCP Server 設定和工具註冊
  - Express 應用程式建立 (SSE 模式)
  - MCP 訊息處理
  - SSE 連接管理
  - 錯誤穿透處理
  - 安全性檢查

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

#### 1. 構建映像

```bash
docker build -t k8s-mcp-server .
```

#### 2. 啟動容器（需要掛載 kubeconfig）

**⚠️ 重要：** 容器啟動時需要將本機的 `.kube/config` 掛載到容器內的 `/home/nodejs/.kube/config` 路徑，以便 MCP Server 能夠存取 Kubernetes 叢集。

```bash
# 使用本機 kubeconfig
docker run -p 3001:3000 \
  -v ~/.kube/config:/home/nodejs/.kube/config:ro \
  k8s-mcp-server
```

#### 3. 自定義 kubeconfig 路徑

```bash
# 使用自定義 kubeconfig 檔案
docker run -p 3001:3000 \
  -v /path/to/your/kubeconfig:/home/nodejs/.kube/config:ro \
  k8s-mcp-server
```

#### 4. 使用 service account token（Kubernetes 內部部署）

```bash
# 在 Kubernetes 叢集內部署時，可以使用 service account
docker run -p 3001:3000 \
  -v /var/run/secrets/kubernetes.io/serviceaccount:/var/run/secrets/kubernetes.io/serviceaccount:ro \
  -e KUBERNETES_SERVICE_HOST \
  -e KUBERNETES_SERVICE_PORT \
  k8s-mcp-server
```

#### 5. 驗證連線

容器啟動後，可以檢查 Kubernetes 連線狀態：

```bash
# 檢查服務狀態
curl http://localhost:3001/health

# 測試 Kubernetes 連線
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

#### 6. 重要注意事項

**權限要求：**
- 確保 kubeconfig 檔案具有適當的 Kubernetes 叢集存取權限
- 建議使用唯讀權限的 service account 來提高安全性
- 容器以 `nodejs` 使用者身份運行，確保掛載的檔案具有適當的讀取權限

**故障排除：**
```bash
# 檢查 kubeconfig 檔案權限
ls -la ~/.kube/config

# 驗證 kubeconfig 是否有效
kubectl --kubeconfig ~/.kube/config get nodes

# 檢查容器內的 kubeconfig
docker exec -it <container-id> cat /home/nodejs/.kube/config
```

**Docker Compose 範例：**
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

**取得 ClusterRole 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "clusterroles"}`

**取得特定 ClusterRole**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "clusterroles", "name": "cluster-admin"}`

**取得 ClusterRoleBinding 列表**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "clusterrolebindings"}`

**取得特定 ClusterRoleBinding**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "clusterrolebindings", "name": "cluster-admin"}`

**查看 Pod 日誌**：
- **Tool Name**: `kubectl_logs`
- **Parameters**: `{"pod": "your-pod-name", "namespace": "default"}`

**描述資源詳細資訊**：
- **Tool Name**: `kubectl_describe`
- **Parameters**: `{"resource": "pod", "name": "your-pod-name", "namespace": "default"}`

**擴縮 Deployment 副本**：
- **Tool Name**: `kubectl_scale_deployment`
- **Parameters**: `{"deploymentName": "my-web-app", "replicas": 3, "namespace": "default"}`

**重啟 Deployment**：
- **Tool Name**: `kubectl_restart_deployment`
- **Parameters**: `{"deploymentName": "my-web-app", "namespace": "default"}`

**編輯 HPA 副本範圍**：
- **Tool Name**: `kubectl_edit_hpa`
- **Parameters**: `{"hpaName": "my-web-app-hpa", "minReplicas": 2, "maxReplicas": 10, "namespace": "default"}`

**使用標籤篩選功能**：

**根據標籤篩選 Pod**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "pods", "namespace": "default", "labelSelector": "app=nginx"}`

**多條件標籤篩選**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "deployments", "namespace": "production", "labelSelector": "app=web,tier=frontend,environment=prod"}`

**使用標籤物件篩選**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "services", "labels": {"app": "nginx", "version": "1.0"}}`

**跨命名空間標籤篩選**：
- **Tool Name**: `kubectl_get`
- **Parameters**: `{"resource": "pods", "allNamespaces": true, "labelSelector": "environment!=test"}`

### Helm 工具使用範例

**取得 Helm Release 列表**：
- **Tool Name**: `helm_list`
- **Parameters**: `{}`

**取得特定命名空間的 Release**：
- **Tool Name**: `helm_list`
- **Parameters**: `{"namespace": "production"}`

**查看 Release 狀態**：
- **Tool Name**: `helm_status`
- **Parameters**: `{"releaseName": "my-app", "namespace": "default"}`

**查看 Release 配置值**：
- **Tool Name**: `helm_get_values`
- **Parameters**: `{"releaseName": "my-app", "namespace": "default"}`

**查看所有值（包括預設值）**：
- **Tool Name**: `helm_get_values`
- **Parameters**: `{"releaseName": "my-app", "allValues": true}`

**查看 Release 歷史記錄**：
- **Tool Name**: `helm_history`
- **Parameters**: `{"releaseName": "my-app", "namespace": "default"}`

**查看指定數量的歷史記錄**：
- **Tool Name**: `helm_history`
- **Parameters**: `{"releaseName": "my-app", "max": 10, "output": "json"}`

**列出 Helm Repositories**：
- **Tool Name**: `helm_repo_list`
- **Parameters**: `{}`

**以 JSON 格式查看 Repositories**：
- **Tool Name**: `helm_repo_list`
- **Parameters**: `{"output": "json"}`

## 可用工具

### kubectl_get

強大的 Kubernetes 資源取得工具，支援多種資源類型。

**參數**：
- `resource` (必需): 資源類型，支援 "pods", "nodes", "deployments", "services", "replicasets", "daemonsets", "statefulsets", "jobs", "cronjobs", "configmaps", "secrets", "pv", "pvc", "ingress", "hpa", "namespaces", "events", "serviceaccounts", "clusterroles", "clusterrolebindings"
- `namespace` (可選): Kubernetes 命名空間，適用於除了 nodes, pv, namespaces, clusterroles, clusterrolebindings 以外的所有資源（cluster-scoped 資源），預設為 "default"
- `allNamespaces` (可選): 查看所有命名空間的資源 (等同於 kubectl -A 參數，不適用於 cluster-scoped 資源)
- `name` (可選): 特定資源名稱
- `labelSelector` (可選): 標籤選擇器，使用 Kubernetes 原生語法 (例如: "app=nginx,environment!=test")
- `labels` (可選): 標籤物件，使用 JSON 格式 (例如: {"app": "nginx", "tier": "frontend"})

**注意**: `labelSelector` 和 `labels` 參數不能同時使用，請選擇其中一種方式。

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

**範例 28 - 取得所有 Namespace**：
```json
{
  "resource": "namespaces"
}
```

**範例 29 - 取得所有 ServiceAccount**：
```json
{
  "resource": "serviceaccounts",
  "namespace": "default"
}
```

**範例 30 - 取得特定 ServiceAccount**：
```json
{
  "resource": "serviceaccounts",
  "namespace": "kube-system",
  "name": "default"
}
```

**範例 31 - 取得所有命名空間的 ServiceAccount**：
```json
{
  "resource": "serviceaccounts",
  "allNamespaces": true
}
```

**範例 32 - 使用 -A 參數查看所有命名空間的 Pod**：
```json
{
  "resource": "pods",
  "allNamespaces": true
}
```

**範例 33 - 使用 -A 參數查看所有命名空間的 Deployment**：
```json
{
  "resource": "deployments",
  "allNamespaces": true
}
```

**範例 34 - 取得預設命名空間的 Event**：
```json
{
  "resource": "events",
  "namespace": "default"
}
```

**範例 35 - 取得所有命名空間的 Event**：
```json
{
  "resource": "events",
  "allNamespaces": true
}
```

**範例 36 - 取得特定 Event**：
```json
{
  "resource": "events",
  "namespace": "kube-system",
  "name": "my-pod.17a1b2c3d4e5f678"
}
```

**範例 37 - 取得所有 ClusterRole**：
```json
{
  "resource": "clusterroles"
}
```

**範例 38 - 取得特定 ClusterRole**：
```json
{
  "resource": "clusterroles",
  "name": "cluster-admin"
}
```

**範例 39 - 取得所有 ClusterRoleBinding**：
```json
{
  "resource": "clusterrolebindings"
}
```

**範例 40 - 取得特定 ClusterRoleBinding**：
```json
{
  "resource": "clusterrolebindings",
  "name": "cluster-admin"
}
```

**標籤篩選範例**

**範例 41 - 使用標籤選擇器篩選 Pod**：
```json
{
  "resource": "pods",
  "namespace": "default",
  "labelSelector": "app=nginx"
}
```

**範例 42 - 使用多個標籤條件篩選**：
```json
{
  "resource": "deployments",
  "namespace": "production",
  "labelSelector": "app=web,tier=frontend,environment=prod"
}
```

**範例 43 - 使用否定條件篩選**：
```json
{
  "resource": "pods",
  "allNamespaces": true,
  "labelSelector": "app=nginx,environment!=test"
}
```

**範例 44 - 檢查標籤存在性**：
```json
{
  "resource": "services",
  "namespace": "monitoring",
  "labelSelector": "hasMetrics,!debug"
}
```

**範例 45 - 使用標籤物件篩選**：
```json
{
  "resource": "pods",
  "namespace": "default",
  "labels": {
    "app": "nginx",
    "version": "1.0"
  }
}
```

**範例 46 - 使用前綴標籤篩選**：
```json
{
  "resource": "deployments",
  "allNamespaces": true,
  "labels": {
    "kubernetes.io/name": "my-app",
    "app.kubernetes.io/version": "v1.2.3"
  }
}
```

**範例 47 - 混合使用標籤和其他參數**：
```json
{
  "resource": "configmaps",
  "namespace": "default",
  "labelSelector": "type=config,managed-by=helm"
}
```

**詳細說明**

標籤篩選功能支援以下語法：

**標籤選擇器 (labelSelector) 語法**：
- 等值匹配：`app=nginx`
- 不等值匹配：`environment!=test`
- 存在性檢查：`hasBackup`
- 否定存在性：`!debug`
- 多條件組合：`app=nginx,tier=frontend,environment=prod`

**標籤物件 (labels) 格式**：
- 簡單鍵值對：`{"app": "nginx"}`
- 多標籤：`{"app": "nginx", "version": "1.0", "tier": "frontend"}`
- 前綴標籤：`{"kubernetes.io/name": "my-app"}`
- 存在性檢查（空值）：`{"app": "nginx", "hasBackup": ""}`

**重要限制**：
- `labelSelector` 和 `labels` 不能同時使用
- 標籤鍵最長 253 字符（含前綴）
- 標籤值最長 63 字符
- 必須符合 Kubernetes 標籤命名規範

詳細的標籤選擇器語法請參考 [Kubernetes 官方文檔](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)。

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

**Namespace 輸出範例**：
```
找到 6 個 Namespace:

• default
  狀態: Active
  建立時間: 2024-01-01T00:00:00Z

• kube-system
  狀態: Active
  建立時間: 2024-01-01T00:00:00Z

• kube-public
  狀態: Active
  建立時間: 2024-01-01T00:00:00Z

• production
  狀態: Active
  建立時間: 2024-01-01T08:00:00Z

• staging
  狀態: Active
  建立時間: 2024-01-01T08:15:00Z

• monitoring
  狀態: Active
  建立時間: 2024-01-01T08:30:00Z
```

**ServiceAccount 輸出範例**：
```
找到 5 個 ServiceAccount (命名空間: default):

• default
  Secret 數量: 1
  - default-token-abc123 (kubernetes.io/service-account-token)
  建立時間: 2024-01-01T00:00:00Z

• my-app-sa
  Secret 數量: 2
  - my-app-token-def456 (kubernetes.io/service-account-token)
  - my-app-secret-ghi789 (Opaque)
  建立時間: 2024-01-01T09:00:00Z

• deployment-manager
  Secret 數量: 1
  - deployment-token-jkl012 (kubernetes.io/service-account-token)
  建立時間: 2024-01-01T09:15:00Z

• monitoring-agent
  Secret 數量: 3
  - monitoring-token-mno345 (kubernetes.io/service-account-token)
  - monitoring-config-pqr678 (Opaque)
  - monitoring-certs-stu901 (kubernetes.io/tls)
  建立時間: 2024-01-01T10:00:00Z

• backup-service
  Secret 數量: 2
  - backup-token-vwx234 (kubernetes.io/service-account-token)
  - backup-credentials-yz567 (Opaque)
  建立時間: 2024-01-01T11:00:00Z
```

**使用 -A 參數的輸出範例**：
```
找到 25 個 Pod (所有命名空間):

命名空間: default
• my-web-app-7c8d9f5b6-abc123
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T09:00:00Z
  節點: k8s-node-1

• api-service-5f6a7b8c9-def456
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T09:15:00Z
  節點: k8s-node-2

命名空間: kube-system
• coredns-76f75df574-ghi789
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T08:00:00Z
  節點: k8s-master-1

• kube-proxy-jkl012
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T08:00:00Z
  節點: k8s-node-1

命名空間: production
• web-prod-app-mno345
  狀態: Running
  Ready: 1/1
  重啟次數: 0
  建立時間: 2024-01-01T10:00:00Z
  節點: k8s-node-3
```

**Event 輸出範例**：
```
找到 8 個 Event (命名空間: default):

• my-web-app-7c8d9f5b6-abc123.17a1b2c3d4e5f678
  類型: Normal
  原因: Scheduled
  物件: Pod/my-web-app-7c8d9f5b6-abc123
  訊息: Successfully assigned default/my-web-app-7c8d9f5b6-abc123 to k8s-node-1
  來源: default-scheduler
  首次發生: 2024-01-01T12:00:00Z
  最後發生: 2024-01-01T12:00:00Z
  次數: 1

• my-web-app-7c8d9f5b6-abc123.17a1b2c3d4e5f679
  類型: Normal
  原因: Pulling
  物件: Pod/my-web-app-7c8d9f5b6-abc123
  訊息: Pulling image "nginx:1.21"
  來源: kubelet
  首次發生: 2024-01-01T12:00:01Z
  最後發生: 2024-01-01T12:00:01Z
  次數: 1

• my-web-app-7c8d9f5b6-abc123.17a1b2c3d4e5f680
  類型: Normal
  原因: Pulled
  物件: Pod/my-web-app-7c8d9f5b6-abc123
  訊息: Successfully pulled image "nginx:1.21" in 2.5s
  來源: kubelet
  首次發生: 2024-01-01T12:00:03Z
  最後發生: 2024-01-01T12:00:03Z
  次數: 1

• my-web-app-7c8d9f5b6-abc123.17a1b2c3d4e5f681
  類型: Normal
  原因: Created
  物件: Pod/my-web-app-7c8d9f5b6-abc123
  訊息: Created container nginx
  來源: kubelet
  首次發生: 2024-01-01T12:00:04Z
  最後發生: 2024-01-01T12:00:04Z
  次數: 1

• my-web-app-7c8d9f5b6-abc123.17a1b2c3d4e5f682
  類型: Normal
  原因: Started
  物件: Pod/my-web-app-7c8d9f5b6-abc123
  訊息: Started container nginx
  來源: kubelet
  首次發生: 2024-01-01T12:00:05Z
  最後發生: 2024-01-01T12:00:05Z
  次數: 1

• api-service-deployment.17a1b2c3d4e5f683
  類型: Normal
  原因: ScalingReplicaSet
  物件: Deployment/api-service-deployment
  訊息: Scaled up replica set api-service-5f6a7b8c9 to 3
  來源: deployment-controller
  首次發生: 2024-01-01T12:05:00Z
  最後發生: 2024-01-01T12:05:00Z
  次數: 1

• database-pvc.17a1b2c3d4e5f684
  類型: Warning
  原因: FailedMount
  物件: PersistentVolumeClaim/database-pvc
  訊息: Unable to attach or mount volumes: unmounted volumes=[data], unattached volumes=[data]: timed out waiting for the condition
  來源: kubelet
  首次發生: 2024-01-01T12:10:00Z
  最後發生: 2024-01-01T12:15:00Z
  次數: 5

• node-monitor-daemonset.17a1b2c3d4e5f685
  類型: Normal
  原因: SuccessfulCreate
  物件: DaemonSet/node-monitor-daemonset
  訊息: Created pod: node-monitor-daemonset-xyz789
  來源: daemonset-controller
  首次發生: 2024-01-01T12:20:00Z
  最後發生: 2024-01-01T12:20:00Z
  次數: 1
```

**ClusterRole 輸出範例**：
```
找到 68 個 ClusterRole:

• admin
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• cluster-admin
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• edit
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• view
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:node
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:node-bootstrapper
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:node-problem-detector
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:persistent-volume-provisioner
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:kube-dns
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• my-custom-role
  建立時間: 2024-01-01T10:00:00Z
  標籤: app=my-app, managed-by=helm
```

**ClusterRoleBinding 輸出範例**：
```
找到 52 個 ClusterRoleBinding:

• cluster-admin
  角色: ClusterRole/cluster-admin
  主體:
  - Group: system:masters
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:node
  角色: ClusterRole/system:node
  主體:
  - Group: system:nodes
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:kube-dns
  角色: ClusterRole/system:kube-dns
  主體:
  - ServiceAccount: kube-system/kube-dns
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• system:node-proxier
  角色: ClusterRole/system:node-proxier
  主體:
  - ServiceAccount: kube-system/kube-proxy
  建立時間: 2024-01-01T08:00:00Z
  標籤: kubernetes.io/bootstrapping=rbac-defaults

• my-app-binding
  角色: ClusterRole/my-custom-role
  主體:
  - ServiceAccount: default/my-app-sa
  - User: my-user@example.com
  建立時間: 2024-01-01T10:00:00Z
  標籤: app=my-app, managed-by=helm
```

**Cluster Info 輸出範例**：
```
叢集資訊
==================================================

**控制平面**
   端點: https://kubernetes.docker.internal:6443

**CoreDNS**
   端點: https://kubernetes.docker.internal:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

**除錯提示**
   To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.

**詳細資訊**
   使用 dump: true 參數取得完整的叢集狀態轉儲
```

### kubectl_cluster_info

取得 Kubernetes 叢集資訊，包含控制平面和服務端點。

**參數**：
- `dump` (可選): 布林值，是否取得詳細的叢集狀態轉儲資訊，預設為 false

**範例 1 - 取得基本叢集資訊**：
```json
{}
```

**範例 2 - 取得詳細叢集轉儲**：
```json
{
  "dump": true
}
```

**基本資訊輸出範例**：
```
叢集資訊
==================================================

**控制平面**
   端點: https://kubernetes.docker.internal:6443

**CoreDNS**
   端點: https://kubernetes.docker.internal:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

**除錯提示**
   To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.

**詳細資訊**
   使用 dump: true 參數取得完整的叢集狀態轉儲
```

**提示**: 使用 dump: true 可取得完整的叢集診斷資訊，包含所有節點狀態、Pod 資訊、事件等

### kubectl_get_yaml

取得 Kubernetes 資源的 YAML 格式輸出，用於檢查配置、備份或調試。

**參數**：
- `resource` (必需): 資源類型，支援 pods, nodes, deployments, services, replicasets, daemonsets, statefulsets, jobs, cronjobs, configmaps, secrets, pv, pvc, ingress, hpa, namespaces, events, serviceaccounts
- `name` (可選): 資源名稱，如果不提供則取得所有資源
- `namespace` (可選): 命名空間，僅適用於 namespace-scoped 資源
- `allNamespaces` (可選): 布林值，是否查看所有命名空間的資源

**範例 36 - 取得所有 Pod 的 YAML**：
```json
{
  "resource": "pods"
}
```

**範例 37 - 取得指定 Pod 的 YAML**：
```json
{
  "resource": "pods",
  "name": "my-app-abc123",
  "namespace": "default"
}
```

**範例 38 - 取得指定命名空間所有 Deployment 的 YAML**：
```json
{
  "resource": "deployments",
  "namespace": "production"
}
```

**範例 39 - 取得所有命名空間的 Service YAML**：
```json
{
  "resource": "services",
  "allNamespaces": true
}
```

**範例 40 - 取得 Node YAML（cluster-scoped 資源）**：
```json
{
  "resource": "nodes"
}
```

**YAML 輸出範例**：
```yaml
apiVersion: v1
items:
- apiVersion: v1
  kind: Pod
  metadata:
    creationTimestamp: "2024-01-01T10:00:00Z"
    labels:
      app: my-app
      version: v1.0.0
    name: my-app-abc123
    namespace: default
    resourceVersion: "12345"
    uid: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  spec:
    containers:
    - image: my-app:v1.0.0
      name: my-app
      ports:
      - containerPort: 8080
        protocol: TCP
      resources:
        limits:
          cpu: "1"
          memory: 1Gi
        requests:
          cpu: 100m
          memory: 128Mi
  status:
    conditions:
    - lastProbeTime: null
      lastTransitionTime: "2024-01-01T10:00:01Z"
      status: "True"
      type: Initialized
    - lastProbeTime: null
      lastTransitionTime: "2024-01-01T10:00:05Z"
      status: "True"
      type: Ready
    phase: Running
    podIP: 10.244.0.10
    startTime: "2024-01-01T10:00:01Z"
kind: List
metadata:
  resourceVersion: ""
```

**提示**:
- 使用此工具可以匯出資源配置進行備份或遷移
- YAML 輸出包含完整的資源定義和狀態資訊
- cluster-scoped 資源（如 nodes, pv, namespaces）不支援 namespace 參數

### kubectl_top_nodes

查看 Kubernetes 節點的 CPU 和記憶體使用情況，需要 metrics-server 支援。

**參數**：
- `sortBy` (可選): 排序方式，可選值為 "cpu", "memory"

**範例 41 - 查看節點資源使用情況**：
```json
{}
```

**範例 42 - 按 CPU 使用量排序**：
```json
{
  "sortBy": "cpu"
}
```

**範例 43 - 按記憶體使用量排序**：
```json
{
  "sortBy": "memory"
}
```



**成功輸出範例**：
```
節點資源使用情況
==================================================

找到 3 個節點的資源使用資訊：

NAME                 CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
docker-desktop       248m         3%     1916Mi          24%
k8s-worker-1         156m         7%     892Mi           22%
k8s-worker-2         203m         10%    1205Mi          30%

說明：
• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core
• 記憶體使用量以 Mi (Mebibytes) 為單位
• 百分比顯示相對於節點總容量的使用率

提示：
• 使用 sortBy 參數可按 cpu 或 memory 排序
• 使用 kubectl_top_pods 查看 Pod 級別的資源使用情況
```

**metrics-server 未安裝時的輸出範例**：
```
錯誤: metrics-server 未安裝。kubectl top 命令需要 metrics-server 才能工作。

安裝方法：
1. 使用官方 YAML：
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

2. 使用 Helm：
   helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
   helm upgrade --install metrics-server metrics-server/metrics-server

3. 如果是本地開發環境（如 minikube、kind），可能需要添加 --kubelet-insecure-tls 參數
```

**提示**:
- 此工具會自動檢查 metrics-server 是否安裝和運行
- 如果 metrics-server 未安裝，會提供詳細的安裝指導
- 適用於監控節點資源使用、容量規劃和性能調優

### kubectl_top_pods

查看 Kubernetes Pod 的 CPU 和記憶體使用情況，需要 metrics-server 支援。

**參數**：
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `allNamespaces` (可選): 查看所有命名空間的 Pod（不能與 namespace 同時使用）
- `sortBy` (可選): 排序方式，可選值為 "cpu", "memory"
- `containers` (可選): 顯示容器級別的資源使用情況

**範例 45 - 查看 default namespace 的 Pod 資源使用情況**：
```json
{}
```

**範例 46 - 查看指定 namespace 的 Pod**：
```json
{
  "namespace": "kube-system"
}
```

**範例 47 - 查看所有 namespace 的 Pod**：
```json
{
  "allNamespaces": true
}
```

**範例 48 - 按 CPU 使用量排序**：
```json
{
  "namespace": "kube-system",
  "sortBy": "cpu"
}
```

**範例 49 - 顯示容器級別資源使用**：
```json
{
  "namespace": "kube-system",
  "containers": true
}
```

**範例 50 - 組合參數**：
```json
{
  "allNamespaces": true,
  "sortBy": "memory",
  "containers": true
}
```

**成功輸出範例（Pod 級別）**：
```
Pod 資源使用情況
==================================================

找到 11 個 Pod 的資源使用資訊：

NAME                                     CPU(cores)   MEMORY(bytes)
======================================================================
coredns-5dd5756b68-8t2zd                 11m          31Mi
etcd-docker-desktop                      45m          89Mi
kube-apiserver-docker-desktop            98m          195Mi
kube-controller-manager-docker-desktop   32m          67Mi
kube-proxy-9x7k8                         5m           23Mi
kube-scheduler-docker-desktop            8m           45Mi

說明：
• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core
• 記憶體使用量以 Mi (Mebibytes) 為單位
• 顯示 Pod 級別的資源使用情況

提示：
• 使用 sortBy 參數可按 cpu 或 memory 排序
• 使用 containers=true 查看容器級別的資源使用情況
• 使用 allNamespaces=true 查看所有命名空間的 Pod
• 使用 kubectl_top_nodes 查看節點級別的資源使用情況
```

**成功輸出範例（容器級別）**：
```
Pod 資源使用情況
==================================================

找到 15 個容器的資源使用資訊：

POD                                      NAME                     CPU(cores)   MEMORY(bytes)
========================================================================================
coredns-5dd5756b68-8t2zd                 coredns                  11m          31Mi
etcd-docker-desktop                      etcd                     45m          89Mi
kube-apiserver-docker-desktop            kube-apiserver           98m          195Mi
kube-controller-manager-docker-desktop   kube-controller-manager  32m          67Mi

說明：
• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core
• 記憶體使用量以 Mi (Mebibytes) 為單位
• 顯示容器級別的詳細資源使用情況
• 格式：POD_NAME/CONTAINER_NAME

提示：
• 使用 sortBy 參數可按 cpu 或 memory 排序
• 使用 containers=true 查看容器級別的資源使用情況
• 使用 allNamespaces=true 查看所有命名空間的 Pod
• 使用 kubectl_top_nodes 查看節點級別的資源使用情況
```

**沒有找到資源時的輸出範例**：
```
命名空間 "default" 中沒有找到正在運行的 Pod。

提示：
• 確保指定的命名空間中有正在運行的 Pod
• 使用 kubectl_get 查看 Pod 列表：{"resource": "pods", "namespace": "default"}
• 如果是新叢集，可能需要先部署一些應用程式
```

**提示**:
- 此工具會自動檢查 metrics-server 是否安裝和運行
- 支援 namespace 範圍和跨命名空間查詢
- containers 參數提供更詳細的容器級別資源監控
- 適用於 Pod 資源監控、效能調優和容量規劃

### kubectl_top_containers

查看 Kubernetes 容器的詳細 CPU 和記憶體使用情況，專注於容器級別的資源監控，需要 metrics-server 支援。

**參數**：
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `allNamespaces` (可選): 查看所有命名空間的容器（不能與 namespace 同時使用）
- `sortBy` (可選): 排序方式，可選值為 "cpu", "memory"
- `podName` (可選): 過濾特定 Pod 的容器
- `containerName` (可選): 過濾包含特定名稱的容器（模糊匹配）

**範例 51 - 查看 default namespace 的容器**：
```json
{}
```

**範例 52 - 查看指定 namespace 的容器**：
```json
{
  "namespace": "kube-system"
}
```

**範例 53 - 查看所有 namespace 的容器 - 按 CPU 排序**：
```json
{
  "allNamespaces": true,
  "sortBy": "cpu"
}
```

**範例 54 - 過濾特定 Pod 的容器**：
```json
{
  "allNamespaces": true,
  "podName": "coredns-5dd5756b68-8t2zd"
}
```

**範例 55 - 過濾包含特定名稱的容器**：
```json
{
  "namespace": "kube-system",
  "containerName": "kube"
}
```

**範例 56 - 組合過濾和排序**：
```json
{
  "allNamespaces": true,
  "containerName": "api",
  "sortBy": "memory"
}
```

**成功輸出範例**：
```
容器資源使用情況
==================================================

找到 15 個容器的資源使用資訊：

統計摘要：
• 總 CPU 使用量：285m
• 總記憶體使用量：567Mi
• 平均 CPU 使用量：19m
• 平均記憶體使用量：38Mi
• 涉及 Pod 數量：8

NAMESPACE            POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)
============================================================================================
kube-system          coredns-5dd5756b68-8t2zd                 coredns                  11m          31Mi
kube-system          etcd-docker-desktop                      etcd                     45m          89Mi
kube-system          kube-apiserver-docker-desktop            kube-apiserver           98m          195Mi
kube-system          kube-controller-manager-docker-desktop   kube-controller-manager  32m          67Mi
kube-system          kube-proxy-9x7k8                         kube-proxy               5m           23Mi
kube-system          kube-scheduler-docker-desktop            kube-scheduler           8m           45Mi

說明：
• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core
• 記憶體使用量以 Mi (Mebibytes) 為單位
• 每一行顯示一個容器的資源使用情況
• 格式：POD_NAME/CONTAINER_NAME
• 包含所有命名空間的容器

提示：
• 使用 sortBy 參數可按 cpu 或 memory 排序
• 使用 podName 參數可過濾特定 Pod 的容器
• 使用 containerName 參數可過濾特定名稱的容器
• 使用 kubectl_top_pods 查看 Pod 級別的資源使用情況
• 使用 kubectl_top_nodes 查看節點級別的資源使用情況
```

**過濾輸出範例**：
```
容器資源使用情況
==================================================

找到 3 個容器的資源使用資訊：

統計摘要：
• 總 CPU 使用量：138m
• 總記憶體使用量：301Mi
• 平均 CPU 使用量：46m
• 平均記憶體使用量：100Mi
• 涉及 Pod 數量：3

POD                                      CONTAINER                CPU(cores)   MEMORY(bytes)
===================================================================================
kube-apiserver-docker-desktop            kube-apiserver           98m          195Mi
kube-controller-manager-docker-desktop   kube-controller-manager  32m          67Mi
kube-scheduler-docker-desktop            kube-scheduler           8m           39Mi

說明：
• CPU 使用量以 millicores (m) 為單位，1000m = 1 CPU core
• 記憶體使用量以 Mi (Mebibytes) 為單位
• 每一行顯示一個容器的資源使用情況
• 格式：POD_NAME/CONTAINER_NAME

過濾條件：
• 容器名稱包含：kube

提示：
• 使用 sortBy 參數可按 cpu 或 memory 排序
• 使用 podName 參數可過濾特定 Pod 的容器
• 使用 containerName 參數可過濾特定名稱的容器
• 使用 kubectl_top_pods 查看 Pod 級別的資源使用情況
• 使用 kubectl_top_nodes 查看節點級別的資源使用情況
```

**提示**:
- 此工具專注於容器級別的詳細資源監控和分析
- 提供統計摘要：總用量、平均用量、涉及 Pod 數量
- 支援多種過濾選項：Pod 名稱、容器名稱模糊匹配
- 比 kubectl_top_pods --containers 提供更豐富的分析功能
- 適用於微服務架構的容器資源監控和效能調優

### kubectl_scale_deployment

動態調整 Kubernetes Deployment 的副本數量，支援安全驗證、等待機制和詳細狀態追蹤。

**參數**：
- `deploymentName` (必需): Deployment 名稱
- `replicas` (必需): 目標副本數量（0-100）
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `wait` (可選): 是否等待擴縮完成，預設為 false
- `timeout` (可選): 等待超時時間（秒，30-1800），預設為 300

**範例 57 - 擴容到 3 個副本**：
```json
{
  "deploymentName": "my-web-app",
  "replicas": 3,
  "namespace": "default"
}
```

**範例 58 - 縮容到 0（停止服務）**：
```json
{
  "deploymentName": "my-api-service",
  "replicas": 0,
  "namespace": "production"
}
```

**範例 59 - 擴容並等待完成**：
```json
{
  "deploymentName": "my-worker",
  "replicas": 5,
  "namespace": "default",
  "wait": true,
  "timeout": 600
}
```

**輸出範例**：
```
Deployment 擴縮操作結果
==================================================

操作摘要：
• Deployment: my-web-app
• 命名空間: default
• 原副本數: 1 → 目標副本數: 3
• 變化: 擴容 (+2 個副本)

狀態對比：
┌────────────────────┬──────────┬──────────┐
│ 項目               │ 操作前   │ 操作後   │
├────────────────────┼──────────┼──────────┤
│ 期望副本數         │ 1        │ 3        │
│ 當前副本數         │ 1        │ 3        │
│ 就緒副本數         │ 1        │ 3        │
│ 可用副本數         │ 1        │ 3        │
└────────────────────┴──────────┴──────────┘

操作結果：
[成功] Deployment 規格已成功更新到目標副本數
[成功] 所有目標副本已就緒並可用

提示：
• 此操作未等待完成，Pod 可能仍在啟動或終止中
• 使用 kubectl_get 檢查 Deployment 狀態：{"resource": "deployments", "namespace": "default", "name": "my-web-app"}
• 使用 kubectl_get 檢查 Pod 狀態：{"resource": "pods", "namespace": "default"}
• 使用 kubectl_describe 查看詳細資訊：{"resource": "deployment", "name": "my-web-app", "namespace": "default"}
```

**安全特性**：
- 副本數限制在 0-100 範圍內
- 自動驗證 Deployment 是否存在
- 提供操作前後狀態對比
- 支援等待機制確保操作完成
- 詳細的錯誤處理和格式化輸出

**提示**:
- 設定 `wait: true` 可確保擴縮操作完全完成
- 縮容到 0 可用於暫時停止服務
- 擴容操作會創建新的 Pod，可能需要時間拉取映像
- 建議先使用 `kubectl_get` 檢查當前 Deployment 狀態
- 對於生產環境，建議設定較長的 timeout 值

### kubectl_restart_deployment

安全重啟 Kubernetes Deployment，觸發滾動更新來重新創建所有 Pod，適用於應用程式更新、設定變更或故障排除。

**參數**：
- `deploymentName` (必需): Deployment 名稱
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `wait` (可選): 是否等待重啟完成，預設為 false
- `timeout` (可選): 等待超時時間（秒，30-1800），預設為 300

**範例 60 - 基本重啟**：
```json
{
  "deploymentName": "my-web-app",
  "namespace": "default"
}
```

**範例 61 - 重啟並等待完成**：
```json
{
  "deploymentName": "my-api-service",
  "namespace": "production",
  "wait": true,
  "timeout": 600
}
```

**範例 62 - 快速重啟（開發環境）**：
```json
{
  "deploymentName": "my-dev-app",
  "namespace": "development",
  "wait": true,
  "timeout": 120
}
```

**輸出範例**：
```
Deployment 重啟操作結果
==================================================

操作摘要：
• Deployment: my-web-app
• 命名空間: default
• 副本數: 3
• 操作類型: 滾動重啟

版本資訊：
• 重啟前 Generation: 15
• 重啟後 Generation: 16
• 版本變化: 已更新

狀態對比：
┌────────────────────┬──────────┬──────────┐
│ 項目               │ 重啟前   │ 重啟後   │
├────────────────────┼──────────┼──────────┤
│ Generation         │ 15       │ 16       │
│ Observed Generation│ 15       │ 16       │
│ 總副本數           │ 3        │ 3        │
│ 已更新副本數       │ 3        │ 3        │
│ 就緒副本數         │ 3        │ 3        │
│ 可用副本數         │ 3        │ 3        │
└────────────────────┴──────────┴──────────┘

操作結果：
[成功] Deployment 規格已成功更新，觸發滾動重啟
[成功] Controller 已觀察到最新規格
[成功] 所有 Pod 已更新到最新版本
[成功] 所有 Pod 已就緒並可用

提示：
• 此操作未等待完成，Pod 可能仍在重啟中
• 使用 kubectl_get 檢查 Deployment 狀態：{"resource": "deployments", "namespace": "default", "name": "my-web-app"}
• 使用 kubectl_get 檢查 Pod 狀態：{"resource": "pods", "namespace": "default"}
• 使用 kubectl_describe 查看詳細資訊：{"resource": "deployment", "name": "my-web-app", "namespace": "default"}
• 使用 kubectl_logs 查看新 Pod 日誌
```

**重啟機制說明**：
- **滾動重啟**: 使用 `kubectl rollout restart` 命令，逐步替換 Pod
- **零停機時間**: 確保服務可用性，新 Pod 就緒後才終止舊 Pod
- **版本追蹤**: 透過 Generation 和 ObservedGeneration 追蹤重啟進度
- **狀態驗證**: 確認所有 Pod 已更新並處於就緒狀態

**使用場景**：
- 應用程式映像更新後重啟
- ConfigMap 或 Secret 變更後重啟
- 解決 Pod 異常或效能問題
- 觸發應用程式重新載入設定
- 故障排除和除錯

**安全特性**：
- 自動驗證 Deployment 是否存在
- 支援等待機制確保重啟完成
- 詳細的版本變化追蹤
- 完整的狀態對比和進度報告
- 智慧錯誤處理和格式化輸出

**提示**:
- 設定 `wait: true` 可確保重啟操作完全完成
- 重啟會觸發所有 Pod 重新創建，可能需要時間拉取映像
- 建議在非高峰時段執行重啟操作
- 使用 `kubectl_logs` 查看新 Pod 的啟動日誌
- 對於關鍵服務，建議設定較長的 timeout 值

### kubectl_edit_hpa

編輯 Kubernetes HorizontalPodAutoscaler (HPA) 的副本數量範圍，僅允許修改 minReplicas 和 maxReplicas 以確保安全性。

**參數**：
- `hpaName` (必需): HorizontalPodAutoscaler 名稱
- `minReplicas` (可選): 最小副本數量（1-100）
- `maxReplicas` (可選): 最大副本數量（1-1000）
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"
- `wait` (可選): 是否等待 HPA 狀態更新，預設為 false
- `timeout` (可選): 等待超時時間（秒，30-600），預設為 120

**範例 63 - 調整 HPA 範圍**：
```json
{
  "hpaName": "my-web-app-hpa",
  "minReplicas": 2,
  "maxReplicas": 10,
  "namespace": "default"
}
```

**範例 64 - 僅調整最大副本數**：
```json
{
  "hpaName": "my-api-hpa",
  "maxReplicas": 20,
  "namespace": "production"
}
```

**範例 65 - 調整範圍並等待更新完成**：
```json
{
  "hpaName": "my-backend-hpa",
  "minReplicas": 3,
  "maxReplicas": 15,
  "namespace": "production",
  "wait": true,
  "timeout": 180
}
```

**成功輸出範例**：
```
HorizontalPodAutoscaler 編輯操作結果
==================================================

操作摘要：
• HPA: my-web-app-hpa
• 命名空間: default
• 擴縮目標: Deployment/my-web-app
• 操作類型: 副本數量範圍調整

變更詳情：
• 最小副本數: 1 → 2 (+1)
• 最大副本數: 5 → 10 (+5)

狀態對比：
┌────────────────────┬──────────┬──────────┐
│ 項目               │ 編輯前   │ 編輯後   │
├────────────────────┼──────────┼──────────┤
│ 最小副本數         │ 1        │ 2        │
│ 最大副本數         │ 5        │ 10       │
│ 當前副本數         │ 1        │ 2        │
│ 期望副本數         │ 1        │ 2        │
│ Generation         │ 1        │ 2        │
│ Observed Generation│ 1        │ 2        │
└────────────────────┴──────────┴──────────┘

操作結果：
[成功] HPA 規格已成功更新到目標值
[成功] Controller 已觀察到最新規格
[提示] 當前副本數 (2) 低於新的最小值，HPA 可能會觸發擴容

提示：
• 此操作未等待完成，HPA 可能仍在更新中
• 使用 kubectl_get 檢查 HPA 狀態：{"resource": "hpa", "namespace": "default", "name": "my-web-app-hpa"}
• 使用 kubectl_get 檢查目標 Deployment：{"resource": "deployments", "namespace": "default"}
• 使用 kubectl_describe 查看詳細資訊：{"resource": "hpa", "name": "my-web-app-hpa", "namespace": "default"}
• HPA 將根據 CPU 使用率在 2-10 範圍內自動調整副本數
```

**等待完成的輸出範例**：
```
HorizontalPodAutoscaler 編輯操作結果
==================================================

操作摘要：
• HPA: my-api-hpa
• 命名空間: production
• 擴縮目標: Deployment/my-api
• 操作類型: 副本數量範圍調整

變更詳情：
• 最小副本數: 2 → 3 (+1)
• 最大副本數: 10 → 20 (+10)

狀態對比：
┌────────────────────┬──────────┬──────────┐
│ 項目               │ 編輯前   │ 編輯後   │
├────────────────────┼──────────┼──────────┤
│ 最小副本數         │ 2        │ 3        │
│ 最大副本數         │ 10       │ 20       │
│ 當前副本數         │ 5        │ 5        │
│ 期望副本數         │ 5        │ 5        │
│ Generation         │ 3        │ 4        │
│ Observed Generation│ 3        │ 4        │
└────────────────────┴──────────┴──────────┘

操作結果：
[成功] HPA 規格已成功更新到目標值
[成功] Controller 已觀察到最新規格
[正常] 當前副本數在新的範圍內，HPA 將根據指標動態調整

等待資訊：
• 已等待 HPA 規格更新完成

• 使用 kubectl_get 檢查 HPA 狀態：{"resource": "hpa", "namespace": "production", "name": "my-api-hpa"}
• 使用 kubectl_get 檢查目標 Deployment：{"resource": "deployments", "namespace": "production"}
• 使用 kubectl_describe 查看詳細資訊：{"resource": "hpa", "name": "my-api-hpa", "namespace": "production"}
• HPA 將根據 CPU 使用率在 3-20 範圍內自動調整副本數
```

**參數邏輯驗證**：
- 自動檢查 minReplicas 不能大於 maxReplicas
- 檢查 HPA 是否存在並取得當前狀態
- 驗證新的範圍設定是否合理
- 檢查是否有實際需要變更的參數

**擴縮影響分析**：
- 當前副本數低於新最小值：HPA 可能觸發擴容
- 當前副本數超過新最大值：HPA 可能觸發縮容
- 當前副本數在新範圍內：HPA 根據指標動態調整

**安全特性**：
- 僅允許修改 minReplicas 和 maxReplicas
- 不允許修改 CPU 閾值或其他敏感配置
- 自動驗證 HPA 存在性和參數合理性
- 支援等待機制確保更新完成
- 詳細的操作前後狀態對比和影響分析

**提示**:
- 此工具專注於安全的 HPA 副本範圍調整
- 設定 `wait: true` 可確保更新操作完全完成
- 調整範圍後，HPA 會根據當前負載自動調整到合適的副本數
- 建議根據應用的實際負載模式設定合理的範圍
- 使用 `kubectl_get` 監控 HPA 和目標 Deployment 的狀態變化

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
- `resource` (必需): 資源類型，支援 "pod", "node", "service", "deployment", "configmap", "secret", "serviceaccount", "clusterrole", "clusterrolebinding"
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

**範例 4 - 描述 ServiceAccount**：
```json
{
  "resource": "serviceaccount",
  "name": "my-app-sa",
  "namespace": "default"
}
```

**範例 5 - 描述 ClusterRole**：
```json
{
  "resource": "clusterrole",
  "name": "cluster-admin"
}
```

**範例 6 - 描述 ClusterRoleBinding**：
```json
{
  "resource": "clusterrolebinding",
  "name": "cluster-admin"
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

## Helm 工具

### helm_list

列出 Helm releases，支援多種篩選選項和輸出格式。等同於 `helm ls` 命令，支援 `-A` 參數。

**參數**：
- `namespace` (可選): Kubernetes 命名空間，預設查看 default 命名空間
- `allNamespaces` (可選): 顯示所有命名空間的 releases，等同於 `helm ls -A`（預設：true）
- `status` (可選): 按狀態篩選 releases，可選值：deployed, uninstalled, superseded, failed, pending-install, pending-upgrade, pending-rollback
- `output` (可選): 輸出格式，可選值：table, json, yaml（預設：table）
- `limit` (可選): 限制顯示的 releases 數量（1-100）
- `sortBy` (可選): 排序方式，可選值：name, namespace, revision, updated, status, chart, app_version

**範例**：
```json
// 查看所有命名空間的 releases（等同於 helm ls -A）
{
  "allNamespaces": true
}

// 查看特定狀態的 releases
{
  "allNamespaces": true,
  "status": "deployed",
  "sortBy": "updated"
}

// 查看特定命名空間的 releases
{
  "namespace": "production"
}
```

### helm_status

查看 Helm release 的詳細狀態資訊，包括部署資源和歷史。

**參數**：
- `releaseName` (必需): Helm release 名稱
- `namespace` (可選): Kubernetes 命名空間
- `revision` (可選): 指定修訂版本號（預設為最新版本）
- `showResources` (可選): 顯示相關的 Kubernetes 資源（預設：false）
- `showHooks` (可選): 顯示 Helm hooks（預設：false）

**範例**：
```json
{
  "releaseName": "my-app",
  "namespace": "production",
  "showResources": true
}
```

### helm_get_values

查看 Helm release 的配置值，支援多種輸出格式。

**參數**：
- `releaseName` (必需): Helm release 名稱
- `namespace` (可選): Kubernetes 命名空間
- `revision` (可選): 指定修訂版本號（預設為最新版本）
- `output` (可選): 輸出格式：yaml, json, table（預設：yaml）
- `allValues` (可選): 顯示所有值，包括預設值（預設：false）

**範例**：
```json
{
  "releaseName": "my-app",
  "namespace": "default",
  "allValues": true,
  "output": "json"
}
```

### helm_repo_list

列出已添加的 Helm chart repositories。

**參數**：
- `output` (可選): 輸出格式：table, json, yaml（預設：table）

**範例**：
```json
{
  "output": "json"
}
```

### helm_history

查看 Helm release 的部署歷史記錄，包括所有版本的部署狀態和變更資訊。

**參數**：
- `releaseName` (必需): Helm release 名稱
- `namespace` (可選): Kubernetes 命名空間
- `max` (可選): 顯示的歷史記錄數量上限（預設：256）
- `output` (可選): 輸出格式：table, json, yaml（預設：table）

**範例 1 - 查看基本歷史記錄**：
```json
{
  "releaseName": "my-app",
  "namespace": "default"
}
```

**範例 2 - 限制記錄數量**：
```json
{
  "releaseName": "my-app",
  "namespace": "production",
  "max": 10
}
```

**範例 3 - JSON 格式輸出**：
```json
{
  "releaseName": "my-app",
  "output": "json"
}
```

**輸出範例**：
```
Helm Release 歷史記錄
==================================================

• Release 名稱：my-app
• 命名空間：default

找到 3 個歷史記錄：

歷史記錄詳情：
==================================================

REVISION    UPDATED                     STATUS        CHART           APP VERSION    DESCRIPTION
3           Mon Jan  1 12:00:00 2024    deployed      my-app-1.2.0    1.2.0          Upgrade complete
2           Sun Dec 31 10:00:00 2023    superseded    my-app-1.1.0    1.1.0          Upgrade complete
1           Sat Dec 30 09:00:00 2023    superseded    my-app-1.0.0    1.0.0          Install complete

說明：
• REVISION：版本號碼（數字越大表示越新）
• UPDATED：部署或更新時間
• STATUS：部署狀態（deployed=已部署，failed=失敗，superseded=被取代等）
• CHART：使用的 Chart 版本
• APP VERSION：應用程式版本
• DESCRIPTION：部署描述或變更說明

提示：
• 使用 helm_status 查看當前 release 詳細資訊
• 使用 helm_get_values 查看指定版本的配置值
• 最新版本是 revision 3
```

**用途**：
- 追蹤 release 的部署歷史和版本變化
- 查看每次部署的狀態和時間
- 分析部署失敗的歷史記錄
- 準備回滾操作前的版本確認

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

### Stdio 模式 (Cursor 編輯器和命令列工具)
```bash
npm start
```
- 標準輸入/輸出模式
- 適用於 Cursor 編輯器和命令列 MCP 客戶端
- 輕量級，適合腳本使用

## Cursor 編輯器配置

### 配置 MCP 服務器

在 Cursor 編輯器中使用本 MCP Server，需要在 `~/.cursor/mcp.json` 中添加配置：

#### 1. 使用本地版本（推薦）

```json
{
  "mcpServers": {
    "k8s-mcp-server": {
      "command": "node",
      "args": [
        "/path/to/your/k8s-mcp/k8s-mcp-server/src/index.js"
      ]
    }
  }
}
```

#### 2. 使用 Docker 映像

```json
{
  "mcpServers": {
    "k8s-mcp-server": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network=host",
        "-v", "/Users/your-username/.kube:/home/nodejs/.kube:ro",
        "your-registry/kubectl-mcp-tool:latest",
        "node", "src/index.js"
      ]
    }
  }
}
```

### 使用步驟

1. **確保 kubectl 和 helm 可用**
   ```bash
   kubectl version --client
   helm version
   ```

2. **確保 kubeconfig 配置正確**
   ```bash
   kubectl get nodes
   ```

3. **重新啟動 Cursor 編輯器**

4. **在 Cursor 中使用 MCP 工具**
   - 工具會自動出現在 MCP 面板中
   - 可以直接調用 16 個 Kubernetes 和 Helm 工具

### 可用的 MCP 工具

#### Kubernetes 工具 (11項)
- `kubectl_get` - 取得 Kubernetes 資源
- `kubectl_logs` - 查看 Pod 日誌
- `kubectl_describe` - 描述資源詳細資訊
- `kubectl_cluster_info` - 查看叢集資訊
- `kubectl_get_yaml` - 取得 YAML 格式輸出
- `kubectl_top_nodes` - 節點資源監控
- `kubectl_top_pods` - Pod 資源監控
- `kubectl_top_containers` - 容器資源監控
- `kubectl_scale_deployment` - 擴縮部署
- `kubectl_restart_deployment` - 重啟部署
- `kubectl_edit_hpa` - 編輯 HPA

#### Helm 工具 (5項)
- `helm_list` - 列出 Helm releases
- `helm_status` - 查看 release 狀態
- `helm_get_values` - 查看配置值
- `helm_repo_list` - 列出 repositories
- `helm_history` - 查看部署歷史

## 開發計劃

### 已完成功能 (16項)

#### Kubernetes 工具 (11項)
- [x] **kubectl_get** - 支援 19 種資源類型
- [x] **kubectl_logs** - Pod 日誌查看
- [x] **kubectl_describe** - 資源詳細描述
- [x] **kubectl_cluster_info** - 叢集資訊查詢
- [x] **kubectl_get_yaml** - YAML 格式輸出
- [x] **kubectl_top_nodes** - 節點資源監控
- [x] **kubectl_top_pods** - Pod 資源監控
- [x] **kubectl_top_containers** - 容器資源監控
- [x] **kubectl_scale_deployment** - Deployment 擴縮
- [x] **kubectl_restart_deployment** - Deployment 重啟
- [x] **kubectl_edit_hpa** - HPA 編輯

#### Helm 工具 (5項)
- [x] **helm_list** - Release 列表
- [x] **helm_status** - Release 狀態
- [x] **helm_get_values** - Release 配置值
- [x] **helm_repo_list** - Repository 列表
- [x] **helm_history** - Release 歷史記錄

### 未來計劃 (4項)

#### 操作類工具
- [ ] **Apply YAML** - 應用 YAML 配置
- [ ] **Create Resource** - 創建資源
- [ ] **Update Resource** - 更新資源
- [ ] **Delete Resource** - 刪除資源

### 功能統計
- **已完成**: 16項工具 (Kubernetes: 11項 + Helm: 5項)
- **待開發**: 4項功能
- **總計**: 20項功能
- **完成度**: 80%

## 貢獻指南

### 開發環境設定

1. **Fork 專案**
2. **克隆專案**:
   ```bash
   git clone https://github.com/your-username/k8s-mcp-server.git
   ```
3. **安裝依賴**:
   ```bash
   cd k8s-mcp-server
   npm install
   ```
4. **建立分支**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### 程式碼風格

- 使用 ESLint 和 Prettier 保持一致的程式碼風格
- 遵循 JavaScript Standard Style
- 使用 JSDoc 撰寫文件
- 使用 TypeScript 型別註解
- 保持函數簡潔，遵循單一職責原則

### 提交規範

- 使用語意化的提交訊息
- 提交前執行測試
- 更新相關文件
- 添加必要的測試案例
- 確保 CI/CD 檢查通過

### 測試指南

1. **執行測試**:
   ```bash
   npm test
   ```

2. **檢查程式碼風格**:
   ```bash
   npm run lint
   ```

3. **執行整合測試**:
   ```bash
   npm run test:integration
   ```

### 文件貢獻

- 更新 README.md
- 添加或更新 JSDoc 註解
- 提供使用範例
- 更新 API 文件
- 添加錯誤處理說明

### 提交 Pull Request

1. 確保所有測試通過
2. 更新相關文件
3. 描述變更內容
4. 關聯相關 Issue
5. 等待審查回饋

## 授權

MIT License - 詳見 LICENSE 檔案

## 安裝

### 前置需求

- Node.js >= 16.0.0
- kubectl >= 1.20.0
- helm >= 3.0.0
- 有效的 kubeconfig 配置
- (選用) metrics-server 用於資源監控功能

### 本地安裝

```bash
# 克隆專案
git clone https://github.com/your-username/k8s-mcp-server.git

# 進入專案目錄
cd k8s-mcp-server

# 安裝依賴
npm install

# 啟動伺服器 (SSE 模式)
npm run start:http

# 或啟動伺服器 (Stdio 模式)
npm start
```

### Docker 安裝

```bash
# 建構映像
./build.sh

# 運行容器 (SSE 模式)
docker run -d --name k8s-mcp-server \
  -p 3001:3001 \
  -v ~/.kube:/home/nodejs/.kube:ro \
  your-registry/k8s-mcp-server:latest \
  npm run start:http

# 或運行容器 (Stdio 模式)
docker run -i --rm \
  -v ~/.kube:/home/nodejs/.kube:ro \
  your-registry/k8s-mcp-server:latest \
  npm start
```

### Kubernetes 部署

```bash
# 部署 MCP Server
kubectl apply -f k8s/

# 檢查部署狀態
kubectl get pods -l app=k8s-mcp-server

# 檢查服務端點
kubectl get svc k8s-mcp-server-service
```

## 使用方式

### 1. 健康檢查

```bash
# 檢查伺服器狀態
curl http://localhost:3001/health
```

### 2. SSE 連接測試

```bash
# 測試 SSE 連接
curl -N http://localhost:3001/sse
```

### 3. n8n 整合

1. 在 n8n 中添加 MCP Client 節點
2. 設定 MCP Server URL:
   ```
   http://localhost:3001/sse
   ```
3. 選擇所需的 Kubernetes 或 Helm 工具
4. 設定工具參數並執行

### 4. Cursor 編輯器整合

1. 配置 `~/.cursor/mcp.json`:
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
2. 重啟 Cursor 編輯器
3. 在 MCP 面板中使用工具
```

## 工具說明

### Kubernetes 工具

#### 1. kubectl_get
- **功能**: 取得 Kubernetes 資源
- **支援資源**: pods, nodes, deployments, services 等 19 種資源類型
- **特色**: 支援標籤篩選、命名空間過濾、格式化輸出
- **使用場景**: 資源查詢、狀態監控、問題診斷

#### 2. kubectl_logs
- **功能**: 查看 Pod 日誌
- **特色**: 支援容器選擇、時間範圍過濾、行數限制
- **使用場景**: 應用程式除錯、日誌分析、問題追蹤

#### 3. kubectl_describe
- **功能**: 描述資源詳細資訊
- **支援資源**: pod, node, service, deployment 等
- **特色**: 完整的資源狀態和事件記錄
- **使用場景**: 深入分析資源、故障排除

#### 4. kubectl_cluster_info
- **功能**: 查看叢集資訊
- **特色**: 包含控制平面和核心服務端點
- **使用場景**: 叢集狀態檢查、連接測試

#### 5. kubectl_get_yaml
- **功能**: 取得資源 YAML 格式輸出
- **特色**: 支援多種資源類型、格式化輸出
- **使用場景**: 配置檢查、資源備份、模板製作

#### 6-8. kubectl_top 系列
- **功能**: 資源使用監控 (nodes/pods/containers)
- **特色**: 支援 CPU 和記憶體使用量監控
- **前置需求**: 需要 metrics-server
- **使用場景**: 效能監控、容量規劃、異常檢測

#### 9. kubectl_scale_deployment
- **功能**: 擴縮 Deployment 副本數量
- **特色**: 支援等待完成、超時設定
- **使用場景**: 負載調整、服務擴容、成本優化

#### 10. kubectl_restart_deployment
- **功能**: 重啟 Deployment (滾動更新)
- **特色**: 零停機時間、支援等待完成
- **使用場景**: 配置更新、映像更新、故障恢復

#### 11. kubectl_edit_hpa
- **功能**: 編輯 HPA 副本數量範圍
- **特色**: 安全的參數驗證、支援等待完成
- **使用場景**: 自動擴縮調整、效能優化

### Helm 工具

#### 1. helm_list
- **功能**: 列出 Helm releases
- **特色**: 支援多種篩選和排序選項
- **使用場景**: Release 管理、狀態監控

#### 2. helm_status
- **功能**: 查看 release 狀態
- **特色**: 詳細的部署資訊和資源狀態
- **使用場景**: 部署驗證、問題診斷

#### 3. helm_get_values
- **功能**: 查看 release 配置值
- **特色**: 支援多種輸出格式
- **使用場景**: 配置檢查、值覆蓋驗證

#### 4. helm_repo_list
- **功能**: 列出 Helm repositories
- **特色**: 支援多種輸出格式
- **使用場景**: Repository 管理

#### 5. helm_history
- **功能**: 查看 release 部署歷史
- **特色**: 完整的版本和變更記錄
- **使用場景**: 版本追蹤、回滾準備