class SimpleValidator {
  constructor() {
    // 危險字符
    this.dangerousChars = [';', '&', '|', '>', '<', '`', '$', '(', ')'];
    this.maxInputLength = 1000;
  }

  validateInput(input) {
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