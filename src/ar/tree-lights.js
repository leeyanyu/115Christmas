import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Real PBR meshes/emission survive GLB and USDZ export. No screen bloom,
// particles or billboards are needed in the phone's native AR viewer.
export function addARTreeLights(tree) {
  tree.bulbs[0].material.name = 'AR-lamp';
  tree.bulbs[0].material.emissive.set(0xffedc9).multiplyScalar(.9);
  tree.bulbs[0].material.emissiveIntensity = 1;
  tree.starMaterial.name = 'AR-star';
  tree.starMaterial.emissive.copy(tree.starMaterial.color).lerp(new THREE.Color(0xffedc9), .65);
  tree.starMaterial.emissiveIntensity = 1;
  const foliage = new Set();
  tree.layers.forEach(layer => layer.traverse(o => { if (o.material) foliage.add(o.material); }));
  foliage.forEach(material => {
    material.name = 'AR-foliage';
    material.emissive.copy(material.color).multiplyScalar(.16);
    material.emissiveIntensity = 1;
  });
  const lanterns = new THREE.Group(); lanterns.name = 'AR-lanterns';
  for (const [radius, opacity, name] of [[.072, .13, 'inner'], [.11, .035, 'outer']]) {
    const sphere = new THREE.SphereGeometry(radius, 6, 4);
    const pieces = tree.bulbs.filter(bulb => bulb.visible).map(bulb => sphere.clone().translate(bulb.position.x, bulb.position.y, bulb.position.z));
    const material = new THREE.MeshStandardMaterial({ name: `AR-glow-${name}`, color: 0xffd597,
      emissive: 0xffd597, emissiveIntensity: 1, transparent: true, opacity, depthWrite: false, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(mergeGeometries(pieces), material); mesh.name = `AR-lantern-${name}`;
    lanterns.add(mesh); pieces.forEach(geometry => geometry.dispose()); sphere.dispose();
  }
  tree.root.add(lanterns);
}

// Model material names are preserved through both original and DIY GLB export.
// Fade uniforms only: repeatedly switching the light allocates no resources.
export function createARLightControl(root) {
  const materials = new Set(); root.traverse(o => {
    for (const material of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
      if (/^AR-(lamp|star|foliage|glow-)/.test(material.name)) materials.add(material);
    }
  });
  const entries = [...materials].map(material => ({ material, emission: material.emissiveIntensity, opacity: material.opacity, color: material.color.clone() }));
  let level = 1, target = 1;
  return {
    get isOn() { return target === 1; },
    toggle() { target = 1 - target; return target === 1; },
    reset() { target = 1; this.update(0, true); },
    update(delta, immediate = false) {
      level = immediate ? target : THREE.MathUtils.damp(level, target, 7, Math.min(delta, .1));
      if (Math.abs(level - target) < .001) level = target;
      for (const { material, emission, opacity, color } of entries) {
        material.emissiveIntensity = emission * level;
        if (material.name.startsWith('AR-glow-')) material.opacity = opacity * level;
        if (material.name === 'AR-lamp') material.color.copy(color).multiplyScalar(.22 + .78 * level);
      }
    },
  };
}
