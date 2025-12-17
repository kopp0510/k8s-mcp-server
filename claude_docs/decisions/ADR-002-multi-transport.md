# ADR-002: 多傳輸模式設計

> 狀態：已採用
> 日期：2025-12-17
> 決策者：danlio

---

## 背景

K8s MCP Server 需要支援多種 AI 客戶端，包括：
- Claude CLI (Stdio)
- n8n (SSE)
- Dify (HTTP)

不同平台對傳輸協議有不同的要求，需要設計一個靈活的傳輸層架構。

## 決策

**採用混合傳輸模式 (Hybrid Transport)，同時支援 Stdio、SSE 和 HTTP Streamable。**

## 理由

### 各傳輸模式的適用場景

| 模式 | 適用場景 | 客戶端 |
|------|---------|--------|
| Stdio | 本地進程通訊 | Claude CLI, MCP Inspector |
| SSE | 持久連接、實時推送 | n8n |
| HTTP | 簡單請求/響應 | Dify, cURL |

### 設計原則

1. **統一的 MCP Handler**
   - 所有傳輸模式共用同一個 MCP 訊息處理器
   - 確保行為一致性

2. **傳輸無關的業務邏輯**
   - 工具層不需要知道傳輸方式
   - 只需關心輸入和輸出

3. **模式切換**
   - 預設 Stdio 模式
   - `--http` 參數啟用 HTTP/SSE 混合模式

### 考慮過的替代方案

| 方案 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| 僅 Stdio | 簡單 | 無法支援雲端部署 | 不採用 |
| 僅 HTTP | 通用 | n8n 需要 SSE | 不採用 |
| 分離服務 | 獨立擴展 | 維護成本高 | 不採用 |
| 混合模式 | 靈活、統一 | 複雜度略高 | 採用 |

## 後果

### 正面影響

- 單一服務支援所有主流 AI 平台
- 統一的程式碼庫，易於維護
- 靈活的部署選項

### 負面影響

- HTTP 模式需要額外的 Express 伺服器
- SSE 連接管理增加複雜度
- 需要處理 CORS 跨域問題

### 風險緩解

- SSE 連接數限制 (MAX_SSE_CONNECTIONS = 100)
- 定期清理失效連接
- 健康檢查端點監控連接狀態

---

## 實作摘要

```javascript
// 啟動模式判斷
if (httpMode) {
  // HTTP/SSE 混合模式
  const { app, sseConnections } = createExpressApp(tools, availableTools);
  app.listen(port);
} else {
  // Stdio 模式
  const transport = new StdioServerTransport();
  server.connect(transport);
}

// 端點配置
// GET /sse - SSE 連接 (n8n)
// POST /messages - SSE 訊息 (n8n)
// POST /mcp - HTTP 直接請求 (Dify)
```

### 端點架構

```
HTTP/SSE 模式 (port 3000)
├── GET /health      - 健康檢查
├── GET /info        - 伺服器資訊
├── GET /tools       - 工具列表
├── GET /sse         - SSE 連接建立 (n8n)
├── POST /messages   - SSE 訊息接收 (n8n)
├── POST /mcp        - HTTP 直接請求 (Dify)
└── GET /sse-status  - SSE 連接狀態
```

---

## 相關文件

- [ADR-001: MCP 協議選擇](./ADR-001-mcp-protocol.md)
- [API_CONTRACT.md](../contracts/API_CONTRACT.md)
