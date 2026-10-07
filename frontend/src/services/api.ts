const TOKEN_STORAGE_KEY = 'reunite_auth_token';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (err) {
    console.error('Failed to store auth token in localStorage', err);
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to remove auth token from localStorage', err);
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers = {}, ...restOptions } = options;

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getStoredToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Prepend VITE_API_URL if configured, otherwise use relative path (proxied in dev, same-origin in prod)
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = apiBase ? `${apiBase}${normalizedEndpoint}` : normalizedEndpoint;

  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
  });

  let responseData: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    if (responseData && typeof responseData === 'object') {
      const record = responseData as Record<string, unknown>;
      if (typeof record.detail === 'string') {
        errorMessage = record.detail;
      } else if (typeof record.message === 'string') {
        errorMessage = record.message;
      } else if (Array.isArray(record.non_field_errors)) {
        errorMessage = record.non_field_errors.join(' ');
      } else {
        const firstKey = Object.keys(record)[0];
        if (firstKey) {
          const val = record[firstKey];
          if (Array.isArray(val)) {
            errorMessage = `${firstKey}: ${val.join(', ')}`;
          } else if (typeof val === 'string') {
            errorMessage = `${firstKey}: ${val}`;
          }
        }
      }
    }
    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
