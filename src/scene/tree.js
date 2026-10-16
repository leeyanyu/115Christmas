import * as THREE from 'three';
import { createPedestalSignature } from './pedestal-signature.js';

// Local coordinates keep this content independent of the camera / future AR anchor.
export function createTree() {
  const root = new THREE.Group();
  const layers = [];
  const animated = [];
  const foliage = new THREE.MeshStandardMaterial({ color: 0x164d3c, roughness: .92, metalness: .12 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8ad55, metalness: .8, roughness: .24 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, .7, 12), new THREE.MeshStandardMaterial({ color: 0x594332 }));
  trunk.position.y = .45;
  root.add(trunk);
  // Many overlapping, volumetric boughs form a silhouette with a natural serrated edge.
  for (let tier = 0; tier < 9; tier++) {
    const y = .65 + tier * .34;
    const radius = 1.48 * (1 - tier / 10);
    const layer = new THREE.Group();
    layer.position.y = y;
    const core = new THREE.Mesh(new THREE.ConeGeometry(radius, .95, 12), foliage);
    core.position.y = .22;
    core.rotation.y = tier * .52;
    layer.add(core);
    for (let j = 0; j < 11; j++) {
      const angle = j / 11 * Math.PI * 2 + tier * .63;
      const branch = new THREE.Mesh(new THREE.ConeGeometry(radius * .29, .64, 5), foliage);
      branch.position.set(Math.cos(angle) * radius * .72, 0, Math.sin(angle) * radius * .72);
      branch.rotation.set(Math.sin(angle) * .48, angle, -Math.cos(angle) * .48);
      layer.add(branch);
    }
    root.add(layer);
    layers.push(layer);
  }
  const sphere = new THREE.SphereGeometry(.085, 12, 8);
  for (let i = 0; i < 48; i++) {
    const y = .65 + (i / 48) * 2.9;
    const radius = 1.54 * (1 - (y - .5) / 3.75);
    const angle = i * 2.39996;
    const ornament = new THREE.Mesh(sphere, gold);
    ornament.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    root.add(ornament);
    animated.push(ornament);
  }
  const bulbs = [];
  const bulbGeometry = new THREE.SphereGeometry(.035, 7, 5);
  const wirePoints = [];
  for (let i = 0; i < 100; i++) {
    const t = i / 99;
    const y = .7 + t * 3.05;
    const radius = 1.53 * (1 - t * .92);
    const angle = t * Math.PI * 2 * 5;
    const position = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    wirePoints.push(position);
    const material = new THREE.MeshBasicMaterial({ color: 0x6c6650 });
    const bulb = new THREE.Mesh(bulbGeometry, material);
    bulb.position.copy(position);
    root.add(bulb);
    bulbs.push(bulb);
  }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePoints), new THREE.LineBasicMaterial({ color: 0x72633d, transparent: true, opacity: .4 }));
  root.add(wire);
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? .29 : .125;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const starMaterial = new THREE.MeshStandardMaterial({ color: 0xe6bf65, metalness: .7, roughness: .28, emissive: 0xffbc48, emissiveIntensity: 0 });
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1 }), starMaterial);
  star.position.set(0, 4.02, 0);
  root.add(star);
  animated.push(star);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, .12, 64), new THREE.MeshStandardMaterial({ color: 0x1c3540, metalness: .6, roughness: .4 }));
  pedestal.position.y = .02;
  root.add(pedestal);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.73, .012, 6, 64), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .08;
  root.add(rim);
  root.add(createPedestalSignature());
  return { root, bulbs, starMaterial, layers, animated, trunk, wire };
}
