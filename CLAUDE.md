# K8s MCP Server - 專案設定

## 專案概述

**k8s-mcp-server** 是一個 Model Context Protocol (MCP) 伺服器，專為 Kubernetes 和 Helm 環境管理設計。透過 MCP 協議將 K8s/Helm 管理功能暴露給 AI 客戶端（n8n、Dify），實現智能化容器編排平台管理。

### 核心功能
- 17 個 MCP 工具（Kubectl 11 個、Helm 5 個、叢集管理 2 個）
- 多傳輸模式：Stdio、SSE（n8n）、Streamable HTTP（Dify）
- 多叢集支援：本地叢集、GKE 叢集
- **動態叢集注入**：自動將可用叢集清單注入工具 schema，讓 AI 客戶端自動識別可選叢集
- 資源監控、擴縮容、日誌查看等完整 K8s 管理功能

---

## 技術棧

| 類別 | 技術 |
|------|------|
| **語言** | Node.js (JavaScript ES6+) |
| **框架** | Express 4.x |
| **協議** | MCP 2024-11-05、JSON-RPC 2.0 |
| **驗證** | Zod |
| **Node 版本** | >= 18.0.0 |
| **系統依賴** | kubectl >= 1.20、helm >= 3.0、gcloud CLI |

---

## DD 流程設定

> **規範文檔位置**: `~/.claude/commands/dd-*.md`
> **查看完整說明**: 執行 `/dd-help`

### 啟用的文檔驅動方法

| 階段 | DD 模式 | 說明 |
|------|---------|------|
| 需求分析 | **RDD** | 需求驅動開發 |
| 架構設計 | **SDD + DDD + ADD + EDD** | 規格/領域/決策/範例 |
| 開發實作 | **DbC + CDD + PDD** | 契約/組件/提示詞 |
| 測試審查 | **TDD + BDD + ATDD + FDD** | 測試/行為/驗收/失敗 |

### DD 命令速查

| 命令 | 說明 |
|------|------|
| `/dd-help` | 顯示完整使用手冊 |
| `/dd-init` | 初始化專案結構 |
| `/dd-start <需求>` | 啟動流程（需求分析） |
| `/dd-arch` | 進入架構設計 |
| `/dd-approve` | 確認架構，開始自動開發 |
| `/dd-revise` | 修改架構設計 |
| `/dd-dev` | 手動觸發開發 |
| `/dd-test` | 手動觸發測試 |
| `/dd-status` | 查看目前進度 |
| `/dd-stop` | 中斷流程 |

### DD 流程圖

```
/dd-init → /dd-start → /dd-arch → ⏸️ 等待確認
                                       │
                 ┌─────────────────────┴──────────────────┐
                 │                                        │
            /dd-approve                              /dd-revise
                 │                                        │
                 ▼                                        │
           自動開發測試 ◀─────────────────────────────────┘
                 │
                 ▼
        ✅ 完成 或 ❌ 失敗重試
```

### 開發模式
- **模式**: 後端 API / MCP 伺服器
- **測試策略**: 單元測試 + 整合測試
- **部署方式**: Docker 容器化

---

## 目錄結構

```
k8s-mcp-server/
├── src/                          # 原始碼
│   ├── index.js                  # 應用程式入口
│   ├── server.js                 # MCP + Express 伺服器核心（含動態叢集注入）
│   ├── tools/                    # MCP 工具模組 (17 個)
│   │   ├── base-tool.js          # 工具基類
│   │   ├── kubectl-*.js          # Kubectl 工具
│   │   ├── helm-*.js             # Helm 工具
│   │   ├── cluster-list.js       # 叢集列表
│   │   └── gke-auth.js           # GKE 認證
│   ├── utils/                    # 工具函式
│   │   ├── logger.js             # 結構化日誌
│   │   ├── validator.js          # 輸入驗證
│   │   ├── kubectl.js            # kubectl 執行器
│   │   ├── helm.js               # helm 執行器
│   │   └── cluster-manager.js    # 多叢集管理
│   └── config/
│       └── clusters.json         # 叢集配置
├── claude_docs/                  # DD Pipeline 文檔
│   ├── requirements/             # 需求文檔 (RDD)
│   ├── architecture/             # 架構文檔 (SDD/DDD)
│   ├── contracts/                # API 契約 (DbC)
│   ├── decisions/                # 架構決策記錄 (ADD)
│   ├── examples/                 # 行為範例 (EDD)
│   ├── design/                   # UI/UX 設計
│   └── reports/                  # 測試報告
├── package.json
├── Dockerfile
├── CLAUDE.md                     # 本檔案
└── PROJECT_STATE.md              # 流程狀態追蹤
```

---

## 程式碼規範

### 命名慣例
- **檔案**: kebab-case（如 `kubectl-get.js`）
- **類別**: PascalCase（如 `KubectlGetTool`）
- **函式/變數**: camelCase（如 `executeCommand`）
- **常數**: UPPER_SNAKE_CASE（如 `DEFAULT_TIMEOUT`）

### 工具開發規範
1. 所有工具繼承 `BaseTool` 類別
2. 實作 `execute(args)` 方法
3. 定義 `getDefinition()` 返回工具 schema
4. 使用 `validator.js` 驗證所有輸入
5. 使用 `logger.js` 記錄操作日誌

### 安全規範
- 禁止危險字元注入（`;`, `|`, `&`, `$`, `` ` ``, `>`, `<`）
- 所有 Kubernetes 標籤須符合命名規則
- 長度限制：namespace/resource 253 字元、標籤值 63 字元
- Docker 使用非 root 用戶執行

### 錯誤處理
- 前置條件錯誤轉換為工具回應（AI 可讀取）
- 所有錯誤包含結構化日誌
- 優雅關閉處理 SIGTERM/SIGINT

---

## 常用指令

```bash
# 開發
npm install          # 安裝依賴
npm run dev          # 開發模式（調試日誌）
npm start            # 標準模式（stdio）
npm run start:http   # HTTP 伺服器模式

# 測試
npm test             # 執行測試
node test-dify.js    # Dify 相容性測試
node test-n8n.js     # n8n 相容性測試

# Docker
docker build -t k8s-mcp-server .
docker run -p 3000:3000 -v ~/.kube/config:/home/nodejs/.kube/config:ro k8s-mcp-server
```

---

## 相關文檔

- [README.md](./README.md) - 英文文檔
- [README_TW.md](./README_TW.md) - 繁體中文文檔（詳細）
- [PROJECT_STATE.md](./PROJECT_STATE.md) - DD 流程狀態追蹤
