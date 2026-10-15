import * as THREE from 'three';

// Local coordinates keep this content independent of the camera / future AR anchor.
export function createTree() {
  const root = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8ad55, metalness: .8, roughness: .24 });
  const layers = [];
  const animated = [];
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09, .16, 3.8, 16), new THREE.MeshStandardMaterial({ color: 0x493b2b }));
  trunk.position.y = 1.95;
  root.add(trunk);
  let seed = 1226;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const needleGeometry = new THREE.ConeGeometry(.012, .19, 4);
  const needleMaterial = new THREE.MeshStandardMaterial({ color: 0x397b5d, roughness: .85, metalness: .05 });
  const branchGeometry = new THREE.CylinderGeometry(.006, .018, 1, 5);
  const branchMaterial = new THREE.MeshStandardMaterial({ color: 0x554a32, roughness: 1 });
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  // Fine instanced needles replace the broad polygon cones: 12 draw calls.
  for (let tier = 0; tier < 12; tier++) {
    const layer = new THREE.Group();
    layer.position.y = .55 + tier * .285;
    const radius = 1.48 * Math.pow(1 - tier / 12.6, .85);
    const branchCount = 15;
    const perBranch = 42;
    const needles = new THREE.InstancedMesh(needleGeometry, needleMaterial, branchCount * perBranch);
    const branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, branchCount);
    for (let j = 0; j < branchCount; j++) {
      const angle = j / branchCount * Math.PI * 2 + tier * 1.71;
      const length = radius * (.85 + random() * .2);
      const branch = new THREE.Object3D();
      direction.set(Math.cos(angle), -.16, Math.sin(angle)).normalize();
      branch.quaternion.setFromUnitVectors(up, direction);
      branch.position.copy(direction).multiplyScalar(length / 2);
      branch.scale.y = length;
      branch.updateMatrix();
      branches.setMatrixAt(j, branch.matrix);
      for (let k = 0; k < perBranch; k++) {
        const t = random();
        const spread = (.07 + .17 * Math.sin(t * Math.PI)) * (random() - .5) * 2;
        dummy.position.set(Math.cos(angle) * length * t - Math.sin(angle) * spread,
          -.16 * length * t + (random() - .4) * .13,
          Math.sin(angle) * length * t + Math.cos(angle) * spread);
        direction.set(Math.cos(angle) * .5 - Math.sin(angle) * spread * 5, .3 + random() * .8, Math.sin(angle) * .5 + Math.cos(angle) * spread * 5).normalize();
        dummy.quaternion.setFromUnitVectors(up, direction);
        dummy.scale.setScalar(.65 + random() * .7);
        dummy.updateMatrix();
        needles.setMatrixAt(j * perBranch + k, dummy.matrix);
        needles.setColorAt(j * perBranch + k, new THREE.Color().setHSL(.39 + random() * .04, .28 + random() * .25, .14 + random() * .15));
      }
    }
    layer.add(needles, branches);
    root.add(layer);
    layers.push(layer);
  }
  const sphere = new THREE.SphereGeometry(.085, 24, 16);
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
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePoints), new THREE.LineBasicMaterial({ color: 0x72633d, transparent: true, opacity: .25 }));
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
  return { root, bulbs, starMaterial, layers, animated, trunk, wire };
}
