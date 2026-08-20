/**
 * Runtime Configuration Service
 *
 * This service fetches configuration from the /config endpoint at runtime,
 * allowing environment variables to override build-time configuration.
 */

export interface RuntimeConfig {
  AP_APP_TITLE: string;
  AP_FAVICON_URL: string;
  GATEWAY_URL: string;
  AP_FRONTEND_URL: string;
  AP_ENVIRONMENT: string;
  AP_CHAT_WIDGET: string;
  AP_GATEWAY_URL: string;
  AP_IMBRACE_ADDING_CONNECTION_PIECES: string;
}

interface BuildTimeConfig {
  VITE_APP_TITLE?: string;
  VITE_FAVICON_URL?: string;
  VITE_GATEWAY_URL?: string;
  VITE_FRONTEND_URL?: string;
  VITE_ENVIRONMENT?: string;
  VITE_CHAT_WIDGET?: string;
  VITE_APP_GATEWAY_URL?: string;
  VITE_IMBRACE_ADDING_CONNECTION_PIECES?: string;
}

class RuntimeConfigService {
  private config: RuntimeConfig | null = null;
  private isLoading = false;
  private loadPromise: Promise<RuntimeConfig> | null = null;

  /**
   * Load runtime configuration from /config endpoint
   * Falls back to build-time configuration if fetch fails
   */
  async loadConfig(): Promise<RuntimeConfig> {
    // Return cached config if already loaded
    if (this.config) {
      return this.config;
    }

    // Return existing promise if already loading
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.fetchConfig();

    try {
      this.config = await this.loadPromise;
      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get current config (synchronously)
   * Returns null if config hasn't been loaded yet
   */
  getCurrentConfig(): RuntimeConfig | null {
    return this.config;
  }

  /**
   * Check if config is currently loading
   */
  isLoadingConfig(): boolean {
    return this.isLoading;
  }

  /**
   * Reload configuration from server
   */
  async reloadConfig(): Promise<RuntimeConfig> {
    this.config = null;
    this.loadPromise = null;
    return this.loadConfig();
  }

  private async fetchConfig(): Promise<RuntimeConfig> {
    try {
      console.log('Fetching runtime configuration from /config...');
      const response = await fetch('/config', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }

      const runtimeConfig = await response.json();
      console.log('Runtime configuration loaded:', runtimeConfig);

      // Validate required fields
      this.validateConfig(runtimeConfig);

      // Merge: runtime config overrides build-time config
      const buildTimeConfig = this.getBuildTimeConfig();
      return {
        ...buildTimeConfig,
        ...Object.fromEntries(
          Object.entries(runtimeConfig).filter(([, v]) => v !== undefined && v !== '')
        ),
      } as RuntimeConfig;
    } catch (error) {
      console.warn('Failed to load runtime configuration, falling back to build-time config:', error);
      return this.getBuildTimeConfig();
    }
  }

  private validateConfig(config: RuntimeConfig): void {
    const requiredFields: (keyof RuntimeConfig)[] = [
      'AP_APP_TITLE',
      'AP_FAVICON_URL',
      'GATEWAY_URL',
      'AP_FRONTEND_URL',
      'AP_ENVIRONMENT'
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        console.warn(`Runtime config missing required field: ${field}`);
      }
    }
  }

  private getBuildTimeConfig(): RuntimeConfig {
    console.log('Using build-time configuration fallback');

    // Get build-time config from import.meta.env (Vite) or process.env
    const buildTimeConfig: BuildTimeConfig = {
      VITE_APP_TITLE: import.meta.env?.VITE_APP_TITLE,
      VITE_FAVICON_URL: import.meta.env?.VITE_FAVICON_URL,
      VITE_GATEWAY_URL: import.meta.env?.VITE_GATEWAY_URL,
      VITE_FRONTEND_URL: import.meta.env?.VITE_FRONTEND_URL,
      VITE_ENVIRONMENT: import.meta.env?.VITE_ENVIRONMENT,
      VITE_CHAT_WIDGET: import.meta.env?.VITE_CHAT_WIDGET,
      VITE_APP_GATEWAY_URL: import.meta.env?.VITE_APP_GATEWAY_URL,
      VITE_IMBRACE_ADDING_CONNECTION_PIECES: import.meta.env?.VITE_IMBRACE_ADDING_CONNECTION_PIECES,
    };

    return {
      AP_APP_TITLE: buildTimeConfig.VITE_APP_TITLE || 'Imbrace',
      AP_FAVICON_URL: buildTimeConfig.VITE_FAVICON_URL || '/imbrace-favicon.png',
      GATEWAY_URL: buildTimeConfig.VITE_GATEWAY_URL || '/api',
      AP_FRONTEND_URL: buildTimeConfig.VITE_FRONTEND_URL || window.location.origin,
      AP_ENVIRONMENT: buildTimeConfig.VITE_ENVIRONMENT || 'production',
      AP_CHAT_WIDGET: buildTimeConfig.VITE_CHAT_WIDGET || 'https://chat-widget.dev.imbrace.co',
      AP_GATEWAY_URL: buildTimeConfig.VITE_APP_GATEWAY_URL || 'https://app-gateway.dev.imbrace.co',
      AP_IMBRACE_ADDING_CONNECTION_PIECES: buildTimeConfig.VITE_IMBRACE_ADDING_CONNECTION_PIECES || '',
    };
  }

  /**
   * Apply configuration to the DOM
   * Updates document title, favicon, etc.
   */
  applyConfigToDOM(config: RuntimeConfig): void {
    try {
      // Update document title (hardcoded to Imbrace)
      if (document.title !== 'Imbrace') {
        document.title = 'Imbrace';
      }

      // Update favicon
      if (config.AP_FAVICON_URL) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }

        if (favicon.href !== config.AP_FAVICON_URL) {
          favicon.href = config.AP_FAVICON_URL;
          console.log('Updated favicon to:', config.AP_FAVICON_URL);
        }
      }

      // Update meta tags if needed
      this.updateMetaTag('og:title', config.AP_APP_TITLE);
      this.updateMetaTag('og:site_name', config.AP_APP_TITLE);
    } catch (error) {
      console.error('Error applying config to DOM:', error);
    }
  }

  private updateMetaTag(property: string, content: string): void {
    if (!content) return;

    let metaTag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }

    if (metaTag.content !== content) {
      metaTag.content = content;
    }
  }
}

// Create and export singleton instance
export const runtimeConfigService = new RuntimeConfigService();

// Export default for easier importing
export default runtimeConfigService;