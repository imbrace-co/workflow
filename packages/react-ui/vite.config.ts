/// <reference types='vitest' />
import path from 'path';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

import customHtmlPlugin from './vite-plugins/html-plugin';

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development';

  const AP_TITLE = isDev ? 'Imbrace' : '${AP_APP_TITLE}';

  const AP_FAVICON = isDev
    ? '/imbrace-favicon.png'
    : '${AP_FAVICON_URL}';

  // Prefix for ASSET URLs only (JS/CSS/img). Does NOT touch <base href> or client-side routing.
  // Production builds emit a literal "/__AP_BASE_PATH__/" placeholder in asset URLs, which the
  // container entrypoint replaces at runtime from the BASE_PATH env var (default "/" = root).
  const AP_BASE = isDev ? '/' : '/__AP_BASE_PATH__/';

  return {
    base: AP_BASE,
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/react-ui',

    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            Host: '127.0.0.1:4200',
          },
          ws: true,
        },
        '/gateway': {
          target: 'https://app-gateway.dev.imbrace.co',
          secure: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gateway/, ''),
        },
      },
      port: 4200,
      host: '0.0.0.0',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@activepieces/shared': path.resolve(
          __dirname,
          '../../packages/shared/src',
        ),
        '@activepieces/pieces-framework': path.resolve(
          __dirname,
          '../../packages/pieces/community/framework/src',
        ),
      },
    },
    plugins: [
      react(),
      nxViteTsPaths(),

      customHtmlPlugin({
        title: AP_TITLE,
        icon: AP_FAVICON,
      }),
      checker({
        typescript: {
          buildMode: true,
          tsconfigPath: './tsconfig.json',
          root: __dirname,
        },
      }),
    ],

    build: {
      outDir: '../../dist/packages/react-ui',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        onLog(level, log, handler) {
          if (
            log.cause &&
            log.message.includes(`Can't resolve original location of error.`)
          ) {
            return;
          }
          handler(level, log);
        },
      },
    },
  };
});
