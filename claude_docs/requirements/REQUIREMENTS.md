# K8s MCP Server - 需求規格書

> 版本：1.0.0
> 更新日期：2025-12-17
> 文檔類型：RDD (Requirements Driven Development)

---

## 1. 專案概述

**k8s-mcp-server** 是一個 Model Context Protocol (MCP) 伺服器，專為 Kubernetes 和 Helm 環境管理設計。透過 MCP 協議將 K8s/Helm 管理功能暴露給 AI 客戶端（n8n、Dify），實現智能化容器編排平台管理。

---

## 2. 使用者故事

### 2.1 資源監控與管理

#### US-001: 資源狀態查詢
- **作為** DevOps 工程師
- **我想要** 快速查詢叢集中的 Pod、Deployment、Service 等資源狀態
- **以便** 監控應用程式部署狀態，快速發現異常

**驗收標準**：
- [ ] 支援 19 種 Kubernetes 資源類型查詢
- [ ] 支援按命名空間過濾
- [ ] 支援標籤選擇器過濾
- [ ] 返回結構化的 JSON/YAML 格式

#### US-002: Pod 日誌診斷
- **作為** 開發人員或運維人員
- **我想要** 即時查看 Pod 日誌（支援時間過濾、行數限制）
- **以便** 快速診斷應用程式故障

**驗收標準**：
- [ ] 支援指定容器日誌查看
- [ ] 支援時間範圍過濾 (since)
- [ ] 支援行數限制 (1-1000)
- [ ] 支援查看前一個實例日誌 (previous)

#### US-003: 資源使用率監控
- **作為** 平台管理員
- **我想要** 監控 Node、Pod、Container 的 CPU 和記憶體使用情況
- **以便** 進行容量規劃和效能優化

**驗收標準**：
- [ ] 支援 Node 級別資源監控
- [ ] 支援 Pod 級別資源監控
- [ ] 支援 Container 級別資源監控
- [ ] 支援按 CPU/Memory 排序

#### US-004: 資源擴縮容
- **作為** SRE
- **我想要** 動態調整 Deployment 副本數和 HPA 限制
- **以便** 應對流量變化和進行應急擴容

**驗收標準**：
- [ ] 支援 Deployment 副本數調整 (0-100)
- [ ] 支援 HPA min/max 調整
- [ ] 支援等待完成選項
- [ ] 支援超時設定

#### US-005: Deployment 重啟
- **作為** 運維工程師
- **我想要** 觸發 Deployment 滾動重啟
- **以便** 應用配置變更或清除問題實例

**驗收標準**：
- [ ] 觸發滾動重啟
- [ ] 支援等待完成選項
- [ ] 返回重啟狀態和 Pod 更新進度

### 2.2 Helm 應用管理

#### US-006: Release 管理
- **作為** DevOps 工程師
- **我想要** 列表和監控 Helm releases 的狀態與版本
- **以便** 追蹤應用程式部署版本和升級歷史

**驗收標準**：
- [ ] 支援跨命名空間列表
- [ ] 支援狀態過濾 (deployed/failed/etc.)
- [ ] 支援名稱過濾
- [ ] 返回最多 1000 個結果

#### US-007: 配置審查
- **作為** 應用程式架構師
- **我想要** 檢視 Helm release 的實際配置值和歷史記錄
- **以便** 審查和驗證應用程式配置

**驗收標準**：
- [ ] 支援查看當前配置值
- [ ] 支援查看含預設值的完整配置
- [ ] 支援查看歷史版本配置
- [ ] 支援 YAML/JSON/Table 輸出格式

### 2.3 多叢集管理

#### US-008: 叢集切換
- **作為** 雲端架構師
- **我想要** 在多個叢集（本地、GKE）之間切換並執行操作
- **以便** 統一管理多環境（開發、測試、生產）

**驗收標準**：
- [ ] 列出所有可用叢集
- [ ] 顯示叢集配置和狀態
- [ ] 支援 table/detailed/json 輸出格式

#### US-009: GKE 認證
- **作為** GCP 使用者
- **我想要** 透過 Service Account 自動認證到 GKE 叢集
- **以便** 簡化跨雲端環境的認證流程

**驗收標準**：
- [ ] 支援 Service Account 認證
- [ ] 認證後自動驗證連線
- [ ] 支援指定區域覆蓋

---

## 3. 功能性需求

### 3.1 Kubectl 工具 (11 個)

| 工具名稱 | 功能 | 優先級 |
|---------|------|--------|
| kubectl_get | 資源查詢（支援標籤過濾） | P0 |
| kubectl_logs | Pod 日誌查看 | P0 |
| kubectl_describe | 資源詳細描述 | P0 |
| kubectl_cluster_info | 叢集資訊查詢 | P1 |
| kubectl_get_yaml | 資源 YAML 匯出 | P1 |
| kubectl_top_nodes | 節點資源監控 | P1 |
| kubectl_top_pods | Pod 資源監控 | P1 |
| kubectl_top_containers | 容器資源監控 | P2 |
| kubectl_scale_deployment | Deployment 擴縮容 | P1 |
| kubectl_restart_deployment | Deployment 重啟 | P1 |
| kubectl_edit_hpa | HPA 配置編輯 | P2 |

### 3.2 Helm 工具 (5 個)

