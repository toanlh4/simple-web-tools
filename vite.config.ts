import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` inlines all JS and CSS into one HTML file
// that opens straight from disk (file://) without a web server.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    build: single ? { outDir: 'dist-single', chunkSizeWarningLimit: 5000 } : undefined,
  };
});
