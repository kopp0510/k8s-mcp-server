# MCP 伺服器整合測試

本目錄包含 k8s-mcp-server 的整合測試，使用行為驅動開發 (BDD) 和失敗驅動開發 (FDD) 方法。

## 測試檔案

### 1. mcp-server.test.js - 行為測試 (BDD)

使用 Given-When-Then 格式測試 MCP 協議的完整流程。

**測試場景：**

#### 場景 1: MCP 協議初始化流程
- ✅ 初始化請求返回正確的 capabilities
- ✅ initialized 通知返回確認回應

#### 場景 2: 工具列表查詢流程
- ✅ 返回所有工具定義（至少 17 個）
- ✅ 包含所有必要的 kubectl 工具
- ✅ 包含所有必要的 helm 工具
- ✅ 包含叢集管理工具

#### 場景 3: 工具執行流程
- ✅ 執行 kubectl_cluster_info 工具
- ✅ 執行 helm_repo_list 工具
- ✅ 執行 cluster_list 工具

#### 場景 4: 健康檢查和資訊端點
- ✅ /health 端點返回健康狀態
- ✅ /info 端點返回伺服器資訊
- ✅ /tools 端點返回工具列表

#### 場景 5: Ping 健康檢查
- ✅ ping 請求返回 pong 回應

#### 場景 6: 可選的 MCP 方法
- ✅ resources/list 返回資源列表
- ✅ prompts/list 返回提示列表

#### 場景 7: 完整的 MCP 生命週期
- ✅ 從初始化到工具執行的完整流程

### 2. error-handling.test.js - 失敗情境測試 (FDD)

測試各種錯誤情境和邊界條件。

**測試場景：**

#### 失敗情境 1: 無效的請求格式
- ✅ 空的請求體
- ✅ 缺少 method 欄位
- ✅ 缺少 jsonrpc 欄位
- ✅ 無效的 jsonrpc 版本

#### 失敗情境 2: 不存在的方法
- ✅ 調用不存在的 MCP 方法
- ✅ 調用不存在的工具

#### 失敗情境 3: 無效的工具參數
- ✅ kubectl_get 缺少必要參數
- ✅ kubectl_logs 使用無效的命名空間格式
- ✅ kubectl_describe 使用無效的資源類型
- ✅ tools/call 缺少 name 參數

#### 失敗情境 4: 危險輸入和注入攻擊
- ✅ 命令注入嘗試 (如: `default; rm -rf /`)
- ✅ 路徑遍歷嘗試 (如: `../../../etc/passwd`)
- ✅ SQL 注入模式 (如: `test' OR '1'='1`)
- ✅ Shell 特殊字元 (如: `$variable`、backticks、`&&`)

#### 失敗情境 5: 邊界條件
- ✅ 空字串輸入
- ✅ 超長字串 (10KB)
- ✅ 特殊 Unicode 字元（中文、emoji）
- ✅ null 值
- ✅ undefined 值
- ✅ 空物件
- ✅ 缺失的欄位

#### 失敗情境 6: 數字邊界
- ✅ 負數 replicas
- ✅ 超大數字
- ✅ 浮點數

#### 失敗情境 7: 型別錯誤
- ✅ params 為陣列而非物件
- ✅ id 為字串而非數字
- ✅ arguments 為字串而非物件

#### 失敗情境 8: 並發和競爭條件
- ✅ 同時發送多個請求
- ✅ 快速連續執行相同工具

## 執行測試

### 執行所有整合測試
```bash
npm run test:integration
```

### 執行整合測試並顯示覆蓋率
```bash
npm run test:integration:coverage
```

### 監控模式（自動重新執行）
```bash
npm run test:integration:watch
```

### 執行單一測試檔案
```bash
# 只執行行為測試
node --test tests/integration/mcp-server.test.js

# 只執行錯誤處理測試
node --test tests/integration/error-handling.test.js
```

### 執行所有測試（包含單元測試和整合測試）
```bash
npm run test:all
```

## 測試架構

### 使用的技術
- **測試框架**: Node.js 內建的 `node:test` 模組
- **斷言庫**: Node.js 內建的 `node:assert` 模組
- **HTTP 客戶端**: 內建的 `fetch` API

### 測試策略

#### 行為測試 (BDD)
- 使用 Given-When-Then 格式
- 測試完整的使用者流程
- 驗證正常情境下的行為
- 確保 MCP 協議正確實作

#### 失敗情境測試 (FDD)
- 測試錯誤處理機制
- 驗證安全性（防止注入攻擊）
- 測試邊界條件
- 確保系統穩定性

