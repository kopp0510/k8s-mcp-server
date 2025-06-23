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
}

export const validator = new SimpleValidator();