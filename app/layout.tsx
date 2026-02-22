import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'reactflow/dist/style.css';
import './globals.css';
import { AuthProvider } from '@/ui/src/contexts/auth-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'HR Management System',
  description: 'Comprehensive HR management system with leave, timesheet, and workflow management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
