# K8s MCP Server - 系統架構文檔

> 版本：1.0.0
> 更新日期：2025-12-17
> 文檔類型：SDD/DDD (Specification/Domain Driven Design)

---

## 1. 系統概覽

### 1.1 架構風格

**Modular Monolith（模組化單體架構）**

此專案採用模組化單體架構，適合中小型專案。雖然是單一部署單元，但內部高度模組化，各模組職責清晰、耦合度低。

**選擇依據**：
- 團隊規模較小，不需要微服務的複雜性
- 部署簡單，維護成本低
- 通過模組化設計保持代碼可維護性
- 支援多種傳輸模式（Stdio、SSE、HTTP）增加彈性

### 1.2 主要模組

```
k8s-mcp-server/
├── 入口層 (Entry Layer)
│   └── index.js - 應用程式啟動、參數解析、生命週期管理
│
├── 伺服器層 (Server Layer)
│   └── server.js - MCP 協議處理、HTTP/SSE 伺服器、請求路由
│
├── 工具層 (Tools Layer)
│   ├── base-tool.js - 工具基類、統一介面定義
│   ├── kubectl-*.js (11 個) - Kubernetes 操作工具
│   ├── helm-*.js (5 個) - Helm 管理工具
│   └── cluster-*.js (2 個) - 叢集管理工具
│
└── 工具層 (Utils Layer)
    ├── logger.js - 結構化日誌
    ├── validator.js - 輸入驗證與安全防護
    ├── kubectl.js - kubectl 命令執行器
    ├── helm.js - helm 命令執行器
    └── cluster-manager.js - 多叢集配置與認證
```

---

## 2. 分層架構圖

```mermaid
graph TB
    subgraph "外部客戶端"
        A1[AI Agent - Claude]
        A2[AI Platform - n8n]
        A3[AI Platform - Dify]
    end

    subgraph "傳輸層 Transport Layer"
        T1[Stdio Transport]
        T2[SSE Transport]
        T3[HTTP Transport]
    end

    subgraph "協議層 Protocol Layer"
        P1[MCP Server Core]
        P2[JSON-RPC 2.0 Handler]
        P3[Express Middleware]
    end

    subgraph "服務層 Service Layer"
        S1[Tool Registry]
        S2[Message Router]
        S3[Session Manager]
        S4[Error Handler]
    end

    subgraph "業務邏輯層 Business Logic Layer"
        B1[Kubectl Tools - 11 個]
        B2[Helm Tools - 5 個]
        B3[Cluster Tools - 2 個]
        B4[BaseTool - 基類]
    end

    subgraph "執行層 Execution Layer"
        E1[Kubectl Runner]
        E2[Helm Runner]
        E3[Cluster Manager]
    end

    subgraph "支援層 Support Layer"
        U1[Validator - 輸入驗證]
        U2[Logger - 結構化日誌]
        U3[Config - 叢集配置]
    end

    subgraph "基礎設施層 Infrastructure Layer"
        I1[kubectl CLI]
        I2[helm CLI]
        I3[gcloud CLI]
        I4[Kubernetes API]
        I5[GKE Clusters]
    end

    A1 --> T1
    A2 --> T2
    A3 --> T3

    T1 --> P1
    T2 --> P3
    T3 --> P3

    P1 --> S2
    P2 --> S2
    P3 --> S1

    S1 --> B1
    S2 --> B2
    S3 --> B3
    S4 --> B4

    B1 --> E1
    B2 --> E2
    B3 --> E3

    E1 --> U1
    E1 --> U2
    E2 --> U1
    E3 --> U3

    E1 --> I1
    E2 --> I2
    E3 --> I3

    I1 --> I4
    I2 --> I4
    I3 --> I5
```

---

## 3. 資料流圖

```mermaid
sequenceDiagram
    participant Client as AI 客戶端
    participant Transport as 傳輸層
    participant MCP as MCP 伺服器
    participant Tool as 工具實例
    participant Validator as 驗證器
    participant ClusterMgr as 叢集管理器
    participant Executor as 命令執行器
    participant K8s as Kubernetes

    Client->>Transport: 1. MCP 請求 (JSON-RPC)
    Transport->>MCP: 2. 解析請求

    alt 初始化階段
        MCP->>Client: 返回伺服器資訊
    else 工具列表請求
        MCP->>Client: 返回 17 個工具定義
    else 工具執行請求
        MCP->>Tool: 3. 路由到對應工具
        Tool->>Validator: 4. 驗證輸入參數

        alt 驗證失敗
            Validator-->>Tool: 拋出驗證錯誤
            Tool-->>Client: 返回錯誤響應
        else 驗證成功
            Tool->>ClusterMgr: 5. 前置條件檢查

            alt GKE 叢集未認證
                ClusterMgr-->>Tool: 拋出 PrerequisiteError
                Tool-->>Client: 返回認證提示
            else 叢集就緒
                Tool->>Executor: 6. 構建命令
                Executor->>ClusterMgr: 7. 添加叢集上下文
                Executor->>K8s: 8. 執行 kubectl/helm
                K8s-->>Executor: 9. 返回結果
                Executor-->>Tool: 10. 解析輸出
                Tool-->>MCP: 11. 格式化響應
                MCP-->>Client: 12. 返回結果
            end
        end
    end
```

