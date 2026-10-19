import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    rollupOptions: {
      input: { main: resolve('index.html'), admin: resolve('admin/index.html') },
    },
  },
});
