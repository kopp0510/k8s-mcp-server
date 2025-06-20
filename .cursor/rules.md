# Cursor AI 開發規則

## 專案概述
這是一個簡化版 Kubernetes MCP Server，使用 Node.js + Express + MCP SDK 實現。專注於提供安全的 kubectl get pods/nodes 功能。

## 程式碼規範

### 檔案結構
- `src/index.js`: 主程式入口，處理生命週期
- `src/server.js`: MCP + Express 整合
- `src/tools/`: 工具實現，繼承 BaseTool
- `src/utils/`: 共用工具函數

### 編程風格
- 使用 ESM 模組語法 (import/export)
- 使用 async/await 處理異步操作
- 類別使用 PascalCase，函數使用 camelCase
- 檔案名使用 kebab-case

### 安全要求 (最高優先級)
- 所有使用者輸入必須經過 `validator.validateInput()`
- 禁止字符: `;`, `&`, `|`, `>`, `<`, `` ` ``, `$`, `(`, `)`
- 僅允許 kubectl get pods/nodes 操作
- 強制 JSON 輸出格式
- 30 秒執行超時

### 錯誤處理
- 統一使用 try-catch 包裝
- 錯誤回應格式: `{ content: [{ type: 'text', text: '錯誤: ...' }] }`
- 記錄所有錯誤到日誌

### 新增工具模板
```javascript
import { BaseTool } from './base-tool.js';

export class NewTool extends BaseTool {
  constructor() {
    super('tool_name', '工具描述');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: { /* 參數定義 */ },
        required: [/* 必填參數 */]
      }
    };
  }

  async execute(args) {
    try {
      this.validateInput(args);
      // 實現邏輯
      const result = await someOperation(args);
      this.logSuccess(args, result);
      return this.createResponse(result);
    } catch (error) {
      this.logError(args, error);
      return this.createErrorResponse(error.message);
    }
  }
}
```

## 開發約束

### 不要修改的檔案
- 基礎架構檔案 (index.js, server.js 的核心結構)
- 安全驗證機制 (validator.js 的核心邏輯)

### 必須遵循的原則
1. 安全第一：所有新功能都要通過安全檢查
2. 簡潔優先：保持程式碼簡潔易懂
3. 模組化：新功能應該是可獨立測試的模組
4. 向後相容：不破壞現有功能

### 測試要求
- 每個新功能都要提供測試方法
- 包含正常和異常情況的測試
- 驗證安全機制有效性

## 常見任務

### 新增 kubectl 指令支援
1. 在 `src/tools/` 建立新工具檔案
2. 繼承 `BaseTool` 並實現方法
3. 在 `src/server.js` 註冊工具
4. 更新文檔

### 擴展資源類型
1. 修改 `KubectlGetTool` 的資源驗證
2. 更新 `inputSchema` 的 enum
3. 測試新資源類型

### 改善錯誤處理
1. 在相關工具中加強錯誤檢查
2. 提供更清楚的錯誤訊息
3. 確保日誌記錄完整

## 禁止事項
- 不要使用 eval() 或類似的動態執行
- 不要直接執行使用者輸入的字串
- 不要移除現有的安全檢查
- 不要加入不必要的依賴項
- 不要修改 Docker 基礎配置除非必要