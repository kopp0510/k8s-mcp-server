# ADR-003: 多叢集支援設計

> 狀態：已採用
> 日期：2025-12-17
> 決策者：danlio

---

## 背景

企業環境通常有多個 Kubernetes 叢集：
- 本地開發叢集 (Docker Desktop, Minikube)
- 雲端測試叢集 (GKE, EKS, AKS)
- 生產叢集

需要設計一個統一的多叢集管理機制，讓 AI 能夠在不同叢集之間切換執行操作。

## 決策

**採用配置驅動的多叢集管理機制，透過叢集 ID 參數實現叢集切換。**

## 理由

### 設計原則

1. **配置集中化**
   - 所有叢集配置存放在 `clusters.json`
   - 支援 Local 和 GKE 兩種叢集類型

2. **參數化叢集選擇**
   - 每個工具都支援可選的 `cluster` 參數
   - 不指定時使用預設叢集

3. **認證狀態管理**
   - GKE 叢集需要顯式認證 (`gke_auth`)
   - 認證狀態緩存 (5 分鐘有效)

4. **前置條件檢查**
   - 執行前檢查叢集可用性
   - 未認證時返回 PrerequisiteError

### 叢集配置結構

```json
{
  "clusters": {
    "local": {
      "type": "local",
      "kubeconfig": "~/.kube/config",
      "context": "docker-desktop"
    },
    "gke-prod": {
      "type": "gke",
      "project": "my-project",
      "cluster": "prod-cluster",
      "region": "asia-east1",
      "keyFile": "/secrets/gke-sa-key.json"
    }
  },
  "default": "local"
}
```

### 考慮過的替代方案

| 方案 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| 單叢集 | 簡單 | 無法管理多環境 | 不採用 |
| 環境變數切換 | 靈活 | 需要重啟服務 | 不採用 |
| 動態叢集發現 | 自動化 | 複雜、安全風險 | 不採用 |
| 配置驅動 | 可控、安全 | 需要預先配置 | 採用 |

## 後果

### 正面影響

- 單一 MCP Server 管理多個叢集
- AI 可以在操作中指定目標叢集
- 叢集配置可版本控制

### 負面影響

- 需要預先配置所有叢集
- GKE 認證需要額外步驟
- 叢集配置變更需要重啟服務

### 風險緩解

- 提供 `cluster_list` 工具列出可用叢集
- `gke_auth` 工具處理 GKE 認證
- PrerequisiteError 機制提示認證需求

---

## 實作摘要

### 叢集上下文注入

```javascript
// kubectl 命令添加叢集上下文
const args = ['get', 'pods'];
if (cluster) {
  const context = clusterManager.getContext(cluster);
  args.unshift('--context', context);
}
// 結果: kubectl --context docker-desktop get pods
```

### GKE 認證流程

```javascript
async function authenticateGKE(clusterId) {
  // 1. 激活 Service Account
  await exec('gcloud auth activate-service-account --key-file <key>');

  // 2. 獲取叢集憑證
  await exec('gcloud container clusters get-credentials <cluster>');

  // 3. 切換上下文
  await exec('kubectl config use-context gke_<project>_<region>_<cluster>');

  // 4. 驗證連線
  await exec('kubectl cluster-info');

  // 5. 更新認證狀態
  authCache.set(clusterId, { authenticated: true, timestamp: Date.now() });
}
```

### 前置條件檢查

```javascript
async validatePrerequisites({ cluster }) {
  if (cluster) {
    const isReady = await clusterManager.checkClusterReady(cluster);
    if (!isReady) {
      throw new PrerequisiteError(
        `叢集 ${cluster} 需要認證，請先執行 gke_auth 工具`,
        cluster,
        this.name
      );
    }
  }
}
```

---

## 相關文件

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [API_CONTRACT.md](../contracts/API_CONTRACT.md)
- `src/utils/cluster-manager.js`
- `src/config/clusters.json`
