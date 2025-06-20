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
- **Tool Name**: `kubectl_get_pods`
- **Parameters**: `{"namespace": "default"}` (可選)

## 🛠️ 可用工具

### kubectl_get_pods

取得指定命名空間中的 Kubernetes Pod 列表。

**參數**：
- `namespace` (可選): Kubernetes 命名空間，預設為 "default"

**範例**：
```json
{
  "namespace": "kube-system"
}
```

**輸出**：
```
📦 找到 12 個 Pod (命名空間: kube-system):

• coredns-76f75df574-abc123
  狀態: Running
  Ready: 1/1
  建立時間: 2024-01-01T10:00:00Z

• kube-proxy-xyz789
  狀態: Running
  Ready: 1/1
  建立時間: 2024-01-01T10:00:00Z
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

- [x] 基本 kubectl get pods 工具
- [ ] 更多 kubectl 操作 (describe, logs, exec)
- [ ] Helm 圖表管理
- [ ] 叢集監控工具
- [ ] 認證和權限管理
- [ ] 配置檔案支援

## 📄 授權

MIT License - 詳見 LICENSE 檔案