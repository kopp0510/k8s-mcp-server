# K8s MCP Server 測試套件

這個目錄包含使用 Node.js 內建測試模組的單元測試。

## 測試檔案

### tests/validator.test.js
驗證器模組的完整測試套件，涵蓋：

- **validateInput**: 輸入驗證、危險字元檢查、schema 驗證
- **validateResourceName**: Kubernetes 資源名稱驗證
- **validateNamespace**: 命名空間驗證
- **validateLabelKey**: 標籤鍵格式驗證（包含前綴支援）
- **validateLabelValue**: 標籤值格式驗證
- **validateLabelSelector**: 標籤選擇器驗證（支援 =, !=, in, notin 運算子）
- **validateLabelsObject**: 標籤物件驗證
- **validateClusterId**: 叢集 ID 驗證（包含保留字檢查）
- **validateAnnotationKey**: Kubernetes 註解鍵驗證

**覆蓋率**: 94.31% 行覆蓋率、93.70% 分支覆蓋率

### tests/base-tool.test.js
工具基類的完整測試套件，涵蓋：

- **PrerequisiteError**: 前置條件錯誤類別
- **BaseTool**: 工具基類的所有方法
  - constructor: 建構函數
  - getDefinition: 工具定義（抽象方法）
  - execute: 工具執行（抽象方法）
  - createResponse: 回應格式化
  - createErrorResponse: 錯誤回應格式化
  - createSuccessResponse: 成功回應格式化
  - validateArgs: 參數驗證

**覆蓋率**: 79.31% 行覆蓋率、100% 分支覆蓋率

## 執行測試

### 執行所有單元測試
```bash
npm run test:unit
```

### 執行測試並顯示覆蓋率
```bash
npm run test:unit:coverage
```

### 監視模式（自動重新執行）
```bash
npm run test:unit:watch
```

### 執行所有測試（包含整合測試）
```bash
npm run test:all
```

## 測試架構

使用 Node.js 內建的 `node:test` 模組（Node.js 18+），不需要額外的測試框架。

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('測試群組', () => {
  it('應該做某件事', () => {
    assert.strictEqual(actual, expected);
  });
});
```

## 測試類型

### 1. 正常情況測試
驗證有效輸入的正確行為：
```javascript
it('應該接受有效的資源名稱', () => {
  assert.doesNotThrow(() => validator.validateResourceName('my-app'));
});
```

### 2. 邊界條件測試
測試極端情況和邊界值：
```javascript
it('應該接受 253 字元的名稱', () => {
  const maxName = 'a'.repeat(253);
  assert.doesNotThrow(() => validator.validateResourceName(maxName));
});

it('應該拒絕 254 字元的名稱', () => {
  const tooLongName = 'a'.repeat(254);
  assert.throws(() => validator.validateResourceName(tooLongName));
});
```

### 3. 錯誤情況測試
驗證錯誤處理和異常拋出：
```javascript
it('應該拒絕包含危險字元的輸入', () => {
  const input = { command: 'test;rm -rf /' };
  assert.throws(
    () => validator.validateInput(input),
    { message: /Forbidden character/ }
  );
});
```

### 4. 類型測試
確保正確的資料類型：
```javascript
it('應該拒絕非字串型別', () => {
  assert.throws(() => validator.validateResourceName(123));
  assert.throws(() => validator.validateResourceName(null));
});
```

## 測試覆蓋率目標

- **單元測試**: 90%+ 覆蓋率
- **核心模組** (validator, base-tool): 90%+ 覆蓋率
- **工具類別**: 70%+ 覆蓋率

## 已知限制

### 1. null 字元檢查
`validator.validateInput()` 中的 null 字元檢查目前無法捕獲 `\u0000` 字元，因為 `JSON.stringify()` 會將其轉義。如需阻止 null 字元，應在序列化前檢查。

### 2. 標籤選擇器 in/notin 運算子
`validateLabelSelector()` 使用逗號分割表達式，這會導致 `env in (prod,staging)` 被錯誤分割。目前建議：
- 使用單值：`env in (prod)`
- 或分開多個選擇器：`env=prod` 或 `env=staging`
- 或修改實作以正確處理括號內的逗號

## 新增測試

當新增新的驗證方法或工具時，請遵循以下模式：

```javascript
describe('新功能名稱', () => {
  it('應該接受有效輸入', () => {
    // 測試正常情況
  });

  it('應該拒絕無效輸入', () => {
    // 測試錯誤情況
  });

  it('應該處理邊界條件', () => {
    // 測試邊界值
  });

  it('應該拒絕錯誤的型別', () => {
    // 測試型別檢查
  });
});
```

## CI/CD 整合

這些測試可以輕鬆整合到 CI/CD 管道中：

```yaml
# GitHub Actions 範例
- name: Run Unit Tests
  run: npm run test:unit:coverage
```

## 貢獻指南

1. 所有新功能都應該包含測試
2. 測試應該清楚描述預期行為（使用「應該...」的格式）
3. 使用繁體中文撰寫測試描述
4. 確保測試是獨立的、可重複的
5. 執行 `npm run test:unit:coverage` 確保覆蓋率不降低
