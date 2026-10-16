import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import typeface from './fonts/gj-signature.json' with { type: 'json' };

// Fine serif lettering lies flush on the original pedestal's upper face.
// Only the G/J glyph outlines are bundled; see fonts/LICENSE.txt.
export function createPedestalSignature() {
  const root = new THREE.Group();
  root.name = 'GJ-pedestal-signature';
  root.position.set(0, .0815, 1.43);
  root.rotation.x = -Math.PI / 2;
  const font = new FontLoader().parse(typeface);
  const geometry = new THREE.ShapeGeometry(font.generateShapes('GJ', .30), 20);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xc5a568, metalness: .72, roughness: .36,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const letters = new THREE.Mesh(geometry, material);
  letters.name = 'GJ-gold-inlay';
  root.add(letters);
  return root;
}
