/**
 * Runtime Configuration Provider
 *
 * Loads and provides runtime configuration to the entire app
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { RuntimeConfig, runtimeConfigService } from '@/lib/runtime-config';

interface RuntimeConfigContextType {
  config: RuntimeConfig | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

const RuntimeConfigContext = createContext<RuntimeConfigContextType | null>(null);

interface RuntimeConfigProviderProps {
  children: React.ReactNode;
  fallbackComponent?: React.ComponentType<{ error?: Error }>;
  loadingComponent?: React.ComponentType;
}

export function RuntimeConfigProvider({
  children,
  fallbackComponent: FallbackComponent,
  loadingComponent: LoadingComponent,
}: RuntimeConfigProviderProps) {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('RuntimeConfigProvider: Loading configuration...');
      const loadedConfig = await runtimeConfigService.loadConfig();

      console.log('RuntimeConfigProvider: Configuration loaded:', loadedConfig);
      setConfig(loadedConfig);

      // Apply configuration to DOM immediately
      runtimeConfigService.applyConfigToDOM(loadedConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load runtime config');
      console.error('RuntimeConfigProvider: Failed to load config:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const reload = async () => {
    try {
      setError(null);
      const reloadedConfig = await runtimeConfigService.reloadConfig();
      setConfig(reloadedConfig);
      runtimeConfigService.applyConfigToDOM(reloadedConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reload config');
      setError(error);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Show loading component while config is loading
  if (isLoading && LoadingComponent) {
    return <LoadingComponent />;
  }

  // Show fallback component if there's an error and no config
  if (error && !config && FallbackComponent) {
    return <FallbackComponent error={error} />;
  }

  return (
    <RuntimeConfigContext.Provider
      value={{
        config,
        isLoading,
        error,
        reload,
      }}
    >
      {children}
    </RuntimeConfigContext.Provider>
  );
}

/**
 * Hook to access runtime config context
 */
export function useRuntimeConfigContext(): RuntimeConfigContextType {
  const context = useContext(RuntimeConfigContext);
  if (!context) {
    throw new Error('useRuntimeConfigContext must be used within a RuntimeConfigProvider');
  }
  return context;
}

/**
 * Default loading component
 */
function DefaultLoadingComponent() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="text-sm text-muted-foreground">Loading configuration...</span>
      </div>
    </div>
  );
}

/**
 * Default fallback component for errors
 */
function DefaultFallbackComponent({ error }: { error?: Error }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="text-destructive">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Configuration Error</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Failed to load application configuration.
            {error && (
              <span className="block mt-1 text-xs">
                Error: {error.message}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// Export default provider with default components
export function RuntimeConfigProviderWithDefaults({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeConfigProvider
      loadingComponent={DefaultLoadingComponent}
      fallbackComponent={DefaultFallbackComponent}
    >
      {children}
    </RuntimeConfigProvider>
  );
}