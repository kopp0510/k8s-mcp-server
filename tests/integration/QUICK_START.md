# 整合測試快速開始

## 立即開始

```bash
# 安裝依賴（如果尚未安裝）
npm install

# 執行所有整合測試
npm run test:integration

# 只執行煙霧測試（最快，1秒內完成）
node --test tests/integration/basic-smoke.test.js
```

## 常用命令

```bash
# 執行測試並顯示覆蓋率
npm run test:integration:coverage

# 監控模式（檔案變更時自動重新執行）
npm run test:integration:watch

# 執行所有測試（單元測試 + 整合測試）
npm run test:all
```

## 測試檔案

| 檔案 | 埠號 | 測試數量 | 執行時間 | 用途 |
|------|------|----------|----------|------|
| `basic-smoke.test.js` | 3010 | 5 | ~1秒 | 快速驗證核心功能 |
| `mcp-server.test.js` | 3011 | 16 | ~5秒 | 完整 BDD 測試 |
| `error-handling.test.js` | 3012 | 29 | ~10秒 | 錯誤處理和安全性 |

## 測試範圍

### ✅ 已測試的功能

**MCP 協議**:
- 初始化和連接管理
- 工具列表和執行
- 通知處理

**HTTP 端點**:
- /health - 健康檢查
- /info - 伺服器資訊
- /tools - 工具列表
- /mcp - MCP 主要端點

**錯誤處理**:
- 無效請求格式
- 不存在的方法/工具
- 注入攻擊防護
- 邊界條件處理

### 🎯 測試覆蓋率目標

- MCP 協議方法: 100%
- HTTP 端點: 100%
- 工具類別: 100% (基本功能)
- 錯誤處理: 90%+
- 安全性: 主要攻擊向量

## 疑難排解

### 問題 1: 埠號被佔用

**錯誤訊息**: `EADDRINUSE: address already in use`

**解決方法**:
```bash
# 檢查埠號使用情況
lsof -i :3010 :3011 :3012

# 終止佔用埠號的程序
kill -9 <PID>

# 或修改測試檔案中的 testPort 變數
```

### 問題 2: 測試超時

**錯誤訊息**: `伺服器在 XXms 後仍未啟動`

**解決方法**:
- 確保系統資源充足
- 檢查是否有防火牆阻擋
- 增加 `waitForServer` 的超時時間

### 問題 3: kubectl/helm 錯誤

**錯誤訊息**: GKE 認證失敗相關錯誤

**說明**: 這是預期行為，測試會優雅地處理這些錯誤。如果要完全測試 kubectl/helm 功能，請確保:
```bash
# 檢查 kubectl 可用性
kubectl version --client

# 檢查 helm 可用性
helm version

# 登入 GKE（如果需要）
gcloud auth login
```

## 執行特定測試

### 只測試 MCP 協議
```bash
node --test tests/integration/mcp-server.test.js
```

### 只測試錯誤處理
```bash
node --test tests/integration/error-handling.test.js
```

### 測試特定場景
使用 `--test-name-pattern` 或 `-t` 選項:
```bash
# 只測試初始化相關的測試
node --test tests/integration/mcp-server.test.js -t "初始化"

# 只測試注入攻擊相關的測試
node --test tests/integration/error-handling.test.js -t "注入"
```

## 查看詳細輸出

```bash
# 顯示每個測試的詳細日誌
node --test tests/integration/basic-smoke.test.js 2>&1 | less

# 只顯示錯誤
node --test tests/integration/mcp-server.test.js 2>&1 | grep -E "(✖|Error|FAIL)"

# 只顯示通過的測試
node --test tests/integration/mcp-server.test.js 2>&1 | grep "✔"
```

## 整合到 CI/CD

### GitHub Actions 範例
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:integration
```

### GitLab CI 範例
```yaml
integration-tests:
  image: node:18
  script:
    - npm install
    - npm run test:integration
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## 效能基準

在標準開發機器上的預期執行時間：

| 測試套件 | 測試數量 | 執行時間 |
|----------|----------|----------|
| 煙霧測試 | 5 | ~1秒 |
| BDD 測試 | 16 | ~5秒 |
| 錯誤處理 | 29 | ~10秒 |
| **總計** | **50** | **~16秒** |

如果執行時間顯著超過這些數字，可能表示：
- 系統資源不足
- 網路延遲
- 背景程序干擾

## 最佳實踐

1. **定期執行測試**: 每次提交前執行整合測試
2. **查看失敗原因**: 不要忽略測試失敗，即使看起來無關緊要
3. **保持測試更新**: 新增功能時同步新增測試
4. **檢查覆蓋率**: 定期檢查測試覆蓋率報告
5. **獨立運行**: 確保測試可以在任何環境中獨立運行

## 進一步閱讀

- [完整測試文檔](./README.md) - 詳細的測試說明和架構
- [測試總結](./TEST_SUMMARY.md) - 測試結果和覆蓋範圍
- [Node.js Test Runner 文檔](https://nodejs.org/api/test.html) - 官方測試框架文檔

## 需要幫助？

1. 查看 [README.md](./README.md) 的疑難排解章節
2. 檢查測試日誌的詳細錯誤訊息
3. 確認系統需求（Node.js >= 18）
4. 驗證網路連接和防火牆設定

## 快速檢查清單

執行測試前，確保：
- ✅ 已安裝 Node.js 18 或更高版本
- ✅ 已執行 `npm install`
- ✅ 埠號 3010-3012 未被佔用
- ✅ 沒有其他測試程序在運行

執行測試後，檢查：
- ✅ 所有測試都通過（或了解失敗原因）
- ✅ 沒有未捕獲的異常
- ✅ 伺服器正確關閉
- ✅ 埠號已釋放
