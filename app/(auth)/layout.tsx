import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - HR App',
  description: 'Sign in to HR Management System',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
