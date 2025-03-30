import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: false,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'three': resolve(__dirname, 'node_modules/three'),
      'web-ifc': resolve(__dirname, 'node_modules/web-ifc')
    }
  },
  optimizeDeps: {
    exclude: ['web-ifc']
  },
  assetsInclude: ['**/*.wasm'],
  publicDir: 'public'
}); 