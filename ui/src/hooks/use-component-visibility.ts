/**
 * Component Visibility Hook
 * 
 * Allows components to check if they should be visible based on:
 * 1. Admin-configured visibility rules (user categories)
 * 2. Permission-based fallback
 * 
 * This enables admins to configure UI component visibility without code changes.
 */

import * as React from 'react';
import { useAuth } from '../contexts/auth-context';
import { useDynamicUI } from './use-dynamic-ui';
import { api } from '../services/api';

const visibilityConfigCache = new Map<string, any>();
const visibilityConfigInFlight = new Map<string, Promise<any>>();

async function fetchVisibilityConfigForUser(userId: string) {
  if (visibilityConfigCache.has(userId)) {
    return visibilityConfigCache.get(userId);
  }

  const existingPromise = visibilityConfigInFlight.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = (async () => {
    const response = await api.get(`/api/admin/component-visibility/user/${userId}`);
    if (response.success && response.data) {
      visibilityConfigCache.set(userId, response.data);
      return response.data;
    }
    return null;
  })();

  visibilityConfigInFlight.set(userId, requestPromise);
  try {
    return await requestPromise;
  } finally {
    visibilityConfigInFlight.delete(userId);
  }
}

export interface ComponentVisibilityOptions {
  /**
   * Permission to check if no category config exists
   */
  fallbackPermission?: string;
  
  /**
   * Custom fallback check function
   */
  fallbackCheck?: (features: any) => boolean;
  
  /**
   * Default visibility if no config and no fallback
   */
  defaultVisible?: boolean;
  
  /**
   * Default enabled state if no config
   */
  defaultEnabled?: boolean;
}

export interface ComponentVisibilityResult {
  /**
   * Whether the component should be visible
   */
  isVisible: boolean;
  
  /**
   * Whether the component should be enabled (clickable/interactive)
   */
  isEnabled: boolean;
  
  /**
   * Whether visibility config is loading
   */
  isLoading: boolean;
  
  /**
   * The source of the visibility decision
   */
  source: 'config' | 'fallback' | 'default';
}

/**
 * Hook to check component visibility based on admin configuration
 * 
 * @param componentId - Unique identifier for the component (e.g., 'leave.create.button')
 * @param options - Fallback options if no category config exists
 * @returns ComponentVisibilityResult
 * 
 * @example
 * ```tsx
 * const { isVisible, isEnabled } = useComponentVisibility('leave.create.button', {
 *   fallbackPermission: 'leave.create',
 *   fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
 * });
 * 
 * if (!isVisible) return null;
 * 
 * return <Button disabled={!isEnabled}>Create Leave</Button>;
 * ```
 */
export function useComponentVisibility(
  componentId: string,
  options: ComponentVisibilityOptions = {}
): ComponentVisibilityResult {
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const [config, setConfig] = React.useState<{
    visible: boolean;
    enabled: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [source, setSource] = React.useState<'config' | 'fallback' | 'default'>('default');

  React.useEffect(() => {
    if (!user?.id || uiLoading) {
      setIsLoading(false);
      return;
    }

    loadComponentVisibility();
  }, [user?.id, componentId, uiLoading]);

  const loadComponentVisibility = async () => {
    try {
      setIsLoading(true);
      
      // Try to fetch admin-configured visibility
      try {
        const data = await fetchVisibilityConfigForUser(user.id);

        if (data) {
          const componentConfig = data.visible_components?.find(
            (comp: any) => comp.component_id === componentId
          );

          if (componentConfig) {
            setConfig({
              visible: componentConfig.visible,
              enabled: componentConfig.enabled,
            });
            setSource('config');
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        // API endpoint might not exist yet, fall back to permission check
        // Keep this silent to avoid noisy client logs.
      }

      // Fallback to permission-based check
      if (options.fallbackCheck) {
        const visible = options.fallbackCheck(features);
        setConfig({
          visible,
          enabled: visible,
        });
        setSource('fallback');
      } else if (options.fallbackPermission) {
        // Simple permission check
        const hasPermission = features.isAdmin || 
          (features as any)[`can${options.fallbackPermission.split('.').map((s: string) => 
            s.charAt(0).toUpperCase() + s.slice(1)
          ).join('')}`] ||
          false;
        
        setConfig({
          visible: hasPermission,
          enabled: hasPermission,
        });
        setSource('fallback');
      } else {
        // Use default
        setConfig({
          visible: options.defaultVisible ?? true,
          enabled: options.defaultEnabled ?? true,
        });
        setSource('default');
      }
    } catch (error) {
      console.error(`[ComponentVisibility] Error loading config for ${componentId}:`, error);
      
      // Fallback on error
      if (options.fallbackCheck) {
        const visible = options.fallbackCheck(features);
        setConfig({
          visible,
          enabled: visible,
        });
        setSource('fallback');
      } else {
        setConfig({
          visible: options.defaultVisible ?? true,
          enabled: options.defaultEnabled ?? true,
        });
        setSource('default');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isVisible: config?.visible ?? (options.defaultVisible ?? true),
    isEnabled: config?.enabled ?? (options.defaultEnabled ?? true),
    isLoading: isLoading || uiLoading,
    source,
  };
}
