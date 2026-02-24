'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { authService, User } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (userId: string, adminEmail?: string, adminPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    // Check if user is authenticated on mount
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
    // Don't redirect here - let the root page handle it
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    if (response.success && response.data) {
      localStorage.setItem('accessToken', response.data.accessToken);
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      setUser(response.data.user);
      router.push('/dashboard');
    } else {
      // Throw error so the login page can display it
      throw new Error(response.message || 'Login failed. Please check your credentials.');
    }
  };

  const quickLogin = async (userId: string, adminEmail?: string, adminPassword?: string) => {
    const response = await authService.quickLogin(userId, adminEmail, adminPassword);
    if (response.success && response.data) {
      // Store tokens first - ensure they're set before any navigation
      localStorage.setItem('accessToken', response.data.accessToken);
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      // Update user state immediately
      setUser(response.data.user);
      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 50));
      // Use window.location for a full page reload to ensure auth state is properly initialized
      window.location.href = '/dashboard';
    } else {
      throw new Error(response.message || 'Quick login failed');
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.push('/login');
  };

  const refreshUser = () => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, quickLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
