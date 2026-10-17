import * as THREE from 'three';
import { createHolidayCharacter, characterScale } from './holiday-character.js';

export function createGingerbread(tree, { kind = 'gingerbread', autoCycle = true, homeAngle, homeHeight = 1.95, linger = 1.1, entrySide = -1 } = {}) {
  const initialEntrySide = entrySide;
  const model = createHolidayCharacter(kind), { root, body } = model;
  tree.root.add(root);
  const home = new THREE.Vector3(.42, 1.95, -1.08), localCamera = new THREE.Vector3();
  const landing = new THREE.Vector3(.85, .51, -1.3), exit = new THREE.Vector3(), entry = new THREE.Vector3(), tangentPoint = new THREE.Vector3();
  const back = new THREE.Vector2(home.x, home.z).normalize(), routeRadius = 2.35;
  if (homeAngle !== undefined) back.set(Math.sin(homeAngle), Math.cos(homeAngle));
  const bandHeight = .04, bandOffset = .4, foliage = new Float32Array(128);
  const vertex = new THREE.Vector3(), edge = new THREE.Vector3(), inverse = new THREE.Matrix4();
  const triangle = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const bandAt = y => Math.floor((y + bandOffset) / bandHeight);
  function include(point) {
    const band = bandAt(point.y), radius = Math.hypot(point.x, point.z);
    for (const i of [band - 1, band]) if (i >= 0 && i < foliage.length) foliage[i] = Math.max(foliage[i], radius);
  }
  tree.root.updateWorldMatrix(true, true); inverse.copy(tree.root.matrixWorld).invert();
  // Clip triangle edges into height bands once. Using an entire branch's
  // radius at every height left the climber visibly floating beside the tree.
  tree.layers.forEach(layer => layer.traverse(mesh => {
    if (!mesh.geometry) return;
    const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      for (let j = 0; j < 3; j++) triangle[j].fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3]; include(a);
        if (Math.abs(a.y - b.y) < .000001) continue;
        for (let band = bandAt(Math.min(a.y, b.y)) + 1; band <= bandAt(Math.max(a.y, b.y)); band++) {
          const t = (band * bandHeight - bandOffset - a.y) / (b.y - a.y);
          include(edge.lerpVectors(a, b, t));
        }
      }
    }
  }));
  const bodyPoints = [], unique = new Set(), rotation = new THREE.Matrix4();
  for (let i = 0; i < body.attributes.position.count; i++) {
    vertex.fromBufferAttribute(body.attributes.position, i);
    const key = `${vertex.x.toFixed(5)},${vertex.y.toFixed(5)},${vertex.z.toFixed(5)}`;
    if (!unique.has(key)) { unique.add(key); bodyPoints.push(vertex.clone()); }
  }
  let size = 1;
  function branchRadius(y) {
    let radius = .2;
    rotation.makeRotationFromEuler(root.rotation);
    for (const point of bodyPoints) {
      vertex.copy(point).applyMatrix4(rotation).multiplyScalar(size);
      const band = bandAt(y + vertex.y);
      const surface = Math.max(foliage[band] ?? 0, foliage[band - 1] ?? 0, foliage[band + 1] ?? 0) + .045;
      const along = back.x * vertex.x + back.y * vertex.z;
      const across = back.y * vertex.x - back.x * vertex.z;
      radius = Math.max(radius, Math.sqrt(Math.max(0, surface * surface - across * across)) - along);
    }
    return radius;
  }
  function anchors(camera) {
    size = characterScale(camera.aspect);
    const radius = branchRadius(homeHeight);
    home.set(back.x * radius, homeHeight, back.y * radius);
    landing.set(back.x * routeRadius, .43 * size, back.y * routeRadius);
  }
  function cling(y, progress) {
    const radius = Math.max(branchRadius(y), THREE.MathUtils.lerp(Math.hypot(home.x, home.z), routeRadius, progress));
    root.position.set(back.x * radius, y, back.y * radius);
  }
  const ease = t => t * t * (3 - 2 * t);
  let phase = 'hidden', seen = 0, elapsed = 0, cooldown = 0, character = 0, hops = 3, travelDuration = 2.7;
  let departureSide = -entrySide;
  let readyToPlay = false, reduced = false;
  const fallStart = new THREE.Vector3();
  function dress() { model.dress(character); }
  function screenPoint(camera, target, x) {
    camera.updateMatrixWorld();
    target.copy(landing); tree.root.localToWorld(target); target.project(camera);
    const depth = target.z, screenY = target.y;
    for (let attempt = 0; attempt < 8; attempt++) {
      target.set(x, screenY, depth).unproject(camera); tree.root.worldToLocal(target); target.y = landing.y;
      if (Math.hypot(target.x, target.z) >= routeRadius) break;
      x *= 1.4;
    }
  }
  function plan(camera, point) {
    // Wide desktop routes need smaller, quicker steps rather than long leaps.
    hops = camera.aspect > 1.1 ? Math.min(10, Math.max(5, Math.ceil(landing.distanceTo(point) / 1.05))) : 3;
    travelDuration = camera.aspect > 1.1 ? hops * .48 : 2.7;
  }
  function travel(camera, arriving) {
    const point = arriving ? entry : exit;
    screenPoint(camera, point, (arriving ? entrySide : departureSide) * 1.55);
    const progress = Math.min(1, elapsed / travelDuration), hop = progress * hops;
    const part = progress === 1 ? 1 : hop % 1;
    const advance = progress === 1 ? 1 : (Math.floor(hop) + ease(part)) / hops;
    const angle = Math.atan2(landing.x, landing.z), endAngle = Math.atan2(point.x, point.z);
    const turn = Math.atan2(Math.sin(endAngle - angle), Math.cos(endAngle - angle));
    const radius = Math.max(routeRadius, Math.hypot(point.x, point.z));
    const arc = Math.sign(turn) * Math.max(0, Math.abs(turn) - Math.acos(Math.min(1, routeRadius / radius)));
    const fraction = arriving ? 1 - advance : advance;
    if (Math.abs(arc) < .00001) root.position.lerpVectors(landing, point, fraction);
    else {
      // Follow only the short safety arc, then its tangent. A large polar arc
      // would bring the actor toward the lens and exaggerate its screen size.
      const arcLength = Math.abs(arc) * routeRadius, lineLength = Math.sqrt(Math.max(0, radius * radius - routeRadius * routeRadius));
      const distance = fraction * (arcLength + lineLength);
      if (distance < arcLength) {
        const currentAngle = angle + arc * distance / arcLength;
        root.position.set(Math.sin(currentAngle) * routeRadius, landing.y, Math.cos(currentAngle) * routeRadius);
      } else {
        tangentPoint.set(Math.sin(angle + arc) * routeRadius, landing.y, Math.cos(angle + arc) * routeRadius);
        root.position.lerpVectors(tangentPoint, point, lineLength > .00001 ? (distance - arcLength) / lineLength : 1);
      }
    }
    const height = (camera.aspect > 1.1 ? .19 : .32 + Math.floor(Math.min(hop, 2)) * .06) * size;
    root.position.y += Math.sin(part * Math.PI) * height;
    root.rotation.z = Math.sin(part * Math.PI) * (arriving ? .12 : -.15);
    root.scale.set((1 - Math.sin(part * Math.PI) * .035) * size, (1 + Math.sin(part * Math.PI) * .06) * size, size);
    return progress === 1;
  }
  function drop() {
    if (!readyToPlay || !root.visible || (phase !== 'hidden' && phase !== 'climbing')) return false;
    if (reduced) return true;
    fallStart.copy(root.position); phase = 'falling'; elapsed = seen = 0; return true;
  }
  function reset() { phase = 'hidden'; seen = elapsed = cooldown = character = 0; entrySide = initialEntrySide; departureSide = -entrySide; readyToPlay = false; dress(); home.y = homeHeight; root.position.copy(home); root.rotation.set(0, Math.atan2(back.x, back.y), -.15); root.scale.setScalar(size); root.visible = false; }
  reset();
  return {
    get isPerforming() { return phase !== 'hidden'; },
    get isAway() { return phase === 'away'; },
    root,
    drop,
    landingScreenX(camera) {
      vertex.set(back.x * routeRadius, .43 * characterScale(camera.aspect), back.y * routeRadius);
      tree.root.localToWorld(vertex); return vertex.project(camera).x;
    },
    arrive({ sameSide = false, side = entrySide } = {}) {
      entrySide = side; departureSide = sameSide ? side : -side;
      character++; dress(); phase = 'entering'; elapsed = seen = cooldown = 0; root.visible = false;
    },
    hide() { phase = 'away'; root.visible = false; readyToPlay = false; },
    update(delta, camera, ready, reducedMotion) {
      readyToPlay = ready; reduced = reducedMotion;
      root.visible = ready && phase !== 'away' && phase !== 'entering';
      if (!ready) return;
      if (phase === 'away' && !autoCycle) return;
      if (reducedMotion && phase !== 'hidden' && phase !== 'away') { reset(); readyToPlay = true; root.visible = true; }
      elapsed += delta; cooldown = Math.max(0, cooldown - delta);
      tree.root.updateWorldMatrix(true, false); localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
      // A restrained turn toward the viewer keeps the smile visible from the
      // side, while retaining a genuine volume and its attachment to the tree.
      const outward = Math.atan2(back.x, back.y);
      const walking = ['bouncing', 'hopping', 'away', 'arriving'].includes(phase);
      const toward = Math.atan2(localCamera.x - (walking ? root.position.x : back.x), localCamera.z - (walking ? root.position.z : back.y));
      const offset = Math.atan2(Math.sin(toward - outward), Math.cos(toward - outward));
      const target = outward + (walking ? offset : THREE.MathUtils.clamp(offset, -Math.PI / 3, Math.PI / 3));
      const turn = Math.atan2(Math.sin(target - root.rotation.y), Math.cos(target - root.rotation.y));
      root.rotation.y += turn * (reducedMotion ? 1 : 1 - Math.exp(-delta * 12));
      anchors(camera);
      const behind = (localCamera.x * back.x + localCamera.z * back.y) / Math.max(.01, Math.hypot(localCamera.x, localCamera.z)) > .65;
      if (phase === 'hidden') {
        root.position.copy(home); root.scale.setScalar(size);
        seen = behind && !cooldown ? seen + delta : 0;
        if (seen >= linger && !reducedMotion) drop();
      } else if (phase === 'falling') {
        root.scale.setScalar(size);
        const t = Math.min(1, elapsed / 1.1);
        root.rotation.z = -.15 + Math.sin(t * Math.PI) * .65;
        const y = THREE.MathUtils.lerp(fallStart.y, landing.y, t * t);
        const radius = Math.max(branchRadius(y), THREE.MathUtils.lerp(Math.hypot(fallStart.x, fallStart.z), routeRadius, t));
        root.position.set(back.x * radius, y, back.y * radius);
        if (t === 1) { phase = 'bouncing'; elapsed = 0; }
      } else if (phase === 'bouncing') {
        const t = Math.min(1, elapsed / .8);
        root.position.copy(landing); root.position.y += Math.abs(Math.sin(t * Math.PI * 2)) * .18 * size * (1 - t);
        const squash = Math.exp(-t * 7) * .1;
        root.scale.set((1 + squash) * size, (1 - squash) * size, size);
        root.rotation.z = -.15 * (1 - t);
        if (t === 1) { phase = 'hopping'; elapsed = 0; root.scale.setScalar(size); screenPoint(camera, exit, departureSide * 1.55); plan(camera, exit); }
      } else if (phase === 'hopping') {
        if (travel(camera, false)) { phase = 'away'; cooldown = 5; root.visible = false; }
      } else if (phase === 'entering' || (phase === 'away' && !cooldown && autoCycle)) {
        if (phase === 'away') { character++; dress(); }
        screenPoint(camera, entry, entrySide * 1.55); plan(camera, entry);
        root.position.copy(entry); root.scale.setScalar(size); phase = 'arriving'; elapsed = 0; root.visible = true;
      } else if (phase === 'arriving') {
        if (travel(camera, true)) { phase = 'climbing'; elapsed = 0; root.scale.setScalar(size); }
      } else if (phase === 'climbing') {
        root.scale.setScalar(size);
        const progress = Math.min(1, elapsed / 2.6), step = progress * 5;
        const part = progress === 1 ? 1 : step % 1;
        const advance = progress === 1 ? 1 : (Math.floor(step) + ease(part)) / 5;
        root.rotation.z = Math.sin(part * Math.PI) * (Math.floor(step) % 2 ? -.12 : .12);
        cling(THREE.MathUtils.lerp(landing.y, home.y, advance), 1 - advance);
        if (progress === 1) { root.rotation.z = -.15; anchors(camera); root.position.copy(home); phase = 'hidden'; seen = elapsed = 0; cooldown = 6; }
      }
    },
    reset,
    dispose() {
      tree.root.remove(root);
      model.dispose();
    },
  };
}
