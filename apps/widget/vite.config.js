import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/widget.js',
      name: 'WBAWidget',
      formats: ['iife'],
      fileName: () => 'widget.iife.js',
    },
    emptyOutDir: true,
    rollupOptions: {
      output: {
        exports: 'default',
      },
    },
  },
});