---

## 4. 部署架構

```mermaid
graph TB
    subgraph "容器環境 Docker"
        subgraph "應用容器"
            APP[Node.js 應用<br/>k8s-mcp-server]
            KUBECTL[kubectl CLI]
            HELM[helm CLI]
            GCLOUD[gcloud CLI]
        end

        subgraph "Volume Mounts"
            V1[~/.kube/config<br/>唯讀]
            V2[clusters.json<br/>唯讀]
            V3[GKE Service Account Keys<br/>唯讀]
        end
    end

    subgraph "外部連接"
        C1[AI 客戶端<br/>Stdio]
        C2[n8n<br/>SSE]
        C3[Dify<br/>HTTP]
    end

    subgraph "Kubernetes 叢集"
        K1[本地叢集<br/>Docker Desktop]
        K2[GKE 叢集 1]
        K3[GKE 叢集 2]
    end

    C1 -.Stdio.-> APP
    C2 -.SSE.-> APP
    C3 -.HTTP.-> APP

    V1 --> APP
    V2 --> APP
    V3 --> APP

    APP --> KUBECTL
    APP --> HELM
    APP --> GCLOUD

    KUBECTL --> K1
    KUBECTL --> K2
    HELM --> K1
    HELM --> K2
    GCLOUD --> K3
```

---

## 5. 模組詳細說明

### 5.1 入口層 (Entry Layer)

**檔案**: `src/index.js`

**職責**:
- 應用程式生命週期管理
- 命令列參數解析 (`--http`, `--port`)
- 環境變數設定 (`NODE_ENV`, `LOG_LEVEL`)
- 優雅關閉處理 (SIGTERM/SIGINT)
- 全域錯誤捕獲 (uncaughtException, unhandledRejection)

### 5.2 伺服器層 (Server Layer)

**檔案**: `src/server.js`

**職責**:
- MCP 協議實作 (2024-11-05 版本)
- JSON-RPC 2.0 訊息處理
- 多傳輸模式支援 (Stdio/SSE/HTTP)
- 工具註冊與路由
- SSE 連接管理

**核心函數**:
```javascript
setupMCPServer()         // 初始化 MCP 伺服器與工具
createMCPHandler()       // MCP 訊息處理器
createExpressApp()       // Express + SSE 應用
createMCPServer(config)  // 統一入口
```

