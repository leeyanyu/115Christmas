import * as THREE from 'three';

// Future class-photo planes and GLTF models can be mounted here without changing
// the invitation UI. A future MindAR adapter can attach this group to its anchor.
export function createContentRoot() {
  const root = new THREE.Group();
  root.name = 'invitation-content';
  return root;
}
