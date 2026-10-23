import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// Keep runtime/model files on the same origin. No CDN or camera uploads.
const require = createRequire(import.meta.url);
const source = dirname(require.resolve('@mediapipe/hands'));
const { version } = require('@mediapipe/hands/package.json');
const destination = resolve(`public/hand-tracking/${version}`);
await mkdir(destination, { recursive: true });
for (const file of await readdir(source)) {
  // Versioned assets are immutable. Replacing them during a parallel build
  // can invalidate Vite's public-file cache in an already running dev server.
  if (/\.(js|wasm|data|binarypb|tflite)$/.test(file)) await cp(resolve(source, file), resolve(destination, file), { force: false });
}
await writeFile(resolve(destination, 'NOTICE.txt'),
  `MediaPipe Hands ${version}, Google LLC, Apache License 2.0.\nhttps://github.com/google-ai-edge/mediapipe\nhttps://www.apache.org/licenses/LICENSE-2.0\n`);
await cp(new URL('../licenses/mediapipe-Apache-2.0.txt', import.meta.url), resolve(destination, 'LICENSE.txt'));
