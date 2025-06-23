class SimpleValidator {
  constructor() {
    // 危險字符
    this.dangerousChars = [';', '&', '|', '>', '<', '`', '$', '(', ')'];
    this.maxInputLength = 1000;
  }

  validateInput(input, schema = null) {
    if (!input || typeof input !== 'object') {
      throw new Error('輸入必須是有效的物件');
    }

    const inputStr = JSON.stringify(input);

    // 檢查長度
    if (inputStr.length > this.maxInputLength) {
      throw new Error(`輸入長度超過限制 (${this.maxInputLength} 字符)`);
    }

    // 檢查危險字符
    for (const char of this.dangerousChars) {
      if (inputStr.includes(char)) {
        throw new Error(`不允許的字符: ${char}`);
      }
    }

    // 檢查 null bytes
    if (inputStr.includes('\0')) {
      throw new Error('不允許空字符');
    }

    // 如果提供了 schema，進行類型驗證
    if (schema && schema.properties) {
      this.validateSchema(input, schema);
    }
  }

  validateSchema(input, schema) {
    // 驗證必填欄位
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in input)) {
          throw new Error(`缺少必填欄位: ${requiredField}`);
        }
      }
    }

    // 驗證每個屬性的類型
    for (const [key, value] of Object.entries(input)) {
      if (schema.properties[key]) {
        const propertySchema = schema.properties[key];
        this.validatePropertyType(key, value, propertySchema);
      }
    }
  }

  validatePropertyType(key, value, propertySchema) {
    const expectedType = propertySchema.type;
    const actualType = typeof value;

    switch (expectedType) {
      case 'boolean':
        if (actualType !== 'boolean') {
          throw new Error(`參數 ${key} 必須是布林值，但收到 ${actualType}: ${value}`);
        }
        break;
      case 'string':
        if (actualType !== 'string') {
          throw new Error(`參數 ${key} 必須是字串，但收到 ${actualType}: ${value}`);
        }
        break;
      case 'number':
        if (actualType !== 'number') {
          throw new Error(`參數 ${key} 必須是數字，但收到 ${actualType}: ${value}`);
        }
        break;
      case 'integer':
        if (!Number.isInteger(value)) {
          throw new Error(`參數 ${key} 必須是整數，但收到: ${value}`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`參數 ${key} 必須是陣列，但收到 ${actualType}: ${value}`);
        }
        break;
      case 'object':
        if (actualType !== 'object' || Array.isArray(value) || value === null) {
          throw new Error(`參數 ${key} 必須是物件，但收到 ${actualType}: ${value}`);
        }
        break;
    }

    // 驗證 enum 值
    if (propertySchema.enum && !propertySchema.enum.includes(value)) {
      throw new Error(`參數 ${key} 必須是以下值之一: ${propertySchema.enum.join(', ')}，但收到: ${value}`);
    }
  }

  validateResourceName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('資源名稱必須是非空字串');
    }

    // Kubernetes 名稱規則：小寫字母、數字、連字號
    const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

    if (!k8sNameRegex.test(name)) {
      throw new Error('資源名稱格式不符合 Kubernetes 規範');
    }

    if (name.length > 253) {
      throw new Error('資源名稱長度不能超過 253 字符');
    }
  }

  validateNamespace(namespace) {
    if (namespace) {
      this.validateResourceName(namespace);
    }
  }

  /**
   * 驗證 Kubernetes 標籤鍵格式
   * 標籤鍵可包含字母、數字、連字號、底線、點和斜線
   */
  validateLabelKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('標籤鍵必須是非空字串');
    }

    if (key.length > 253) {
      throw new Error(`標籤鍵 "${key}" 長度不能超過 253 字符`);
    }

    // 檢查是否包含前綴
    let actualKey = key;
    if (key.includes('/')) {
      const parts = key.split('/');
      if (parts.length !== 2) {
        throw new Error(`標籤鍵 "${key}" 格式無效，最多只能包含一個斜線`);
      }

      const [prefix, name] = parts;

      // 驗證前綴（域名格式）
      if (prefix.length > 253) {
        throw new Error(`標籤前綴 "${prefix}" 長度不能超過 253 字符`);
      }

      const prefixRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!prefixRegex.test(prefix)) {
        throw new Error(`標籤前綴 "${prefix}" 格式無效，必須是有效的 DNS 子域名`);
      }

      actualKey = name;
    }

    // 驗證實際鍵名稱部分
    if (actualKey.length === 0) {
      throw new Error('標籤鍵的名稱部分不能為空');
    }

    if (actualKey.length > 63) {
      throw new Error(`標籤鍵的名稱部分 "${actualKey}" 長度不能超過 63 字符`);
    }

    const keyRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/;
    if (!keyRegex.test(actualKey)) {
      throw new Error(`標籤鍵 "${actualKey}" 格式無效。必須以字母或數字開始和結束，中間可包含字母、數字、連字號、底線、點`);
    }
  }

  /**
   * 驗證 Kubernetes 標籤值格式
   */
  validateLabelValue(value) {
    if (typeof value !== 'string') {
      throw new Error(`標籤值必須是字串，但收到 ${typeof value}`);
    }

    if (value.length > 63) {
      throw new Error(`標籤值 "${value}" 長度不能超過 63 字符`);
    }

    // 空值是允許的
    if (value.length === 0) {
      return;
    }

    const valueRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/;
    if (!valueRegex.test(value)) {
      throw new Error(`標籤值 "${value}" 格式無效。必須以字母或數字開始和結束，中間可包含字母、數字、連字號、底線、點`);
    }
  }

  /**
   * 驗證標籤選擇器字串格式
   * 支援格式：key=value, key!=value, key, !key, key in (value1,value2), key notin (value1,value2)
   */
  validateLabelSelector(selector) {
    if (!selector || typeof selector !== 'string') {
      throw new Error('標籤選擇器必須是非空字串');
    }

    if (selector.length > 1000) {
      throw new Error('標籤選擇器長度不能超過 1000 字符');
    }

    // 移除空白字符進行驗證
    const cleanSelector = selector.replace(/\s+/g, '');

    // 分割選擇器表達式
    const expressions = cleanSelector.split(',');

    for (const expr of expressions) {
      if (expr.trim().length === 0) {
        throw new Error('標籤選擇器不能包含空的表達式');
      }

      this.validateSingleLabelExpression(expr.trim());
    }
  }

  /**
   * 驗證單個標籤表達式
   */
  validateSingleLabelExpression(expression) {
    // 否定表達式 (!key)
    if (expression.startsWith('!')) {
      const key = expression.substring(1);
      this.validateLabelKey(key);
      return;
    }

    // in/notin 表達式
    if (expression.includes(' in ') || expression.includes(' notin ')) {
      const inMatch = expression.match(/^([^!]+)\s+(in|notin)\s*\(([^)]+)\)$/);
      if (!inMatch) {
        throw new Error(`標籤表達式 "${expression}" 格式無效`);
      }

      const [, key, operator, values] = inMatch;
      this.validateLabelKey(key);

      const valueList = values.split(',').map(v => v.trim());
      for (const value of valueList) {
        if (value.length === 0) {
          throw new Error('in/notin 表達式中的值不能為空');
        }
        this.validateLabelValue(value);
      }
      return;
    }

    // 等於/不等於表達式 (key=value, key!=value)
    if (expression.includes('=')) {
      const equalMatch = expression.match(/^([^!=]+)(!=|=)(.*)$/);
      if (!equalMatch) {
        throw new Error(`標籤表達式 "${expression}" 格式無效`);
      }

      const [, key, operator, value] = equalMatch;
      this.validateLabelKey(key);
      this.validateLabelValue(value);
      return;
    }

    // 存在性表達式 (key)
    this.validateLabelKey(expression);
  }

  /**
   * 驗證標籤物件
   */
  validateLabelsObject(labels) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
      throw new Error('標籤必須是有效的物件');
    }

    const labelCount = Object.keys(labels).length;
    if (labelCount === 0) {
      throw new Error('標籤物件不能為空');
    }

    if (labelCount > 50) {
      throw new Error('標籤數量不能超過 50 個');
    }

    // 驗證每個標籤鍵值對
    for (const [key, value] of Object.entries(labels)) {
      this.validateLabelKey(key);
      this.validateLabelValue(value);
    }
  }
}

export const validator = new SimpleValidator();