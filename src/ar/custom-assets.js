import { createARTree, disposeARTree } from './model.js';

export async function createCustomARAssets(design, { quickLook = false } = {}) {
  const root = createARTree(1.65, design), urls = [];
  const makeURL = (bytes, type) => { const url = URL.createObjectURL(new Blob([bytes], { type })); urls.push(url); return url; };
  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
    const glbURL = makeURL(glb, 'model/gltf-binary');
    let usdzURL;
    if (quickLook) {
      const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
      const usdz = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, onlyVisible: true });
      usdzURL = makeURL(usdz, 'model/vnd.usdz+zip');
    }
    return { glbURL, usdzURL, dispose() { urls.splice(0).forEach(url => URL.revokeObjectURL(url)); } };
  } catch (error) { urls.forEach(url => URL.revokeObjectURL(url)); throw error; }
  finally { disposeARTree(root); }
}
