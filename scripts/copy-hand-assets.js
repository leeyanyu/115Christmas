import { cp, mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('@mediapipe/tasks-vision'));
const { version } = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
const destination = resolve(`public/hand-tracking/${version}`);
await mkdir(destination, { recursive: true });
const exists = file => access(file).then(() => true, () => false);
// Immutable assets: repeated builds must not replace files an already-running
// Vite server is serving. Gzip also reduces the initial network transfer.
for (const file of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
  const from = resolve(source, 'wasm', file), to = resolve(destination, file);
  if (file.endsWith('.wasm')) {
    if (!await exists(`${to}.gz`)) await writeFile(`${to}.gz`, gzipSync(await readFile(from), { level: 9 }));
  } else await cp(from, to, { force: false });
}
const model = resolve(destination, 'hand_landmarker-fbc2a300.task.gz');
if (!await exists(model)) await writeFile(model, gzipSync(await readFile('assets/hand-tracking/hand_landmarker.task'), { level: 9 }));
await cp('assets/hand-tracking/NOTICE.md', resolve(destination, 'NOTICE.txt'));
await cp('licenses/mediapipe-Apache-2.0.txt', resolve(destination, 'LICENSE.txt'));
