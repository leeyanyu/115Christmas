import * as THREE from 'three';

export function createGingerbread(tree) {
  const cookie = new THREE.MeshStandardMaterial({ color: 0xbe8653, roughness: .8 });
  const icing = new THREE.MeshStandardMaterial({ color: 0xffedd0, roughness: .65 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xcc8990, roughness: .7 });
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const root = new THREE.Group(); root.name = 'hidden-gingerbread';
  function ball(material, x, y, z, sx, sy = sx, sz = sx) {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); root.add(mesh); return mesh;
  }
  // One continuous cookie outline replaces the separate capsule joints.
  const outline = new THREE.Shape();
  outline.moveTo(0, .47);
  outline.bezierCurveTo(.17, .47, .23, .29, .10, .19);
  outline.bezierCurveTo(.13, .16, .16, .16, .19, .20);
  outline.bezierCurveTo(.26, .29, .32, .31, .36, .25);
  outline.bezierCurveTo(.42, .17, .31, .12, .22, .06);
  outline.bezierCurveTo(.16, .02, .15, -.02, .16, -.10);
  outline.bezierCurveTo(.17, -.17, .23, -.28, .19, -.35);
  outline.bezierCurveTo(.16, -.42, .07, -.43, .035, -.35);
  outline.bezierCurveTo(.01, -.29, .02, -.23, 0, -.22);
  outline.bezierCurveTo(-.02, -.23, -.01, -.29, -.035, -.35);
  outline.bezierCurveTo(-.07, -.43, -.16, -.42, -.19, -.35);
  outline.bezierCurveTo(-.23, -.28, -.17, -.17, -.16, -.10);
  outline.bezierCurveTo(-.15, -.02, -.16, .02, -.22, .06);
  outline.bezierCurveTo(-.31, .12, -.42, .17, -.36, .25);
  outline.bezierCurveTo(-.32, .31, -.26, .29, -.19, .20);
  outline.bezierCurveTo(-.16, .16, -.13, .16, -.10, .19);
  outline.bezierCurveTo(-.23, .29, -.17, .47, 0, .47);
  outline.closePath();
  const body = new THREE.ExtrudeGeometry(outline, { depth: .07, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 5, curveSegments: 20, steps: 1 });
  body.translate(0, 0, -.035);
  root.add(new THREE.Mesh(body, cookie));
  for (const side of [-1, 1]) {
    ball(icing, side * .055, .33, .065, .017, .021, .012);
    ball(pink, side * .085, .275, .064, .022, .013, .009);
  }
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.055, .275, .066), new THREE.Vector3(0, .22, .073), new THREE.Vector3(.055, .275, .066));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 20, .009, 8, false), icing));
  ball(icing, 0, .04, .065, .019); ball(icing, 0, -.04, .065, .019);
  tree.root.add(root);
  const home = new THREE.Vector3(.42, 1.95, -1.08), localCamera = new THREE.Vector3();
  const landing = new THREE.Vector3(.85, .51, -1.3), exit = new THREE.Vector3();
  const ease = t => t * t * (3 - 2 * t);
  let phase = 'hidden', seen = 0, elapsed = 0, cooldown = 0;
  function reset() { phase = 'hidden'; seen = elapsed = cooldown = 0; root.position.copy(home); root.rotation.set(0, Math.PI, -.15); root.scale.setScalar(1); root.visible = false; }
  reset();
  return {
    update(delta, camera, ready, reducedMotion) {
      root.visible = ready && phase !== 'away';
      if (!ready) return;
      if (reducedMotion && phase !== 'hidden' && phase !== 'away') { phase = 'away'; cooldown = 24; root.visible = false; }
      elapsed += delta; cooldown = Math.max(0, cooldown - delta);
      tree.root.updateWorldMatrix(true, false); localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
      const behind = -localCamera.z / Math.max(.01, Math.hypot(localCamera.x, localCamera.z)) > .8;
      if (phase === 'hidden') {
        seen = behind && !cooldown ? seen + delta : 0;
        if (seen >= 1.1 && !reducedMotion) { phase = 'falling'; elapsed = 0; }
      } else if (phase === 'falling') {
        const t = Math.min(1, elapsed / 1.1);
        root.position.set(home.x + .43 * t, home.y + (landing.y - home.y) * t * t, home.z - .22 * t);
        root.rotation.z = -.15 + Math.sin(t * Math.PI) * .65;
        if (t === 1) { phase = 'bouncing'; elapsed = 0; }
      } else if (phase === 'bouncing') {
        const t = Math.min(1, elapsed / .8);
        root.position.copy(landing); root.position.y += Math.abs(Math.sin(t * Math.PI * 2)) * .18 * (1 - t);
        const squash = Math.exp(-t * 7) * .1;
        root.scale.set(1 + squash, 1 - squash, 1);
        root.rotation.z = -.15 * (1 - t);
        if (t === 1) { phase = 'hopping'; elapsed = 0; root.scale.setScalar(1); }
      } else if (phase === 'hopping') {
        // Resolve the offscreen destination in the current view, so it works
        // after orbiting, zooming or resizing, instead of vanishing on the base.
        camera.updateMatrixWorld();
        exit.copy(landing); tree.root.localToWorld(exit); exit.project(camera);
        exit.x = 1.55; exit.unproject(camera); tree.root.worldToLocal(exit); exit.y = landing.y;
        const progress = Math.min(1, elapsed / 2.7), hop = progress * 3;
        const part = progress === 1 ? 1 : hop % 1;
        const advance = progress === 1 ? 1 : (Math.floor(hop) + ease(part)) / 3;
        root.position.lerpVectors(landing, exit, advance);
        root.position.y += Math.sin(part * Math.PI) * (.32 + Math.floor(Math.min(hop, 2)) * .06);
        root.rotation.y = Math.atan2(localCamera.x - root.position.x, localCamera.z - root.position.z);
        root.rotation.z = Math.sin(part * Math.PI) * -.15;
        root.scale.set(1 - Math.sin(part * Math.PI) * .035, 1 + Math.sin(part * Math.PI) * .06, 1);
        if (progress === 1) { phase = 'away'; cooldown = 24; root.visible = false; }
      } else if (phase === 'away' && !cooldown && localCamera.z / Math.max(.01, Math.hypot(localCamera.x, localCamera.z)) > .35) {
        reset(); root.visible = true;
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
