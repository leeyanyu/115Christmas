import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/115Christmas/',
  build: { rollupOptions: { input: {
    invitation: fileURLToPath(new URL('./index.html', import.meta.url)),
    ar: fileURLToPath(new URL('./ar.html', import.meta.url)),
  } } },
  // The model library is first imported inside a lazy worker. Prebundle it so
  // the first camera activation does not trigger a dev-server page reload.
  optimizeDeps: { include: ['@mediapipe/tasks-vision'] },
});
