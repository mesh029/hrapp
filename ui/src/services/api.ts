/**
 * API Service Layer
 * Centralized API client for frontend-backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async refreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      // Use relative path for Next.js API routes
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.accessToken) {
          localStorage.setItem('accessToken', data.data.accessToken);
          if (data.data.refreshToken) {
            localStorage.setItem('refreshToken', data.data.refreshToken);
          }
          return data.data.accessToken;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    // Do not clear tokens here. A transient refresh failure should not force logout.
    // Callers can decide whether to logout based on route/context.
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;
    
    // Determine if this is a Next.js API route or Docker API route
    // Next.js API routes: /api/workflows, /api/leave, /api/timesheets, /api/users, /api/admin, /api/delegations, /api/employees
    // Docker API routes: everything else
    const isNextJsRoute = endpoint.startsWith('/api/workflows') ||
                         endpoint.startsWith('/api/leave') ||
                         endpoint.startsWith('/api/timesheets') ||
                         endpoint.startsWith('/api/users') ||
                         endpoint.startsWith('/api/admin') ||
                         endpoint.startsWith('/api/delegations') ||
                         endpoint.startsWith('/api/notifications') ||
                         endpoint.startsWith('/api/auth') ||
                         endpoint.startsWith('/api/reports') ||
                         endpoint.startsWith('/api/employees');
    
    let url: string;
    if (API_BASE_URL && !isNextJsRoute) {
      // Proxy route for Docker API - remove /api prefix if present since proxy adds it
      const cleanEndpoint = endpoint.startsWith('/api/') 
        ? endpoint.substring(4) // Remove '/api'
        : endpoint.startsWith('/') 
          ? endpoint 
          : `/${endpoint}`;
      url = `/api/proxy${cleanEndpoint}`;
    } else {
      // Direct Next.js API route
      url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string> || {}),
    };

    if (!skipAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response = await fetch(url, {
      ...fetchOptions,
      headers: headers as HeadersInit,
      body: fetchOptions.body,
    });

    // Handle 401 - try to refresh token
    if (response.status === 401 && !skipAuth) {
      const newToken = await this.refreshToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, {
          ...fetchOptions,
          headers,
        });
      }
    }

    const responseData = await response.json().catch(() => ({ 
      success: false,
      message: `HTTP ${response.status}` 
    }));

    // For 404, 400, 403, and 405, return the error response structure instead of throwing
    // This allows the frontend to check response.success
    // Also handle 401 if it's a permission error (not auth error)
    if (!response.ok && (response.status === 404 || response.status === 400 || response.status === 403 || response.status === 405 || 
        (response.status === 401 && responseData.message && responseData.message.includes('permission')))) {
      return responseData as T;
    }

    // For server errors (500+) and auth errors (401 without permission message), still throw
    if (!response.ok) {
      throw new Error(responseData.message || `Request failed: ${response.status}`);
    }

    return responseData;
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
