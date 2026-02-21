import type { Metadata } from 'next';
import 'reactflow/dist/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'PATH HR System - Workflow Visualizations',
  description: 'Interactive workflow visualizations for the PATH HR System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
