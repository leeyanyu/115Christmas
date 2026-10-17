import * as THREE from 'three';

export function createGingerbread(tree) {
  const cookie = new THREE.MeshStandardMaterial({ color: 0xbe8653, roughness: .8 });
  const icing = new THREE.MeshStandardMaterial({ color: 0xffedd0, roughness: .65 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xcc8990, roughness: .7 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0xcc8990, roughness: .7 });
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
  ball(ribbon, -.035, .14, .07, .044, .026, .012);
  ball(ribbon, .035, .14, .07, .044, .026, .012);
  ball(ribbon, 0, .14, .08, .018);
  ball(icing, 0, .04, .065, .019); ball(icing, 0, -.04, .065, .019);
  tree.root.add(root);
  const home = new THREE.Vector3(.42, 1.95, -1.08), localCamera = new THREE.Vector3();
  const landing = new THREE.Vector3(.85, .51, -1.3), exit = new THREE.Vector3(), entry = new THREE.Vector3();
  const ease = t => t * t * (3 - 2 * t);
  const characters = [[0xbe8653, 0xcc8990], [0xa5714d, 0x8bb8a3], [0xc69761, 0xd8ba76]];
  let phase = 'hidden', seen = 0, elapsed = 0, cooldown = 0, character = 0, hops = 3, travelDuration = 2.7;
  function dress() { cookie.color.setHex(characters[character][0]); ribbon.color.setHex(characters[character][1]); }
  function screenPoint(camera, target, x) {
    camera.updateMatrixWorld();
    target.copy(landing); tree.root.localToWorld(target); target.project(camera);
    target.x = x; target.unproject(camera); tree.root.worldToLocal(target); target.y = landing.y;
  }
  function plan(camera, point) {
    // Wide desktop routes need smaller, quicker steps rather than long leaps.
    hops = camera.aspect > 1.1 ? Math.min(10, Math.max(5, Math.ceil(landing.distanceTo(point) / 1.05))) : 3;
    travelDuration = camera.aspect > 1.1 ? hops * .48 : 2.7;
  }
  function travel(camera, arriving) {
    const point = arriving ? entry : exit;
    screenPoint(camera, point, arriving ? -1.55 : 1.55);
    const progress = Math.min(1, elapsed / travelDuration), hop = progress * hops;
    const part = progress === 1 ? 1 : hop % 1;
    const advance = progress === 1 ? 1 : (Math.floor(hop) + ease(part)) / hops;
    root.position.lerpVectors(arriving ? point : landing, arriving ? landing : point, advance);
    const height = camera.aspect > 1.1 ? .19 : .32 + Math.floor(Math.min(hop, 2)) * .06;
    root.position.y += Math.sin(part * Math.PI) * height;
    root.rotation.y = Math.atan2(localCamera.x - root.position.x, localCamera.z - root.position.z);
    root.rotation.z = Math.sin(part * Math.PI) * (arriving ? .12 : -.15);
    root.scale.set(1 - Math.sin(part * Math.PI) * .035, 1 + Math.sin(part * Math.PI) * .06, 1);
    return progress === 1;
  }
  function reset() { phase = 'hidden'; seen = elapsed = cooldown = character = 0; dress(); root.position.copy(home); root.rotation.set(0, Math.PI, -.15); root.scale.setScalar(1); root.visible = false; }
  reset();
  return {
    get isPerforming() { return phase !== 'hidden'; },
    update(delta, camera, ready, reducedMotion) {
      root.visible = ready && phase !== 'away';
      if (!ready) return;
      if (reducedMotion && phase !== 'hidden') { reset(); root.visible = true; }
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
        if (t === 1) { phase = 'hopping'; elapsed = 0; root.scale.setScalar(1); screenPoint(camera, exit, 1.55); plan(camera, exit); }
      } else if (phase === 'hopping') {
        if (travel(camera, false)) { phase = 'away'; cooldown = 5; root.visible = false; }
      } else if (phase === 'away' && !cooldown) {
        character = (character + 1) % characters.length; dress();
        screenPoint(camera, entry, -1.55); plan(camera, entry);
        root.position.copy(entry); root.scale.setScalar(1); phase = 'arriving'; elapsed = 0; root.visible = true;
      } else if (phase === 'arriving') {
        if (travel(camera, true)) { phase = 'climbing'; elapsed = 0; root.scale.setScalar(1); }
      } else if (phase === 'climbing') {
        const progress = Math.min(1, elapsed / 2.6), step = progress * 5;
        const part = progress === 1 ? 1 : step % 1;
        const advance = progress === 1 ? 1 : (Math.floor(step) + ease(part)) / 5;
        root.position.lerpVectors(landing, home, advance);
        root.rotation.set(0, Math.PI, Math.sin(part * Math.PI) * (Math.floor(step) % 2 ? -.12 : .12));
        if (progress === 1) { phase = 'hidden'; seen = elapsed = 0; cooldown = 6; root.rotation.z = -.15; }
      }
    },
    reset,
    dispose() {
      tree.root.remove(root);
      const geometries = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
      geometries.forEach(g => g.dispose()); cookie.dispose(); icing.dispose(); pink.dispose(); ribbon.dispose();
    },
  };
}
