import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Two static, batched silhouette layers belong to the scenery camera. They
// frame the selectable tree without adding actors, textures or animation.
export function createForestBackdrop(scene) {
  const root = new THREE.Group(); root.name = 'diy-forest'; root.visible = false;
  root.scale.set(.72, .78, 1);
  const outline = new THREE.Shape();
  outline.moveTo(0, 1);
  outline.quadraticCurveTo(-.07, .82, -.24, .65);
  outline.quadraticCurveTo(-.18, .65, -.12, .67);
  outline.quadraticCurveTo(-.22, .46, -.36, .35);
  outline.quadraticCurveTo(-.27, .35, -.21, .38);
  outline.quadraticCurveTo(-.31, .17, -.47, .05);
  outline.quadraticCurveTo(0, -.035, .47, .05);
  outline.quadraticCurveTo(.31, .17, .21, .38);
  outline.quadraticCurveTo(.27, .35, .36, .35);
  outline.quadraticCurveTo(.22, .46, .12, .67);
  outline.quadraticCurveTo(.18, .65, .24, .65);
  outline.quadraticCurveTo(.07, .82, 0, 1);
  const template = new THREE.ShapeGeometry(outline, 5);
  const layers = [
    { color: 0x0e202e, trees: [[-8, 8, 17], [-5.5, 7.4, 20], [-2.8, 8.9, 18], [0, 7.6, 21], [2.7, 8.5, 19], [5.5, 7.1, 22], [8, 8.2, 18]] },
    { color: 0x132c37, trees: [[-5.3, 4.8, 8], [-3.4, 6.1, 10], [-1.4, 4.2, 9], [1.7, 5.3, 11], [3.6, 5.9, 8], [5.6, 4.6, 10]] },
  ];
  for (const { color, trees } of layers) {
    const pieces = trees.map(([x, height, depth]) => template.clone().scale(height * .6, height, 1).translate(x, -.1, -depth));
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
    root.add(new THREE.Mesh(mergeGeometries(pieces), material));
    pieces.forEach(g => g.dispose());
  }
  template.dispose(); scene.add(root);
  return {
    place(position, right, scale = 1) {
      root.scale.set(.72 * scale, .78 * scale, scale);
      root.position.copy(position).addScaledVector(right, 1.2 * scale);
      root.rotation.y = Math.atan2(-right.z, right.x);
    },
    setVisible(visible) { root.visible = visible; },
    dispose() { root.removeFromParent(); root.children.forEach(o => { o.geometry.dispose(); o.material.dispose(); }); },
  };
}
