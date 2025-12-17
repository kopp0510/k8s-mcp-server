# ADR-004: 安全設計

> 狀態：已採用
> 日期：2025-12-17
> 決策者：danlio

---

## 背景

K8s MCP Server 作為 Kubernetes 管理的中間層，處理來自 AI 的請求並執行實際的 kubectl/helm 命令。由於執行的是系統命令，必須防範各種安全威脅，特別是命令注入攻擊。

## 決策

**採用多層防禦策略，包括輸入驗證、命令隔離、權限控制和安全執行。**

## 理由

### 安全威脅分析

| 威脅 | 風險等級 | 緩解措施 |
|------|---------|---------|
| 命令注入 | 高 | 危險字元阻止、參數陣列化 |
| 資料洩露 | 中 | 敏感資訊過濾、日誌脫敏 |
| 權限提升 | 中 | RBAC 權限控制 |
| DoS 攻擊 | 低 | 連接數限制、請求大小限制 |

### 多層防禦架構

```
Layer 1: 輸入驗證 (Validator)
    ├── 危險字元檢測
    ├── 長度限制
    ├── 型別檢查
    └── 格式驗證

Layer 2: 命令構建 (Kubectl/Helm Runner)
    ├── 參數陣列化 (避免 shell 解析)
    ├── 白名單命令
    └── 參數消毒

Layer 3: 執行隔離 (child_process.spawn)
    ├── 無 shell 執行
    ├── 超時控制
    └── 環境變數隔離

Layer 4: 容器安全 (Docker)
    ├── 非 root 用戶
    ├── 唯讀 volume
    └── 最小權限原則
```

### 危險字元阻止清單

```javascript
const dangerousChars = [';', '&', '|', '>', '<', '`', '$', '(', ')'];
```

這些字元可能被用於：
- `;` - 命令分隔
- `&` - 背景執行/邏輯運算
- `|` - 管道
- `>`, `<` - 重定向
- `` ` `` - 命令替換
- `$` - 變數展開
- `(`, `)` - 子 shell

### 安全執行模式

```javascript
// 不安全 (使用 shell)
exec(`kubectl get pods -n ${namespace}`);  // ❌ 命令注入風險

// 安全 (參數陣列化)
spawn('kubectl', ['get', 'pods', '-n', namespace]);  // ✅ 安全
```

## 後果

### 正面影響

- 有效防範命令注入攻擊
- 結構化的安全日誌
- 符合安全最佳實踐

### 負面影響

- 驗證邏輯增加延遲
- 某些合法字元可能被誤擋
- 需要維護安全規則

### 風險緩解

- 提供明確的錯誤訊息
- 定期審查安全規則
- 安全測試覆蓋

---

## 實作摘要

### 輸入驗證

```javascript
// src/utils/validator.js
function validateInput(input, schema) {
  // 1. 檢查危險字元
  for (const char of dangerousChars) {
    if (inputStr.includes(char)) {
      throw new Error(`Forbidden character: ${char}`);
    }
  }

  // 2. 檢查長度
  if (inputStr.length > 1000) {
    throw new Error('Input length exceeds limit');
  }

  // 3. 檢查 null byte
  if (inputStr.includes('\0')) {
    throw new Error('Null byte detected');
  }
}
```

### 命令執行

```javascript
// src/utils/kubectl.js
function executeKubectl(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('kubectl', args, {
      timeout: 30000,
      shell: false,  // 重要：不使用 shell
      env: { ...process.env }  // 隔離環境變數
    });
    // ...
  });
}
```

### 容器安全

```dockerfile
# Dockerfile
# 使用非 root 用戶
USER nodejs

# 唯讀 volume
# docker run -v ~/.kube/config:/home/nodejs/.kube/config:ro
```

---

## 安全檢查清單

- [x] 輸入驗證 - 危險字元阻止
- [x] 輸入驗證 - 長度限制
- [x] 輸入驗證 - 型別檢查
- [x] 命令執行 - 參數陣列化
- [x] 命令執行 - 無 shell 模式
- [x] 命令執行 - 超時控制
- [x] 容器 - 非 root 執行
- [x] 日誌 - 敏感資訊過濾
- [x] SSE - 連接數限制
- [x] HTTP - 請求大小限制

---

## 相關文件

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [API_CONTRACT.md](../contracts/API_CONTRACT.md)
- `src/utils/validator.js`
