# ADR-001: MCP 協議選擇

> 狀態：已採用
> 日期：2025-12-17
> 決策者：danlio

---

## 背景

K8s MCP Server 需要一個標準化的協議來暴露 Kubernetes 管理功能給 AI 客戶端。選擇合適的通訊協議對於系統的可維護性、擴展性和與 AI 平台的整合至關重要。

## 決策

**採用 Model Context Protocol (MCP) 2024-11-05 版本作為核心通訊協議。**

## 理由

### 選擇 MCP 的原因

1. **AI 原生設計**
   - MCP 專為 AI 模型與工具整合設計
   - 標準化的工具定義格式 (inputSchema)
   - 支援結構化的請求/響應模式

2. **廣泛的平台支援**
   - Anthropic Claude 原生支援
   - n8n 透過 SSE 整合
   - Dify 透過 HTTP 整合

3. **標準化**
   - 基於 JSON-RPC 2.0
   - 清晰的生命週期管理 (initialize → tools/list → tools/call)
   - 統一的錯誤處理格式

4. **靈活的傳輸層**
   - 支援 Stdio (本地開發)
   - 支援 HTTP (雲端部署)
   - 支援 SSE (實時通訊)

### 考慮過的替代方案

| 方案 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| REST API | 簡單、通用 | 無標準工具定義、需自行設計 | 不採用 |
| GraphQL | 彈性查詢 | 過度複雜、AI 整合困難 | 不採用 |
| gRPC | 高效能 | 二進制協議、調試困難 | 不採用 |
| OpenAPI/Swagger | 標準化 | 無 AI 原生支援 | 不採用 |

## 後果

### 正面影響

- 與 Claude Code 等 AI 工具無縫整合
- 工具定義可被 AI 自動發現和使用
- 統一的錯誤處理和響應格式
- 支援多種傳輸模式

### 負面影響

- 依賴 MCP SDK (@modelcontextprotocol/sdk)
- 協議版本升級可能需要相容性處理
- 非 AI 客戶端需要額外的適配層

### 風險緩解

- 鎖定 MCP 協議版本 (2024-11-05)
- 保持 HTTP 端點的向後相容性
- 定期關注 MCP 協議更新

---

## 實作摘要

```javascript
// 協議版本
const protocolVersion = '2024-11-05';

// 支援的方法
const methods = [
  'initialize',
  'notifications/initialized',
  'tools/list',
  'tools/call',
  'ping'
];

// 工具定義格式
{
  name: 'kubectl_get',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {...},
    required: [...]
  }
}
```

---

## 相關文件

- [MCP 官方文檔](https://modelcontextprotocol.io/)
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- [API_CONTRACT.md](../contracts/API_CONTRACT.md)
