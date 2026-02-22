'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'minimized';
  }
>(({ className, variant = 'default', ...props }, ref) => {
  return (
    <aside
      ref={ref}
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out',
        variant === 'minimized' ? 'w-16' : 'w-64',
        'bg-sidebar border-r border-sidebar-border overflow-hidden',
        className
      )}
      {...props}
    />
  );
});
Sidebar.displayName = 'Sidebar';

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex items-center justify-between p-4 border-b border-sidebar-border', className)}
      {...props}
    />
  );
});
SidebarHeader.displayName = 'SidebarHeader';

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex-1 overflow-y-auto overflow-x-hidden p-2', className)}
      {...props}
    />
  );
});
SidebarContent.displayName = 'SidebarContent';

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('p-4 border-t border-sidebar-border', className)}
      {...props}
    />
  );
});
SidebarFooter.displayName = 'SidebarFooter';

const sidebarItemVariants = cva(
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active: 'bg-sidebar-primary text-sidebar-primary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const SidebarItem = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> &
    VariantProps<typeof sidebarItemVariants> & {
      icon?: React.ReactNode;
      minimized?: boolean;
    }
>(({ className, variant, icon, minimized = false, children, ...props }, ref) => {
  return (
    <a
      ref={ref}
      className={cn(sidebarItemVariants({ variant }), className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </a>
  );
});
SidebarItem.displayName = 'SidebarItem';

export { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarItem };
