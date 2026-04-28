/**
 * Input validation utilities for security
 */

// MongoDB ObjectId pattern
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// Email pattern (basic validation)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Safe string pattern (alphanumeric, spaces, basic punctuation)
const SAFE_STRING_PATTERN = /^[a-zA-Z0-9\s\-_.,!?()]+$/;

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return typeof id === 'string' && OBJECT_ID_PATTERN.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

/**
 * Validate safe string (prevents injection attacks)
 */
export function isSafeString(str: string, maxLength: number = 255): boolean {
  return typeof str === 'string' && 
         str.length <= maxLength && 
         SAFE_STRING_PATTERN.test(str);
}

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove HTML tags and script content
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, '')
    .trim();
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(page: unknown, limit: unknown): {
  isValid: boolean;
  error?: string;
  page: number;
  limit: number;
} {
  const parsedPage = parseInt(String(page));
  const parsedLimit = parseInt(String(limit));
  
  if (isNaN(parsedPage) || parsedPage < 1) {
    return {
      isValid: false,
      error: 'Page must be a positive integer',
      page: 1,
      limit: 10
    };
  }
  
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return {
      isValid: false,
      error: 'Limit must be between 1 and 100',
      page: parsedPage,
      limit: 10
    };
  }
  
  return {
    isValid: true,
    page: parsedPage,
    limit: parsedLimit
  };
}

/**
 * Validate session completion request
 */
export function validateSessionCompletionRequest(body: unknown): 
  | { isValid: false; error: string }
  | { isValid: true; sessionId: string; stationId: string } {
  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      error: 'Request body must be a valid JSON object'
    };
  }
  
  // Type assertion after checking it's an object
  const requestBody = body as Record<string, unknown>;
  const { sessionId, stationId } = requestBody;
  
  if (!sessionId || typeof sessionId !== 'string' || !isValidObjectId(sessionId)) {
    return {
      isValid: false,
      error: 'Valid session ID is required'
    };
  }
  
  if (!stationId || typeof stationId !== 'string' || !isValidObjectId(stationId)) {
    return {
      isValid: false,
      error: 'Valid station ID is required'
    };
  }
  
  return {
    isValid: true,
    sessionId,
    stationId
  };
}

/**
 * Check for common SQL injection patterns (even though we use MongoDB)
 */
export function containsSqlInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|\/\*|\*\/)/,
    /(\bOR\b.*=.*\bOR\b)/i,
    /(\bAND\b.*=.*\bAND\b)/i,
    /(;|\||&)/
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for NoSQL injection patterns
 */
export function containsNoSqlInjectionPatterns(input: unknown): boolean {
  if (typeof input === 'object' && input !== null) {
    // Check for MongoDB operators
    const dangerousOperators = ['$where', '$regex', '$ne', '$gt', '$lt', '$in', '$nin'];
    const inputObj = input as Record<string, unknown>;
    return dangerousOperators.some(op => Object.prototype.hasOwnProperty.call(inputObj, op));
  }
  
  if (typeof input === 'string') {
    // Check for JavaScript code patterns
    const jsPatterns = [
      /function\s*\(/i,
      /=\s*function/i,
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i
    ];
    
    return jsPatterns.some(pattern => pattern.test(input));
  }
  
  return false;
}

/**
 * Comprehensive input validation for API requests
 */
export function validateApiInput(input: unknown, rules: {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: unknown[];
}): { isValid: boolean; error?: string; sanitizedValue?: unknown } {
  // Check if required
  if (rules.required && (input === undefined || input === null || input === '')) {
    return { isValid: false, error: 'This field is required' };
  }
  
  // If not required and empty, return valid
  if (!rules.required && (input === undefined || input === null || input === '')) {
    return { isValid: true, sanitizedValue: input };
  }
  
  // Type validation
  if (rules.type && typeof input !== rules.type) {
    return { isValid: false, error: `Expected ${rules.type}, got ${typeof input}` };
  }
  
  // String-specific validations
  if (typeof input === 'string') {
    // Check for injection patterns
    if (containsSqlInjectionPatterns(input) || containsNoSqlInjectionPatterns(input)) {
      return { isValid: false, error: 'Input contains potentially dangerous patterns' };
    }
    
    // Length validation
    if (rules.minLength && input.length < rules.minLength) {
      return { isValid: false, error: `Minimum length is ${rules.minLength}` };
    }
    
    if (rules.maxLength && input.length > rules.maxLength) {
      return { isValid: false, error: `Maximum length is ${rules.maxLength}` };
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(input)) {
      return { isValid: false, error: 'Input format is invalid' };
    }
    
    // Sanitize the string
    const sanitizedValue = sanitizeString(input);
    return { isValid: true, sanitizedValue };
  }
  
  // Object-specific validations
  if (typeof input === 'object' && input !== null) {
    if (containsNoSqlInjectionPatterns(input)) {
      return { isValid: false, error: 'Input contains potentially dangerous patterns' };
    }
  }
  
  // Allowed values validation
  if (rules.allowedValues && !rules.allowedValues.includes(input)) {
    return { isValid: false, error: 'Value is not allowed' };
  }
  
  return { isValid: true, sanitizedValue: input };
}

const inputValidation = {
  isValidObjectId,
  isValidEmail,
  isSafeString,
  sanitizeString,
  validatePaginationParams,
  validateSessionCompletionRequest,
  containsSqlInjectionPatterns,
  containsNoSqlInjectionPatterns,
  validateApiInput
};

export default inputValidation;