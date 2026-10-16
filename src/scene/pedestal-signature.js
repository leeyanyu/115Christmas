import * as THREE from 'three';

// Small, inset-looking maker's mark: vector strokes need no font or image assets.
export function createPedestalSignature() {
  const root = new THREE.Group();
  root.name = 'GJ-pedestal-signature';
  root.position.set(0, .14, 1.52);
  root.rotation.x = -Math.PI * .3;
  const outline = new THREE.Shape();
  outline.moveTo(-.38, -.19);
  outline.lineTo(.38, -.19); outline.quadraticCurveTo(.44, -.19, .44, -.13);
  outline.lineTo(.44, .13); outline.quadraticCurveTo(.44, .19, .38, .19);
  outline.lineTo(-.38, .19); outline.quadraticCurveTo(-.44, .19, -.44, .13);
  outline.lineTo(-.44, -.13); outline.quadraticCurveTo(-.44, -.19, -.38, -.19);
  const plate = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshStandardMaterial({ color: 0x1c3540, metalness: .5, roughness: .48, side: THREE.DoubleSide }));
  root.add(plate);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8ad55, metalness: .65, roughness: .35, emissive: 0xd8ad55, emissiveIntensity: .12 });
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline.getPoints(8).map(p => new THREE.Vector3(p.x, p.y, .004))), new THREE.LineBasicMaterial({ color: 0xd8ad55, transparent: true, opacity: .6 }));
  root.add(edge);
  function stroke(points, name) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, .012)), false, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .012, 6, false), gold);
    mesh.name = name; root.add(mesh);
  }
  const g = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (.24 + i / 24 * 1.55);
    g.push([-.16 + Math.cos(a) * .12, Math.sin(a) * .13]);
  }
  g.push([-.04, 0], [-.14, 0]);
  stroke(g, 'G-letter');
  stroke([[.06, .13], [.27, .13]], 'J-serif');
  stroke([[.20, .13], [.20, .02], [.20, -.06], [.17, -.12], [.10, -.13], [.05, -.08]], 'J-letter');
  return root;
}
