// Error codes used throughout the application
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Validation
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Session Management
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_SESSION = 'INVALID_SESSION',
  DUPLICATE_COMPLETION = 'DUPLICATE_COMPLETION',
  SESSION_ALREADY_COMPLETED = 'SESSION_ALREADY_COMPLETED',

  // Queue Management
  QUEUE_UPDATE_FAILED = 'QUEUE_UPDATE_FAILED',
  CONCURRENT_UPDATE = 'CONCURRENT_UPDATE',
  INVALID_QUEUE_STATE = 'INVALID_QUEUE_STATE',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Network & Infrastructure
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // WebSocket
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_DISCONNECTED = 'WEBSOCKET_DISCONNECTED',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Standardized error response interface
export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: string;
  retryAfter?: number;
  canRetry?: boolean;
}

// Success response interface
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
  [ErrorCode.FORBIDDEN]: 'You don\'t have permission to perform this action.',
  [ErrorCode.INVALID_REQUEST]: 'The request contains invalid information. Please check your input.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.SESSION_NOT_FOUND]: 'Charging session not found. It may have already been completed.',
  [ErrorCode.INVALID_SESSION]: 'This charging session is not valid or doesn\'t belong to you.',
  [ErrorCode.DUPLICATE_COMPLETION]: 'This charging session has already been completed.',
  [ErrorCode.SESSION_ALREADY_COMPLETED]: 'This charging session has already been completed.',
  [ErrorCode.QUEUE_UPDATE_FAILED]: 'Failed to update the queue. Please try again.',
  [ErrorCode.CONCURRENT_UPDATE]: 'Another user updated the queue at the same time. Please try again.',
  [ErrorCode.INVALID_QUEUE_STATE]: 'The queue is in an invalid state. Please refresh and try again.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',
  [ErrorCode.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
  [ErrorCode.TIMEOUT_ERROR]: 'The request timed out. Please try again.',
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong on our end. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again later.',
  [ErrorCode.WEBSOCKET_CONNECTION_FAILED]: 'Failed to connect to real-time updates. Some features may not work.',
  [ErrorCode.WEBSOCKET_DISCONNECTED]: 'Lost connection to real-time updates. Reconnecting...',
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
};

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT_ERROR,
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.CONCURRENT_UPDATE,
    ErrorCode.QUEUE_UPDATE_FAILED
  ]
};

// Creates a standardized error response
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: string,
  retryAfter?: number
): ErrorResponse {
  return {
    success: false,
    error: customMessage || ERROR_MESSAGES[code],
    code,
    details,
    retryAfter,
    canRetry: DEFAULT_RETRY_CONFIG.retryableErrors.includes(code)
  };
}

// Creates a standardized success response
export function createSuccessResponse<T>(data?: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message
  };
}

// Determines error code from various error types
export function getErrorCode(error: unknown): ErrorCode {
  // Type guard to check if error is an object with properties
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check if it's already an ErrorResponse
    if (errorObj.code && Object.values(ErrorCode).includes(errorObj.code as ErrorCode)) {
      return errorObj.code as ErrorCode;
    }

    // Check for specific error patterns
    if (errorObj.name === 'ValidationError') {
      return ErrorCode.VALIDATION_ERROR;
    }

    if (errorObj.name === 'MongoError' || errorObj.name === 'MongoServerError') {
      if (errorObj.code === 11000) {
        return ErrorCode.DUPLICATE_COMPLETION;
      }
      return ErrorCode.DATABASE_ERROR;
    }

    const message = typeof errorObj.message === 'string' ? errorObj.message : '';

    if (message.includes('timeout')) {
      return ErrorCode.TIMEOUT_ERROR;
    }

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCode.NETWORK_ERROR;
    }

    if (message.includes('unauthorized')) {
      return ErrorCode.UNAUTHORIZED;
    }

    if (message.includes('forbidden')) {
      return ErrorCode.FORBIDDEN;
    }
  }

  return ErrorCode.UNKNOWN_ERROR;
}

// Calculates delay for exponential backoff
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Adds jitter to prevent thundering herd problem
 */
function addJitter(delay: number): number {
  return delay + Math.random() * 1000;
}

// Retry wrapper with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorCode = getErrorCode(error);

      // Don't retry if error is not retryable
      if (!finalConfig.retryableErrors.includes(errorCode)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts - 1) {
        break;
      }

      // Calculate delay with jitter
      const baseDelay = calculateBackoffDelay(attempt, finalConfig);
      const delayWithJitter = addJitter(baseDelay);

      console.log(
        `Operation failed (attempt ${attempt + 1}/${finalConfig.maxAttempts}): ${error} ` +
        `Retrying in ${Math.round(delayWithJitter)}ms...`
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayWithJitter));
    }
  }

  throw lastError;
}

// Wraps fetch requests with error handling and retry logic
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData.code || getErrorCode({ message: `HTTP ${response.status}` });

        throw {
          code: errorCode,
          message: errorData.error || `Request failed with status ${response.status}`,
          status: response.status
        };
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError') {
        throw {
          code: ErrorCode.TIMEOUT_ERROR,
          message: 'Request timed out'
        };
      }

      throw error;
    }
  }, retryConfig);
}

/**
 * Parses API response and handles errors
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  try {
    const data = await response.json();

    if (!data.success) {
      throw {
        code: data.code || ErrorCode.UNKNOWN_ERROR,
        message: data.error || 'Unknown error occurred',
        details: data.details,
        canRetry: data.canRetry
      };
    }

    return data;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { code?: ErrorCode };
      if (errorObj.code) {
        throw error;
      }
    }

    throw {
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'Failed to parse response'
    };
  }
}

// Enhanced API call wrapper with comprehensive error handling
export async function apiCall<T>(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  try {
    const response = await fetchWithRetry(url, options, retryConfig);
    return await parseApiResponse<T>(response);
  } catch (error: unknown) {
    const errorCode = getErrorCode(error);
    let errorMessage = ERROR_MESSAGES[errorCode];
    let details: string | undefined;

    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { message?: string; details?: string };
      errorMessage = errorObj.message || errorMessage;
      details = errorObj.details;
    }

    throw createErrorResponse(errorCode, errorMessage, details);
  }
}

/**
 * Utility to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorCode = getErrorCode(error);
  return DEFAULT_RETRY_CONFIG.retryableErrors.includes(errorCode);
}

/**
 * Utility to get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorCode = getErrorCode(error);

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { message?: string };
    return errorObj.message || ERROR_MESSAGES[errorCode];
  }

  return ERROR_MESSAGES[errorCode];
}

/**
 * Debounce utility for preventing rapid successive calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility for limiting call frequency
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}