### 測試隔離

每個測試檔案使用不同的埠號：
- `basic-smoke.test.js`: 埠 3010（基本煙霧測試）
- `mcp-server.test.js`: 埠 3011（完整 BDD 測試）
- `error-handling.test.js`: 埠 3012（錯誤處理測試）

使用較高的埠號（3010+）以避免與系統服務或 Docker 衝突。這確保測試可以並行執行而不會互相干擾。

## 測試覆蓋範圍

### MCP 協議方法
- ✅ `initialize` - 初始化連接
- ✅ `notifications/initialized` - 初始化完成通知
- ✅ `tools/list` - 列出所有工具
- ✅ `tools/call` - 執行工具
- ✅ `resources/list` - 列出資源（可選）
- ✅ `prompts/list` - 列出提示（可選）
- ✅ `ping` - 健康檢查

### HTTP 端點
- ✅ `GET /health` - 健康檢查
- ✅ `GET /info` - 伺服器資訊
- ✅ `GET /tools` - 工具列表
- ✅ `POST /mcp` - MCP 主要端點

### 工具類別
- ✅ Kubectl 工具（11 個）
- ✅ Helm 工具（5 個）
- ✅ 叢集管理工具（2 個）

### 錯誤情境
- ✅ 無效請求格式
- ✅ 不存在的方法/工具
- ✅ 無效參數
- ✅ 注入攻擊
- ✅ 邊界條件
- ✅ 型別錯誤
- ✅ 並發請求

## 預期測試結果

### 成功標準
1. 所有測試都應該通過
2. 測試覆蓋率應達到 80% 以上
3. 沒有未處理的異常
4. 所有錯誤都應該被妥善處理

### 測試輸出範例

```
▶ MCP 伺服器整合測試 - 行為測試 (BDD)
  ▶ 場景 1: MCP 協議初始化流程
    ✔ Given: MCP 客戶端連接, When: 發送 initialize 請求, Then: 返回正確的 capabilities (123.45ms)
    ✔ Given: 已初始化連接, When: 發送 initialized 通知, Then: 返回確認回應 (12.34ms)
  ✔ 場景 1: MCP 協議初始化流程 (135.79ms)

  ▶ 場景 2: 工具列表查詢流程
    ✔ Given: 已初始化的 MCP 連接, When: 發送 tools/list 請求, Then: 返回所有工具定義 (15.67ms)
    ...
```

## 疑難排解

### 常見問題

#### 1. 埠號衝突
如果測試失敗並顯示 `EADDRINUSE` 錯誤：
```bash
# 檢查埠號使用情況
lsof -i :3001
lsof -i :3002

# 終止佔用埠號的程序
kill -9 <PID>
```

#### 2. 伺服器啟動超時
如果測試顯示「伺服器未啟動」錯誤：
- 檢查系統資源是否充足
- 增加 `waitForServer` 的超時時間
- 檢查是否有其他程序佔用埠號

#### 3. kubectl 或 helm 不可用
部分測試需要 kubectl 或 helm 命令：
- 這些測試會優雅地處理工具不可用的情況
- 錯誤會被捕獲並作為正常測試結果
- 如果要完整測試，請確保安裝 kubectl 和 helm

## 持續改進

### 未來可以添加的測試

1. **效能測試**
   - 回應時間測試
   - 負載測試
   - 記憶體使用測試

2. **SSE 傳輸測試**
   - SSE 連接建立
   - 訊息串流
   - 連接保持

3. **完整的工具測試**
   - 測試每個工具的完整功能
   - 使用模擬的 kubectl/helm 輸出

4. **認證和授權測試**
   - 多叢集認證
   - GKE 認證流程

## 貢獻指南

新增測試時，請遵循以下原則：

1. **使用 Given-When-Then 格式**（行為測試）
   ```javascript
   it('Given: 條件, When: 動作, Then: 預期結果', async () => {
     // Given: 設定測試條件
     // When: 執行動作
     // Then: 驗證結果
   });
   ```

2. **測試描述要清晰**
   - 使用繁體中文描述
   - 明確說明測試目的
   - 包含預期行為

3. **確保測試獨立性**
   - 不依賴其他測試的執行順序
   - 清理測試產生的狀態
   - 使用獨立的埠號

4. **包含適當的斷言**
   - 驗證回應格式
   - 驗證資料正確性
   - 驗證錯誤處理

## 授權

MIT License - 與專案主授權相同
