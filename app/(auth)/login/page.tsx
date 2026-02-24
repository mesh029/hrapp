'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/ui/src/contexts/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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

        <div className="text-center text-sm text-muted-foreground space-y-2">
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
            className="w-full p-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <p className="font-semibold mb-2 text-primary">Click to Login as Admin</p>
            <div className="space-y-1 text-xs text-left">
              <p><span className="font-medium">Email:</span> <span className="font-mono">admin@test.com</span></p>
              <p><span className="font-medium">Password:</span> <span className="font-mono">Password123!</span></p>
            </div>
          </button>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="font-semibold mb-2 text-xs">All Users:</p>
            <p className="text-xs">Default password: <span className="font-mono">Password123!</span></p>
            <p className="text-xs mt-1">Check seeded users for their email addresses</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
