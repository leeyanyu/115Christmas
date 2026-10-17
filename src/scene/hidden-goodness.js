import * as THREE from 'three';
import { createLittleAngels } from './little-angels.js';

export const THREE_GOODS = [
  { id: 'good-child', label: '好兒女', color: 0x6f9fc7, angle: -.62, height: 1.79 },
  { id: 'good-student', label: '好學生', color: 0x7ca781, angle: 1.48, height: 2.13 },
  { id: 'good-citizen', label: '好國民', color: 0xc87976, angle: 3.55, height: 2.47 },
];
const SIZE = .06, DWELL = .85;

// Looking, rather than clicking, discovers these three secrets. Screen size,
// deliberate zoom, face direction, leaf occlusion and dwell all have to agree.
export function createHiddenGoodness({ tree, canvas, onFound = () => {}, additionalOccluders = () => [] }) {
  const root = new THREE.Group(); root.name = 'hidden-three-goods'; tree.root.add(root);
  const art = createLittleAngels(THREE_GOODS.map(good => good.color));
  const foliage = tree.layers;
  const occluders = [...foliage, ...tree.animated, tree.trunk, ...tree.bulbs];
  const ray = new THREE.Raycaster(), hits = [];
  const point = new THREE.Vector3(), view = new THREE.Vector3(), normal = new THREE.Vector3();
  const projected = new THREE.Vector3(), top = new THREE.Vector3(), bottom = new THREE.Vector3();
  const localCamera = new THREE.Vector3();
  tree.root.updateWorldMatrix(true, true);
  const actors = THREE_GOODS.map((good, index) => {
    const character = art.characters[index], outward = new THREE.Vector3(Math.sin(good.angle), 0, Math.cos(good.angle));
    // Find the actual bough surface at both torso and face height. The tiny
    // figure nestles against the leaves rather than floating on a guessed cone.
    let radius = 0;
    for (const height of [good.height + SIZE * .43, good.height + SIZE * .82]) {
      point.copy(outward).multiplyScalar(4); point.y = height;
      tree.root.localToWorld(point); normal.copy(outward).negate().transformDirection(tree.root.matrixWorld);
      ray.set(point, normal); hits.length = 0; ray.intersectObjects(foliage, true, hits);
      if (hits[0]) {
        point.copy(hits[0].point); tree.root.worldToLocal(point);
        radius = Math.max(radius, Math.hypot(point.x, point.z));
      }
    }
    const home = outward.clone().multiplyScalar(radius + .012); home.y = good.height;
    character.root.name = good.id; character.root.userData.threeGood = good.label;
    character.root.position.copy(home); character.root.rotation.y = good.angle;
    character.root.scale.setScalar(SIZE); root.add(character.root);
    return { ...character, good, outward, home, phase: 'hidden', dwell: 0, elapsed: 0,
      previous: new THREE.Vector2(), sampled: false, direction: new THREE.Vector3() };
  });
  let found = 0, disposed = false;
  function visible(actor, camera, rect, delta) {
    const figure = actor.root;
    point.set(0, .82, .17).applyMatrix4(figure.matrixWorld);
    projected.copy(point).project(camera);
    const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .92 && Math.abs(projected.y) < .86;
    const x = projected.x * rect.width / 2, y = projected.y * rect.height / 2;
    const still = actor.sampled && Math.hypot(x - actor.previous.x, y - actor.previous.y) / Math.max(.001, delta) < 35;
    actor.previous.set(x, y); actor.sampled = true;
    if (!onScreen || !still) return false;
    top.set(0, 1.02, 0).applyMatrix4(figure.matrixWorld).project(camera);
    bottom.set(0, 0, 0).applyMatrix4(figure.matrixWorld).project(camera);
    if (Math.hypot((top.x - bottom.x) * rect.width / 2, (top.y - bottom.y) * rect.height / 2) < 22) return false;
    normal.set(0, 0, 1).transformDirection(figure.matrixWorld);
    view.copy(camera.position).sub(point).normalize();
    if (normal.dot(view) < .5) return false;
    // Both face and clothing must be visible. Looking through foliage or at a
    // character's back cannot collect it; depth testing stays enabled in art.
    for (const height of [.82, .43]) {
      point.set(0, height, .17).applyMatrix4(figure.matrixWorld);
      const distance = point.distanceTo(camera.position);
      view.copy(point).sub(camera.position).normalize();
      ray.set(camera.position, view); ray.far = distance - .002;
      hits.length = 0; ray.intersectObjects(occluders, true, hits);
      ray.intersectObjects(additionalOccluders(), true, hits);
      if (hits.length) return false;
    }
    return true;
  }
  function reset() {
    found = 0; root.visible = false;
    actors.forEach(actor => {
      actor.phase = 'hidden'; actor.dwell = actor.elapsed = 0; actor.sampled = false;
      actor.root.visible = true; actor.root.position.copy(actor.home);
      actor.root.rotation.set(0, actor.good.angle, 0); actor.root.scale.setScalar(SIZE); actor.pose(0);
    });
  }
  reset();
  return {
    get foundCount() { return found; },
    update(delta, camera, ready, reducedMotion, zoomRatio) {
      if (disposed) return;
      root.visible = ready;
      if (!ready) { actors.forEach(actor => { actor.dwell = 0; actor.sampled = false; }); return; }
      camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true);
      const rect = canvas.getBoundingClientRect();
      for (const actor of actors) {
        if (actor.phase === 'gone') continue;
        if (actor.phase === 'hidden') {
          const readable = zoomRatio >= 2 && visible(actor, camera, rect, delta);
          if (zoomRatio < 2) actor.sampled = false;
          actor.dwell = readable ? actor.dwell + Math.min(delta, .1) : 0;
          if (actor.dwell < DWELL) continue;
          actor.phase = 'flying'; actor.elapsed = 0; found++;
          // Leave toward the viewer first, so the angel does not rise through
          // another layer of branches. All coordinates remain tree-local.
          localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
          actor.direction.copy(localCamera).sub(actor.home); actor.direction.y = 0; actor.direction.normalize();
          onFound({ label: actor.good.label, count: found, total: 3 });
        }
        actor.elapsed += delta;
        const progress = Math.min(1, actor.elapsed / (reducedMotion ? 1.4 : 4.2));
        const unfold = THREE.MathUtils.smoothstep(progress, 0, .22);
        if (!reducedMotion) {
          actor.root.position.copy(actor.home).addScaledVector(actor.direction, unfold * .25 + progress * .35);
          actor.root.position.y += progress * progress * 1.2;
          actor.root.rotation.z = Math.sin(progress * Math.PI * 2) * .08;
          actor.root.scale.setScalar(SIZE * (1 + unfold * .3));
        }
        actor.pose(progress, 1 - THREE.MathUtils.smoothstep(progress, .72, 1), reducedMotion);
        if (progress === 1) { actor.phase = 'gone'; actor.root.visible = false; }
      }
    },
    reset,
    dispose() { if (disposed) return; disposed = true; art.dispose(); root.removeFromParent(); },
  };
}
