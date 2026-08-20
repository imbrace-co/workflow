/**
 * React Hook for Runtime Configuration
 *
 * Provides easy access to runtime configuration in React components
 */

import { useEffect, useState } from 'react';
import { RuntimeConfig, runtimeConfigService } from './runtime-config';

export interface UseRuntimeConfigReturn {
  config: RuntimeConfig | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useRuntimeConfig(): UseRuntimeConfigReturn {
  const [config, setConfig] = useState<RuntimeConfig | null>(
    runtimeConfigService.getCurrentConfig()
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    runtimeConfigService.isLoadingConfig()
  );
  const [error, setError] = useState<Error | null>(null);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedConfig = await runtimeConfigService.loadConfig();
      setConfig(loadedConfig);

      // Apply configuration to DOM
      runtimeConfigService.applyConfigToDOM(loadedConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load config');
      setError(error);
      console.error('Failed to load runtime config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const reload = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const loadedConfig = await runtimeConfigService.reloadConfig();
      setConfig(loadedConfig);

      // Apply configuration to DOM
      runtimeConfigService.applyConfigToDOM(loadedConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reload config');
      setError(error);
      console.error('Failed to reload runtime config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load config on hook initialization
    if (!config) {
      loadConfig();
    }
  }, []);

  return {
    config,
    isLoading,
    error,
    reload,
  };
}

/**
 * Hook to get a specific config value with fallback
 */
export function useRuntimeConfigValue<K extends keyof RuntimeConfig>(
  key: K,
  fallback?: RuntimeConfig[K]
): RuntimeConfig[K] | undefined {
  const { config } = useRuntimeConfig();
  return config?.[key] ?? fallback;
}

/**
 * Hook to get the app title with fallback
 */
export function useAppTitle(fallback = 'Activepieces'): string {
  return useRuntimeConfigValue('AP_APP_TITLE', fallback) || fallback;
}

/**
 * Hook to get the gateway URL with fallback
 */
export function useGatewayUrl(fallback = '/api'): string {
  return useRuntimeConfigValue('GATEWAY_URL', fallback) || fallback;
}

/**
 * Hook to get the environment with fallback
 */
export function useEnvironment(fallback = 'production'): string {
  return useRuntimeConfigValue('AP_ENVIRONMENT', fallback) || fallback;
}