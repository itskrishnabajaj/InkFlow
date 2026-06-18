import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The site is served from GitHub Pages under the repository path.
// (Repo name is "InkFlow"; Pages is case-sensitive.)
const REPO_BASE = '/InkFlow/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  resolve: {
    alias: {
      '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@worldgen': fileURLToPath(new URL('./src/worldgen', import.meta.url)),
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy renderer dependency so it caches independently.
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
}));
