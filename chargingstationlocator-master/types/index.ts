// Re-export all types for easier imports
export * from './auth';
export * from './battery';
export * from './station';
export * from './queue';

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Common form types
export interface FormState {
  isLoading: boolean;
  error?: string;
  success?: boolean;
}

// Geolocation types
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}