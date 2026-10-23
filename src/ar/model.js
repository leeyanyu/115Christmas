import * as THREE from 'three';
import { createDesignLayer } from '../diy/design-layer.js';
import { createTree } from '../scene/tree.js';

const designLayers = new WeakMap();

// A separate static model: never mount the invitation world, actors or effects.
export function createARTree(heightMeters = 1.65, design = null) {
  const tree = createTree();
  tree.root.name = 'GJ-Christmas-2026';
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xf2dfae, emissive: 0xf2dfae, emissiveIntensity: .55,
    roughness: .4, metalness: .05,
  });
  tree.bulbs.forEach(bulb => { bulb.material.dispose(); bulb.material = lamp; });
  tree.starMaterial.emissive.set(0xffe4ac);
  tree.starMaterial.emissiveIntensity = .3;

  // USDZ supports PBR meshes, so the fine light wire becomes a static tube.
  const positions = tree.wire.geometry.attributes.position;
  const path = new THREE.CatmullRomCurve3(Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i)));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(path, 400, .006, 3, false),
    new THREE.MeshStandardMaterial({ color: 0x72633d, roughness: .6, metalness: .35 }));
  wire.name = 'light-wire'; tree.root.add(wire); tree.root.remove(tree.wire);
  tree.wire.geometry.dispose(); tree.wire.material.dispose();

  const root = new THREE.Group();
  root.name = 'AR-tree'; root.add(tree.root);
  if (design) { const layer = createDesignLayer(tree); layer.apply(design); designLayers.set(root, layer); }
  const bounds = new THREE.Box3().setFromObject(root);
  const scale = heightMeters / bounds.getSize(new THREE.Vector3()).y;
  tree.root.scale.setScalar(scale);
  tree.root.position.y = -bounds.min.y * scale;
  root.traverse(o => { o.userData = {}; });
  root.updateMatrixWorld(true);
  return root;
}

export function disposeARTree(root) {
  designLayers.get(root)?.dispose(); designLayers.delete(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => { Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); }); m.dispose(); }); textures.forEach(t => t.dispose());
}
