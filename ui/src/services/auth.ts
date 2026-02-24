/**
 * Authentication Service
 */

import { api } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      status: string;
    };
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return api.post<AuthResponse>('/api/auth/login', credentials, { skipAuth: true });
  },

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    return api.post<AuthResponse>('/api/auth/refresh', { refreshToken }, { skipAuth: true });
  },

  async quickLogin(userId: string, adminEmail?: string, adminPassword?: string): Promise<AuthResponse> {
    // If admin credentials are provided, use the unauthenticated endpoint
    if (adminEmail && adminPassword) {
      return api.post<AuthResponse>('/api/auth/quick-login', { 
        adminEmail, 
        adminPassword, 
        userId 
      }, { skipAuth: true });
    }
    // Otherwise, use the authenticated endpoint (for when admin is already logged in)
    return api.post<AuthResponse>('/api/admin/users/quick-login', { userId });
  },

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      // Decode JWT to get user info (basic implementation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.userId,
        email: payload.email,
        name: payload.name || '',
        status: payload.status || 'active',
      };
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },
};
