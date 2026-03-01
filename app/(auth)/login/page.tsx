'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { usersService } from '@/ui/src/services/users';
import { api } from '@/ui/src/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface QuickLoginUser {
  id: string;
  name: string;
  email: string;
  status: string;
  primary_location?: {
    id: string;
    name: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showQuickLogin, setShowQuickLogin] = React.useState(false);
  const [quickLoginUsers, setQuickLoginUsers] = React.useState<QuickLoginUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [isQuickLoggingIn, setIsQuickLoggingIn] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState('admin@test.com');
  const [adminPassword, setAdminPassword] = React.useState('Password123!');

  const loadQuickLoginUsers = React.useCallback(async () => {
    setIsLoadingUsers(true);
    setError('');
    try {
      // Use the public endpoint that doesn't require authentication
      const response = await api.get<{ success?: boolean; data?: { users?: QuickLoginUser[] } }>('/api/auth/quick-login/users?limit=100&status=active', { skipAuth: true });
      console.log('Users response:', response);
      if (response && 'success' in response && response.success && response.data) {
        const users = response.data.users || [];
        console.log('Parsed users:', users.length);
        setQuickLoginUsers(users);
        setShowQuickLogin(true);
      } else {
        console.error('Failed to load users:', response);
        setError('Failed to load users.');
      }
    } catch (error: any) {
      console.error('Failed to load users for quick login:', error);
      setError(error.message || 'Failed to load users.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Load users for quick login automatically when component mounts
  React.useEffect(() => {
    // Users can be loaded without authentication now
    loadQuickLoginUsers();
  }, [loadQuickLoginUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const { quickLogin } = useAuth();

  const handleQuickLogin = async () => {
    if (!selectedUserId) {
      setError('Please select a user to login as');
      return;
    }

    if (!adminEmail || !adminPassword) {
      setError('Please enter admin credentials');
      return;
    }

    setIsQuickLoggingIn(true);
    setError('');

    try {
      await quickLogin(selectedUserId, adminEmail, adminPassword);
    } catch (err: any) {
      console.error('Quick login error:', err);
      setError(err.message || 'Failed to login as user. Please check admin credentials.');
    } finally {
      setIsQuickLoggingIn(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">HR</span>
            </div>
            <h1 className="text-2xl font-bold">HR App</h1>
          </div>
          <h2 className="text-xl font-semibold">Welcome back</h2>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Quick Login Section (for Admins) */}
        <div className="space-y-4 border-t pt-4">
          <button
            type="button"
            onClick={() => {
              if (!showQuickLogin) {
                loadQuickLoginUsers();
              } else {
                setShowQuickLogin(false);
              }
            }}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Quick Login (Admin Only)</span>
            </div>
            {showQuickLogin ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showQuickLogin && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground">
                Select a user to quickly login as them. This feature requires admin credentials.
              </p>
              
              {/* Admin Credentials */}
              <div className="space-y-2 p-2 rounded bg-background border border-border">
                <Label className="text-xs font-semibold">Admin Credentials</Label>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="admin-email" className="text-xs">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@test.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      disabled={isQuickLoggingIn}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-password" className="text-xs">Admin Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      disabled={isQuickLoggingIn}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {isLoadingUsers ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading users...
                </div>
              ) : quickLoginUsers.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No users found. Please ensure you are logged in as an admin.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="quick-login-user">Select User</Label>
                    <Select
                      value={selectedUserId}
                      onValueChange={(value) => {
                        console.log('Selected user:', value);
                        setSelectedUserId(value);
                      }}
                      disabled={isQuickLoggingIn || isLoadingUsers}
                    >
                      <SelectTrigger id="quick-login-user" className="w-full">
                        <SelectValue placeholder={isLoadingUsers ? "Loading users..." : quickLoginUsers.length === 0 ? "No users available" : "Choose a user to login as..."} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {isLoadingUsers ? (
                          <SelectItem value="__loading__" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading users...
                            </div>
                          </SelectItem>
                        ) : quickLoginUsers.length === 0 ? (
                          <SelectItem value="__empty__" disabled>No users available</SelectItem>
                        ) : (
                          quickLoginUsers.map(user => (
                            <SelectItem key={user.id} value={user.id} className="cursor-pointer">
                              <div className="flex flex-col gap-1 py-1">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                {user.primary_location && (
                                  <span className="text-xs text-muted-foreground">{user.primary_location.name}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {quickLoginUsers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {quickLoginUsers.length} user(s) available
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="button"
                    onClick={handleQuickLogin}
                    disabled={!selectedUserId || isQuickLoggingIn || !adminEmail || !adminPassword}
                    className="w-full"
                    variant="outline"
                  >
                    {isQuickLoggingIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <Users className="mr-2 h-4 w-4" />
                        Login as Selected User
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Default Admin Login Helper */}
          <div className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={async () => {
                setEmail('admin@test.com');
                setPassword('Password123!');
                setError('');
                setIsLoading(true);
                try {
                  await login('admin@test.com', 'Password123!');
                } catch (err: any) {
                  console.error('Login error:', err);
                  setError(err.message || 'An error occurred during login');
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full p-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <p className="font-semibold mb-2 text-primary">Quick Login as Admin</p>
              <div className="space-y-1 text-xs">
                <p><span className="font-medium">Email:</span> <span className="font-mono">admin@test.com</span></p>
                <p><span className="font-medium">Password:</span> <span className="font-mono">Password123!</span></p>
              </div>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
