import * as THREE from 'three';

export function createOrnamentFactory() {
  const sphere = new THREE.SphereGeometry(.105, 16, 12);
  const box = new THREE.BoxGeometry(.18, .19, .16);
  const ribbon = new THREE.BoxGeometry(.025, .195, .165);
  const loop = new THREE.TorusGeometry(.065, .018, 6, 18);
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .05 : .115; if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(0, r); }
  shape.closePath();
  const star = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelSegments: 2, bevelSize: .008, bevelThickness: .008, steps: 1 });
  const geometries = [sphere, box, ribbon, loop, star];
  function create(type, color) {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color, metalness: type === 'ball' || type === 'star' ? .55 : .12, roughness: type === 'ball' ? .28 : .55 });
    const ivory = ['bow', 'gift'].includes(type) ? new THREE.MeshStandardMaterial({ color: 0xf4e9d9, roughness: .65, metalness: .05 }) : null;
    if (type === 'bow') {
      for (const side of [-1, 1]) { const mesh = new THREE.Mesh(loop, material); mesh.position.x = side * .055; mesh.scale.set(1, .75, 1); mesh.rotation.z = side * -.45; root.add(mesh); }
      const knot = new THREE.Mesh(sphere, ivory); knot.scale.setScalar(.25); root.add(knot);
    } else {
      root.add(new THREE.Mesh(type === 'gift' ? box : type === 'star' ? star : sphere, material));
      if (type === 'gift') {
        root.add(new THREE.Mesh(ribbon, ivory)); const cross = new THREE.Mesh(ribbon, ivory); cross.rotation.z = Math.PI / 2; root.add(cross);
      }
    }
    root.userData.colorMaterial = material;
    return root;
  }
  function disposeItem(root) { const materials = new Set(); root.traverse(o => { if (o.material) materials.add(o.material); }); materials.forEach(m => m.dispose()); }
  return { create, disposeItem, dispose() { geometries.forEach(g => g.dispose()); } };
}
