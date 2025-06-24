class SimpleValidator {
  constructor() {
    // Dangerous characters
    this.dangerousChars = [';', '&', '|', '>', '<', '`', '$', '(', ')'];
    this.maxInputLength = 1000;
  }

  validateInput(input, schema = null) {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be a valid object');
    }

    const inputStr = JSON.stringify(input);

    // Check length
    if (inputStr.length > this.maxInputLength) {
      throw new Error(`Input length exceeds limit (${this.maxInputLength} characters)`);
    }

    // Check dangerous characters
    for (const char of this.dangerousChars) {
      if (inputStr.includes(char)) {
        throw new Error(`Forbidden character: ${char}`);
      }
    }

    // Check null bytes
    if (inputStr.includes('\0')) {
      throw new Error('Null characters not allowed');
    }

    // If schema is provided, perform type validation
    if (schema && schema.properties) {
      this.validateSchema(input, schema);
    }
  }

  validateSchema(input, schema) {
    // Validate required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in input)) {
          throw new Error(`Missing required field: ${requiredField}`);
        }
      }
    }

    // Validate type of each property
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
          throw new Error(`Parameter ${key} must be boolean, but received ${actualType}: ${value}`);
        }
        break;
      case 'string':
        if (actualType !== 'string') {
          throw new Error(`Parameter ${key} must be string, but received ${actualType}: ${value}`);
        }
        break;
      case 'number':
        if (actualType !== 'number') {
          throw new Error(`Parameter ${key} must be number, but received ${actualType}: ${value}`);
        }
        break;
      case 'integer':
        if (!Number.isInteger(value)) {
          throw new Error(`Parameter ${key} must be integer, but received: ${value}`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Parameter ${key} must be array, but received ${actualType}: ${value}`);
        }
        break;
      case 'object':
        if (actualType !== 'object' || Array.isArray(value) || value === null) {
          throw new Error(`Parameter ${key} must be object, but received ${actualType}: ${value}`);
        }
        break;
    }

    // Validate enum values
    if (propertySchema.enum && !propertySchema.enum.includes(value)) {
      throw new Error(`Parameter ${key} must be one of: ${propertySchema.enum.join(', ')}, but received: ${value}`);
    }
  }

  validateResourceName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Resource name must be a non-empty string');
    }

    // Kubernetes naming rules: lowercase letters, numbers, hyphens
    const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

    if (!k8sNameRegex.test(name)) {
      throw new Error('Resource name format does not conform to Kubernetes specifications');
    }

    if (name.length > 253) {
      throw new Error('Resource name length cannot exceed 253 characters');
    }
  }

  validateNamespace(namespace) {
    if (namespace) {
      this.validateResourceName(namespace);
    }
  }

  /**
   * Validate Kubernetes label key format
   * Label keys can contain letters, numbers, hyphens, underscores, dots and slashes
   */
  validateLabelKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Label key must be a non-empty string');
    }

    if (key.length > 253) {
      throw new Error(`Label key "${key}" length cannot exceed 253 characters`);
    }

    // Check if it contains a prefix
    let actualKey = key;
    if (key.includes('/')) {
      const parts = key.split('/');
      if (parts.length !== 2) {
        throw new Error(`Label key "${key}" format invalid, can contain at most one slash`);
      }

      const [prefix, name] = parts;

      // Validate prefix (domain name format)
      if (prefix.length > 253) {
        throw new Error(`Label prefix "${prefix}" length cannot exceed 253 characters`);
      }

      const prefixRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!prefixRegex.test(prefix)) {
        throw new Error(`Label prefix "${prefix}" format invalid, must be a valid DNS subdomain`);
      }

      actualKey = name;
    }

    // Validate the actual key name part
    if (actualKey.length === 0) {
      throw new Error('Label key name part cannot be empty');
    }

    if (actualKey.length > 63) {
      throw new Error(`Label key name part "${actualKey}" length cannot exceed 63 characters`);
    }

    const keyRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/;
    if (!keyRegex.test(actualKey)) {
      throw new Error(`Label key "${actualKey}" format invalid. Must start and end with alphanumeric characters, can contain letters, numbers, hyphens, underscores, dots`);
    }
  }

  /**
   * Validate Kubernetes label value format
   */
  validateLabelValue(value) {
    if (typeof value !== 'string') {
      throw new Error(`Label value must be string, but received ${typeof value}`);
    }

    if (value.length > 63) {
      throw new Error(`Label value "${value}" length cannot exceed 63 characters`);
    }

    // Empty values are allowed
    if (value.length === 0) {
      return;
    }

    const valueRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_.-]*[a-zA-Z0-9])?$/;
    if (!valueRegex.test(value)) {
      throw new Error(`Label value "${value}" format invalid. Must start and end with alphanumeric characters, can contain letters, numbers, hyphens, underscores, dots`);
    }
  }

  /**
   * Validate label selector string format
   * Supported formats: key=value, key!=value, key, !key, key in (value1,value2), key notin (value1,value2)
   */
  validateLabelSelector(selector) {
    if (!selector || typeof selector !== 'string') {
      throw new Error('Label selector must be a non-empty string');
    }

    // Split by comma, each part is an expression
    const expressions = selector.split(',').map(expr => expr.trim()).filter(expr => expr.length > 0);

    if (expressions.length === 0) {
      throw new Error('Label selector cannot be empty');
    }

    for (const expression of expressions) {
      this.validateSingleLabelExpression(expression);
    }
  }

  validateSingleLabelExpression(expression) {
    // Support formats:
    // 1. key=value
    // 2. key!=value
    // 3. key
    // 4. !key
    // 5. key in (value1,value2,...)
    // 6. key notin (value1,value2,...)

    if (expression.includes(' in ')) {
      // Format: key in (value1,value2,...)
      const [keyPart, valuePart] = expression.split(' in ');
      this.validateLabelKey(keyPart.trim());

      if (!valuePart.match(/^\([^)]+\)$/)) {
        throw new Error(`Invalid "in" expression format: ${expression}`);
      }

      const values = valuePart.slice(1, -1).split(',').map(v => v.trim());
      for (const value of values) {
        this.validateLabelValue(value);
      }
    } else if (expression.includes(' notin ')) {
      // Format: key notin (value1,value2,...)
      const [keyPart, valuePart] = expression.split(' notin ');
      this.validateLabelKey(keyPart.trim());

      if (!valuePart.match(/^\([^)]+\)$/)) {
        throw new Error(`Invalid "notin" expression format: ${expression}`);
      }

      const values = valuePart.slice(1, -1).split(',').map(v => v.trim());
      for (const value of values) {
        this.validateLabelValue(value);
      }
    } else if (expression.includes('!=')) {
      // Format: key!=value
      const [key, value] = expression.split('!=');
      this.validateLabelKey(key.trim());
      this.validateLabelValue(value.trim());
    } else if (expression.includes('=')) {
      // Format: key=value
      const [key, value] = expression.split('=');
      this.validateLabelKey(key.trim());
      this.validateLabelValue(value.trim());
    } else if (expression.startsWith('!')) {
      // Format: !key
      const key = expression.slice(1).trim();
      this.validateLabelKey(key);
    } else {
      // Format: key
      this.validateLabelKey(expression.trim());
    }
  }

  validateLabelsObject(labels) {
    if (typeof labels !== 'object' || Array.isArray(labels) || labels === null) {
      throw new Error('Labels must be an object');
    }

    for (const [key, value] of Object.entries(labels)) {
      this.validateLabelKey(key);
      this.validateLabelValue(value);
    }
  }

  validateAnnotationKey(key) {
    // Annotation keys have similar rules to label keys but are more lenient
    if (!key || typeof key !== 'string') {
      throw new Error('Annotation key must be a non-empty string');
    }

    if (key.length > 253) {
      throw new Error(`Annotation key "${key}" length cannot exceed 253 characters`);
    }

    // Annotation keys can contain more characters than label keys
    const annotationKeyRegex = /^[a-zA-Z0-9\/._-]+$/;
    if (!annotationKeyRegex.test(key)) {
      throw new Error(`Annotation key "${key}" contains invalid characters`);
    }
  }
}

export const validator = new SimpleValidator();