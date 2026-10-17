import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { characterMaterial } from './holiday-character.js';

export function createTreeGifts(tree) {
  const root = new THREE.Group(); root.name = 'tree-gifts'; root.visible = false;
  tree.root.add(root);
  const box = new RoundedBoxGeometry(1, 1, 1, 2, .07);
  const bow = new THREE.TorusGeometry(.13, .025, 6, 16);
  const gold = characterMaterial({ color: 0xe0c28a, metalness: .45, roughness: .42 });
  const materials = [0xb98294, 0x91a897, 0xb9a1bd].map(color => characterMaterial({ color, roughness: .62, metalness: .08 }));
  const point = new THREE.Vector3(), roll = new THREE.Quaternion();
  const gifts = [
    { angle: -.58, size: .21, delay: .5 },
    { angle: .60, size: .19, delay: 1.25 },
    { angle: -1.02, size: .17, delay: 2 },
  ].map((settings, index) => {
    const group = new THREE.Group(); group.name = `small-gift-${index + 1}`; root.add(group);
    function piece(geometry, material, x, y, z, sx, sy, sz) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
    }
    piece(box, materials[index], 0, -.08, 0, 1, .84, 1);
    piece(box, materials[index], 0, .395, 0, 1.06, .17, 1.06);
    piece(box, gold, 0, 0, 0, .095, 1.015, 1.085);
    piece(box, gold, 0, 0, 0, 1.085, 1.015, .095);
    for (const side of [-1, 1]) {
      const loop = piece(bow, gold, side * .105, .58, 0, 1, .8, 1); loop.rotation.z = side * -.5;
    }
    // Precompute support points so tumbling boxes and bows cannot sink into
    // the pedestal. This storage, geometry, and materials are reused on replay.
    const support = []; group.updateMatrixWorld(true);
    group.children.forEach(mesh => {
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) support.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrix));
    });
    return { ...settings, group, support,
      axis: new THREE.Vector3(Math.cos(settings.angle), 0, -Math.sin(settings.angle)),
      resting: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index % 2 ? -.22 : .18),
    };
  });
  let elapsed = 0;
  function place(gift, progress) {
    const t = 1 - (1 - progress) ** 3, radius = THREE.MathUtils.lerp(3.3, 1.54, t);
    roll.setFromAxisAngle(gift.axis, -(radius - 1.54) / (gift.size * .55));
    gift.group.quaternion.copy(roll).multiply(gift.resting);
    let bottom = Infinity;
    for (const sample of gift.support) bottom = Math.min(bottom, point.copy(sample).applyQuaternion(gift.group.quaternion).y * gift.size);
    gift.group.scale.setScalar(gift.size);
    gift.group.position.set(Math.sin(gift.angle) * radius, .08 - bottom, Math.cos(gift.angle) * radius);
  }
  return {
    update(delta, ready, reducedMotion) {
      root.visible = ready; if (!ready) return;
      elapsed = reducedMotion ? 5.2 : elapsed + delta;
      for (const gift of gifts) {
        gift.group.visible = reducedMotion || elapsed >= gift.delay;
        place(gift, reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - gift.delay) / 3.2, 0, 1));
      }
    },
    reset() { elapsed = 0; root.visible = false; },
    dispose() { root.removeFromParent(); box.dispose(); bow.dispose(); gold.dispose(); materials.forEach(material => material.dispose()); },
  };
}