| 工具名稱 | 功能 | 優先級 |
|---------|------|--------|
| helm_list | Release 列表 | P0 |
| helm_status | Release 狀態查詢 | P0 |
| helm_repo_list | Repository 列表 | P1 |
| helm_get_values | Release 配置值 | P1 |
| helm_history | Release 歷史記錄 | P2 |

### 3.3 叢集管理工具 (2 個)

| 工具名稱 | 功能 | 優先級 |
|---------|------|--------|
| cluster_list | 可用叢集列表 | P0 |
| gke_auth | GKE 叢集認證 | P1 |

### 3.4 支援的 Kubernetes 資源類型

```
pods, nodes, deployments, services, replicasets,
daemonsets, statefulsets, jobs, cronjobs, configmaps,
secrets, pv, pvc, ingress, hpa, namespaces, events,
serviceaccounts, clusterroles, clusterrolebindings
```

---

## 4. 非功能性需求

### 4.1 效能需求

| 指標 | 規格 | 說明 |
|------|------|------|
| kubectl 執行超時 | 30 秒 | 單次 kubectl 命令 |
| helm 執行超時 | 60 秒 | 單次 helm 命令 |
| GKE 認證超時 | 300 秒 | 完整認證流程 |
| SSE 連接數限制 | 100 個 | 最大同時連接 |
| 請求大小限制 | 1 MB | HTTP 請求體 |
| 日誌行數限制 | 1-1000 行 | kubectl logs |

### 4.2 安全需求

| 安全面向 | 實現方式 |
|---------|---------|
| 輸入驗證 | 危險字元阻止、長度限制、型別檢查 |
| 命令注入防護 | 使用 spawn 而非 exec、參數陣列化 |
| 權限控制 | 遵循 Kubernetes RBAC |
| 敏感資訊保護 | Key 檔案唯讀、kubeconfig 隔離 |
| 容器安全 | 非 root 用戶執行 |

**禁止字元**：`;`, `|`, `&`, `>`, `<`, `` ` ``, `$`, `(`, `)`

### 4.3 可靠性需求

| 指標 | 規格 |
|------|------|
| 優雅關閉 | 支援 SIGTERM/SIGINT |
| 錯誤追蹤 | 結構化 JSON 日誌 |
| 健康檢查 | `/health`, `/info` 端點 |
| 前置條件檢查 | PrerequisiteError 機制 |

### 4.4 相容性需求

| 標準 | 版本 |
|------|------|
| MCP 協議 | 2024-11-05 |
| JSON-RPC | 2.0 |
| Node.js | >= 18.0.0 |
| kubectl | >= 1.20 |
| helm | >= 3.0 |

### 4.5 平台整合需求

| 平台 | 傳輸方式 | 端點 |
|------|---------|------|
| n8n | SSE | `/sse` + `/messages` |
| Dify | HTTP Streamable | `/mcp` |
| 原生 | Stdio | 標準輸入輸出 |

---

## 5. 輸入驗證規則

### 5.1 資源名稱
- 正則：`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
- 長度：最大 253 字元
- 字元：小寫字母、數字、連字號

### 5.2 標籤鍵
- 支援前綴格式 (如 `example.com/key`)
- 前綴最大 253 字元
- 本地部分最大 63 字元

### 5.3 標籤值
- 正則：`^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$`
- 長度：最大 63 字元
- 允許空值

### 5.4 叢集 ID
- 正則：`^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$`
- 長度：最大 64 字元
- 禁止連續特殊字元
- 禁止保留詞

---

## 6. 錯誤處理需求

### 6.1 錯誤類型

| 類型 | 處理方式 |
|------|---------|
| 驗證錯誤 | 返回明確錯誤訊息 |
| 前置條件錯誤 | 轉換為工具回應讓 AI 處理 |
| 執行錯誤 | 返回 stderr 內容 |
| 逾時錯誤 | 返回超時提示 |

### 6.2 PrerequisiteError 機制

當叢集認證狀態不符合執行條件時，拋出 PrerequisiteError 並轉換為結構化的工具回應，包含：
- 錯誤詳情
- 叢集資訊
- 建議動作

---

## 7. 追溯矩陣

| 需求 ID | 使用者故事 | 工具 | 測試案例 |
|---------|-----------|------|---------|
| FR-001 | US-001 | kubectl_get | TBD |
| FR-002 | US-002 | kubectl_logs | TBD |
| FR-003 | US-003 | kubectl_top_* | TBD |
| FR-004 | US-004 | kubectl_scale_deployment | TBD |
| FR-005 | US-005 | kubectl_restart_deployment | TBD |
| FR-006 | US-006 | helm_list, helm_status | TBD |
| FR-007 | US-007 | helm_get_values, helm_history | TBD |
| FR-008 | US-008 | cluster_list | TBD |
| FR-009 | US-009 | gke_auth | TBD |

---

## 8. 附錄

### 8.1 術語表

| 術語 | 定義 |
|------|------|
| MCP | Model Context Protocol，AI 模型與工具之間的通訊協議 |
| HPA | HorizontalPodAutoscaler，Kubernetes 自動擴縮容機制 |
| SSE | Server-Sent Events，伺服器推送事件協議 |
| GKE | Google Kubernetes Engine |

### 8.2 參考文件

- [MCP 協議規格](https://modelcontextprotocol.io/)
- [Kubernetes API 文檔](https://kubernetes.io/docs/reference/)
- [Helm 文檔](https://helm.sh/docs/)
