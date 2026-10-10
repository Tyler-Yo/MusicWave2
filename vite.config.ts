/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { serviceWorker } from './scripts/serviceWorker';

export default defineConfig({
  plugins: [react(), serviceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `.lrc` lyric files are imported with the `?raw` suffix, so no extra loader is needed.
  assetsInclude: ['**/*.lrc'],
  build: {
    rollupOptions: {
      output: {
        // Keep framework code in its own long-lived chunk.
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
