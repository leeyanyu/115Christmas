import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { createARTree, disposeARTree } from '../src/ar/model.js';
import { findARTree } from '../src/ar/catalog.js';

// The current tree has geometry-only lettering and no browser image textures.
// Three's GLB exporter only needs this small Blob reader when run in Node.
if (!globalThis.FileReader) globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); })
      .catch(error => { this.error = error; this.onerror?.(error); });
  }
};

const tree = findARTree();
const model = createARTree(tree.heightMeters);
try {
  const glb = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
  const usdz = await new USDZExporter().parseAsync(model, { quickLookCompatible: true });
  await mkdir(new URL('../public/ar/models/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../public/${tree.glb}`, import.meta.url), new Uint8Array(glb));
  await writeFile(new URL(`../public/${tree.usdz}`, import.meta.url), usdz);
  console.log(`AR tree: GLB ${(glb.byteLength / 1024).toFixed(0)} KB; USDZ ${(usdz.byteLength / 1024).toFixed(0)} KB`);
} finally { disposeARTree(model); }
