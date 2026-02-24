'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Clock, 
  Workflow, 
  BarChart, 
  Shield, 
  User,
  Menu,
  Bell,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Sidebar, SidebarContent, SidebarItem } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/ui/src/contexts/auth-context';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Icon mapping for navigation
const iconMap: Record<string, any> = {
  '/dashboard': LayoutDashboard,
  '/users': Users,
  '/leave': Calendar,
  '/timesheets': Clock,
  '/workflows': Workflow,
  '/reports': BarChart,
  '/administration': Shield,
  '/profile': User,
};

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigationItems: dynamicNavItems, features, isLoading: uiLoading } = useDynamicUI();
  const { logout } = useAuth();
  const [isMinimized, setIsMinimized] = React.useState(true); // Start minimized
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const mainContentRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Auto-minimize/expand based on mouse position
  React.useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) {
      return; // Only for desktop
    }

    let hoverTimeout: NodeJS.Timeout;

    const handleMouseMove = (e: MouseEvent) => {
      const sidebar = sidebarRef.current;
      const mainContent = mainContentRef.current;
      
      if (!sidebar || !mainContent) return;

      const mouseX = e.clientX;
      const sidebarRect = sidebar.getBoundingClientRect();

      // Clear any existing timeout
      clearTimeout(hoverTimeout);

      // If mouse is over sidebar area (within 100px of left edge), expand it
      if (mouseX <= sidebarRect.right + 50) {
        clearTimeout(hoverTimeout);
        setIsMinimized(false);
      } 
      // If mouse is in main content area (far from sidebar), minimize
      else if (mouseX > sidebarRect.right + 100) {
        // Small delay before minimizing to avoid flickering
        hoverTimeout = setTimeout(() => {
          setIsMinimized(true);
        }, 500);
      }
    };

    // Handle mouse entering sidebar
    const handleSidebarEnter = () => {
      clearTimeout(hoverTimeout);
      setIsMinimized(false);
    };

    // Handle mouse leaving sidebar
    const handleSidebarLeave = () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        setIsMinimized(true);
      }, 300);
    };

    window.addEventListener('mousemove', handleMouseMove);
    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('mouseenter', handleSidebarEnter);
      sidebar.addEventListener('mouseleave', handleSidebarLeave);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (sidebar) {
        sidebar.removeEventListener('mouseenter', handleSidebarEnter);
        sidebar.removeEventListener('mouseleave', handleSidebarLeave);
      }
      clearTimeout(hoverTimeout);
    };
  }, []);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const showMinimized = isMinimized && !isMobile;

  // Map dynamic navigation items with icons
  const navigationItems = dynamicNavItems.map(item => ({
    ...item,
    icon: iconMap[item.href] || LayoutDashboard,
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <Sidebar
        ref={sidebarRef}
        variant={showMinimized ? 'minimized' : 'default'}
        className={cn(
          'hidden lg:flex transition-all duration-300 ease-in-out'
        )}
      >
        <SidebarContent className="pt-4">
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname?.startsWith(item.href);
              return (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  variant={isActive ? 'active' : 'default'}
                  icon={<Icon className="h-5 w-5 flex-shrink-0" />}
                  minimized={showMinimized}
                  className={cn(
                    showMinimized && 'justify-center',
                    'group relative'
                  )}
                >
                  {!showMinimized && <span>{item.label}</span>}
                  {showMinimized && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-border transition-opacity">
                      {item.label}
                    </span>
                  )}
                </SidebarItem>
              );
            })}
          </nav>
        </SidebarContent>
      </Sidebar>

      {/* Spacer to prevent overlap - matches sidebar width */}
      <div 
        className={cn(
          'hidden lg:block transition-all duration-300 ease-in-out flex-shrink-0',
          showMinimized ? 'w-16' : 'w-64'
        )}
      />

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
          <Sidebar
            variant="default"
            className="lg:hidden z-50"
          >
            <SidebarContent>
              <nav className="space-y-1 pt-4">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname?.startsWith(item.href);
                  return (
                    <SidebarItem
                      key={item.href}
                      href={item.href}
                      variant={isActive ? 'active' : 'default'}
                      icon={<Icon className="h-5 w-5" />}
                      minimized={false}
                      onClick={() => setIsMobileOpen(false)}
                    >
                      {item.label}
                    </SidebarItem>
                  );
                })}
              </nav>
            </SidebarContent>
          </Sidebar>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">HR Management System</h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative" ref={userMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-2 rounded-full"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User menu"
              >
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
              
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        router.push('/profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-destructive flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main ref={mainContentRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 lg:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
