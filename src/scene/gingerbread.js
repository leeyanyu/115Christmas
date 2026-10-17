import * as THREE from 'three';

export function createGingerbread(tree) {
  const cookie = new THREE.MeshStandardMaterial({ color: 0xb97b48, roughness: .85 });
  const icing = new THREE.MeshStandardMaterial({ color: 0xffedd0, roughness: .65 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xcc8990, roughness: .7 });
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const limb = new THREE.CapsuleGeometry(.067, .22, 4, 8);
  const root = new THREE.Group(); root.name = 'hidden-gingerbread';
  function ball(material, x, y, z, sx, sy = sx, sz = sx) {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); root.add(mesh); return mesh;
  }
  ball(cookie, 0, .3, 0, .17, .16, .085);
  ball(cookie, 0, 0, 0, .145, .2, .075);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(limb, cookie); arm.position.set(side * .18, .13, 0); arm.rotation.z = side * -.85; root.add(arm);
    const leg = new THREE.Mesh(limb, cookie); leg.position.set(side * .09, -.23, 0); leg.rotation.z = side * .3; root.add(leg);
    ball(icing, side * .055, .33, .082, .017, .021, .012);
    ball(pink, side * .085, .275, .08, .022, .013, .009);
  }
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.055, .275, .084), new THREE.Vector3(0, .22, .1), new THREE.Vector3(.055, .275, .084));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 12, .009, 5, false), icing));
  ball(icing, 0, .04, .077, .019); ball(icing, 0, -.04, .077, .019);
  tree.root.add(root);
  const home = new THREE.Vector3(.42, 1.95, -1.08), localCamera = new THREE.Vector3();
  let phase = 'hidden', seen = 0, elapsed = 0, cooldown = 0;
  function reset() { phase = 'hidden'; seen = elapsed = cooldown = 0; root.position.copy(home); root.rotation.set(0, Math.PI, -.15); root.scale.setScalar(1); root.visible = false; }
  reset();
  return {
    update(delta, camera, ready, reducedMotion) {
      root.visible = ready;
      if (!ready) return;
      if (reducedMotion && phase === 'falling') { phase = 'resting'; elapsed = 0; root.position.set(.85, .46, -1.3); }
      elapsed += delta; cooldown = Math.max(0, cooldown - delta);
      if (phase === 'hidden') {
        tree.root.updateWorldMatrix(true, false); localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
        const behind = -localCamera.z / Math.max(.01, Math.hypot(localCamera.x, localCamera.z)) > .8;
        seen = behind && !cooldown ? seen + delta : 0;
        if (seen >= 1.1) { phase = reducedMotion ? 'resting' : 'falling'; elapsed = 0; if (reducedMotion) root.position.set(.85, .46, -1.3); }
      } else if (phase === 'falling') {
        const t = Math.min(1, elapsed / 1.1);
        root.position.set(home.x + .43 * t, home.y + (.46 - home.y) * t * t, home.z - .22 * t);
        root.rotation.z = -.15 + Math.sin(t * Math.PI) * .65;
        if (t === 1) { phase = 'resting'; elapsed = 0; }
      } else if (phase === 'resting' && elapsed >= 3) { phase = 'returning'; elapsed = 0; }
      else if (phase === 'returning') {
        if (!reducedMotion) root.scale.setScalar(Math.max(.001, 1 - elapsed / .6));
        if (elapsed >= .6) { reset(); cooldown = 24; root.visible = true; }
      }
    },
    reset,
    dispose() {
      tree.root.remove(root);
      const geometries = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
      geometries.forEach(g => g.dispose()); cookie.dispose(); icing.dispose(); pink.dispose();
    },
  };
}
