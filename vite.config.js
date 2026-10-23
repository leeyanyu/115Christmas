import { defineConfig } from 'vite';

export default defineConfig({
  base: '/115Christmas/',
  // The model library is first imported inside a lazy worker. Prebundle it so
  // the first camera activation does not trigger a dev-server page reload.
  optimizeDeps: { include: ['@mediapipe/tasks-vision'] },
});
