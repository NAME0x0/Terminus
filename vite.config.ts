import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'terminal-vendor', test: /node_modules[\\/]@xterm/, priority: 30 },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)/, priority: 25 },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](@radix-ui|radix-ui|lucide-react|cmdk)/,
              priority: 20,
              maxSize: 300_000
            },
            { name: 'tauri-vendor', test: /node_modules[\\/]@tauri-apps/, priority: 15 }
          ]
        }
      }
    }
  }
});