**HTTP 端點**:
| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/sse` | GET | SSE 連接建立 (n8n) |
| `/messages` | POST | MCP 訊息接收 (SSE 模式) |
| `/mcp` | POST/GET | 直接 MCP 調用 (Dify) |
| `/tools` | GET | 工具列表查詢 |
| `/info` | GET | 伺服器資訊 |
| `/sse-status` | GET | SSE 連接狀態 |

### 5.3 工具層 (Tools Layer)

#### 5.3.1 工具基類 (BaseTool)

**檔案**: `src/tools/base-tool.js`

**設計模式**: Template Method Pattern

**提供功能**:
- 前置條件檢查 (`validatePrerequisites`)
- 統一響應格式 (`createSuccessResponse`, `createErrorResponse`)
- 結構化日誌 (`logSuccess`, `logError`)
- 自定義錯誤類型 (`PrerequisiteError`)

**類別結構**:
```javascript
class BaseTool {
  constructor(name, description)
  getDefinition()           // 抽象方法
  execute(args)             // 抽象方法
  validatePrerequisites()   // 前置條件檢查
  createSuccessResponse()   // 成功響應
  createErrorResponse()     // 錯誤響應
}
```

#### 5.3.2 工具分類

**Kubectl 工具 (11 個)**:
| 工具 | 檔案 | 功能 |
|------|------|------|
| kubectl_get | kubectl-get.js | 資源查詢 |
| kubectl_logs | kubectl-logs.js | Pod 日誌 |
| kubectl_describe | kubectl-describe.js | 資源描述 |
| kubectl_cluster_info | kubectl-cluster-info.js | 叢集資訊 |
| kubectl_get_yaml | kubectl-get-yaml.js | YAML 匯出 |
| kubectl_top_nodes | kubectl-top-nodes.js | 節點監控 |
| kubectl_top_pods | kubectl-top-pods.js | Pod 監控 |
| kubectl_top_containers | kubectl-top-containers.js | 容器監控 |
| kubectl_scale_deployment | kubectl-scale-deployment.js | 擴縮容 |
| kubectl_restart_deployment | kubectl-restart-deployment.js | 重啟 |
| kubectl_edit_hpa | kubectl-edit-hpa.js | HPA 編輯 |

**Helm 工具 (5 個)**:
| 工具 | 檔案 | 功能 |
|------|------|------|
| helm_list | helm-list.js | Release 列表 |
| helm_status | helm-status.js | Release 狀態 |
| helm_repo_list | helm-repo-list.js | 倉庫列表 |
| helm_get_values | helm-get-values.js | 配置值 |
| helm_history | helm-history.js | 歷史記錄 |

**叢集管理工具 (2 個)**:
| 工具 | 檔案 | 功能 |
|------|------|------|
| cluster_list | cluster-list.js | 叢集列表 |
| gke_auth | gke-auth.js | GKE 認證 |

### 5.4 工具函式層 (Utils Layer)

#### 5.4.1 日誌模組 (Logger)

**檔案**: `src/utils/logger.js`

**功能**:
- 結構化 JSON 日誌輸出
- 日誌等級過濾 (debug/info/warn/error)
- Error 物件序列化
- ISO 時間戳

#### 5.4.2 驗證模組 (Validator)

**檔案**: `src/utils/validator.js`

**安全功能**:
- 危險字元檢測
- 輸入長度限制 (1000 字元)
- Kubernetes 命名規則驗證
- 標籤格式驗證
- 叢集 ID 格式檢查

#### 5.4.3 命令執行器

**檔案**: `src/utils/kubectl.js`, `src/utils/helm.js`

**功能**:
- 命令構建與參數組裝
- 叢集上下文自動添加
- 超時控制 (kubectl: 30s, helm: 60s)
- 標準輸出/錯誤處理
- 優雅的進程終止

#### 5.4.4 叢集管理器

**檔案**: `src/utils/cluster-manager.js`

**職責**:
- 叢集配置載入與驗證
- GKE 認證流程管理
- 叢集切換與上下文管理
- 前置條件檢查
- 認證狀態緩存

**GKE 認證流程**:
```
1. gcloud auth activate-service-account
2. gcloud container clusters get-credentials
3. kubectl config use-context
4. kubectl cluster-info (驗證)
5. 設定緩存 + 等待穩定
```

---

## 6. 第三方整合

### 6.1 系統依賴

| 依賴 | 版本 | 用途 |
|------|------|------|
| kubectl | >= 1.20 | Kubernetes 命令列工具 |
| helm | >= 3.0 | Kubernetes 套件管理器 |
| gcloud CLI | 最新 | Google Cloud SDK |
| gke-gcloud-auth-plugin | 最新 | GKE 認證外掛 |

### 6.2 Node.js 依賴

```json
{
  "@modelcontextprotocol/sdk": "^1.13.0",
  "express": "^4.18.2",
  "zod": "^3.22.4",
  "node-fetch": "^3.3.2"
}
```

### 6.3 MCP 協議方法

| 方法 | 用途 |
|------|------|
| initialize | 初始化握手 |
| notifications/initialized | 初始化完成通知 |
| tools/list | 工具列表查詢 |
| tools/call | 工具執行請求 |
| resources/list | 資源列表 (空實作) |
| prompts/list | 提示模板列表 (空實作) |
| ping | 伺服器心跳 |

---

## 7. 架構優勢與限制

### 7.1 優勢

| 面向 | 說明 |
|------|------|
| 模組化設計 | 清晰分層，職責分明 |
| 安全性 | 多層驗證，命令注入防護 |
| 可維護性 | 結構化日誌，統一錯誤處理 |
| 擴展性 | 多傳輸模式，工具易於新增 |

### 7.2 限制

| 面向 | 說明 |
|------|------|
| 性能 | CLI 執行比直接 API 慢 |
| 擴展性 | 單體架構，無法水平擴展 |
| 功能 | 不支援 apply/patch 等複雜操作 |
| 依賴 | 強依賴外部 CLI 工具 |

---

## 8. 檔案索引

| 檔案 | 路徑 | 用途 |
|------|------|------|
| 主程式 | `src/index.js` | 應用入口 |
| 伺服器 | `src/server.js` | MCP + Express |
| 工具基類 | `src/tools/base-tool.js` | 工具基類 |
| 執行器 | `src/utils/kubectl.js` | kubectl 執行 |
| 執行器 | `src/utils/helm.js` | helm 執行 |
| 叢集管理 | `src/utils/cluster-manager.js` | 多叢集管理 |
| 驗證器 | `src/utils/validator.js` | 輸入驗證 |
| 日誌器 | `src/utils/logger.js` | 結構化日誌 |
| 配置 | `src/config/clusters.json` | 叢集定義 |
