import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createHiddenGoodness, THREE_GOODS } from '../src/scene/hidden-goodness.js';

function setup(width = 390, height = 760, options = {}) {
  const tree = createTree(), events = [];
  const camera = new THREE.PerspectiveCamera(37, width / height, .1, 60);
  const effect = createHiddenGoodness({ tree, canvas: { getBoundingClientRect: () => ({ width, height }) }, onFound: event => events.push(event), ...options });
  const root = tree.root.getObjectByName('hidden-three-goods');
  function face(index, distance = 2.6) {
    const angle = THREE_GOODS[index].angle + tree.root.rotation.y;
    camera.position.set(Math.sin(angle) * distance, 2.05 + distance * .1, Math.cos(angle) * distance);
    camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  }
  function tick(seconds, ready = true, reduced = false, zoom = 4) {
    for (let elapsed = 0; elapsed < seconds; elapsed += .025) effect.update(.025, camera, ready, reduced, zoom);
  }
  return { tree, camera, effect, root, events, face, tick };
}

test('exactly three tiny colored figures hide on separate boughs; ordinary views do not collect them', () => {
  const s = setup();
  assert.equal(s.root.children.length, 3);
  assert.deepEqual(s.root.children.map(figure => figure.userData.threeGood), ['好兒女', '好學生', '好國民']);
  const colors = new Set();
  for (let i = 0; i < 3; i++) {
    const figure = s.root.children[i];
    const bounds = new THREE.Box3().setFromObject(figure, true);
    assert.ok(bounds.max.y - bounds.min.y < .09, 'secret is too large for the tree');
    assert.ok(Math.hypot(figure.position.x, figure.position.z) > .5, 'figure was placed inside the trunk');
    colors.add(figure.children[0].material.color.getHex());
    assert.equal(figure.getObjectByName('angel-wings').visible, false);
    s.face(i); s.tick(2, true, false, 1);
    assert.equal(s.effect.foundCount, 0, 'a large viewport alone cannot replace deliberate zoom');
    s.face(i, 12); s.tick(2, true, false, 4);
    assert.equal(s.effect.foundCount, 0, 'a tiny on-screen figure cannot be discovered prematurely');
  }
  assert.equal(colors.size, 3); s.effect.dispose();
});

test('phone and desktop can discover all three by zooming and looking without a click', () => {
  for (const [width, height] of [[390, 760], [1200, 800]]) {
    const s = setup(width, height);
    for (let i = 0; i < 3; i++) {
      s.face(i); s.tick(.4);
      assert.equal(s.effect.foundCount, i, 'a quick glimpse must not trigger the transformation');
      s.tick(.65);
      assert.equal(s.effect.foundCount, i + 1);
      const figure = s.root.children[i], home = figure.position.clone();
      assert.ok(figure.getObjectByName('angel-wings').visible);
      assert.ok(figure.getObjectByName('angel-halo').visible);
      s.tick(1);
      assert.ok(figure.position.y > home.y, 'angel should fly upward');
      assert.ok(Math.hypot(figure.position.x, figure.position.z) > Math.hypot(home.x, home.z), 'angel must leave the leaves before rising');
      s.tick(2.5);
      const material = figure.children[0].material;
      assert.ok(material.opacity > 0 && material.opacity < 1, 'departure needs a fading tail');
      s.tick(1); assert.equal(figure.visible, false);
      s.tick(2); assert.equal(s.effect.foundCount, i + 1, 'one figure cannot be collected twice');
    }
    assert.deepEqual(s.events.map(event => event.label), ['好兒女', '好學生', '好國民']);
    assert.deepEqual(s.events.map(event => event.count), [1, 2, 3]);
    s.effect.dispose();
  }
});

test('offscreen, hidden, back-facing and briefly occluded figures do not trigger', () => {
  const s = setup(); s.face(0);
  s.tick(1, false); assert.equal(s.effect.foundCount, 0);
  s.camera.lookAt(0, 10, 0); s.tick(2); assert.equal(s.effect.foundCount, 0);
  s.face(0); s.camera.position.negate(); s.camera.lookAt(0, 2.05, 0);
  s.tick(2); assert.equal(s.effect.foundCount, 0);
  s.face(0);
  const figure = s.root.children[0], blocker = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshBasicMaterial());
  blocker.position.copy(figure.position).lerp(s.camera.position, .15);
  s.tree.layers[0].add(blocker);
  blocker.position.y -= s.tree.layers[0].position.y;
  s.tick(2); assert.equal(s.effect.foundCount, 0, 'raycasting must reject covered faces and clothing');
  blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose();
  s.tick(.4); assert.equal(s.effect.foundCount, 0, 'occlusion must reset the dwell time');
  s.tick(.7); assert.equal(s.effect.foundCount, 1);
  s.effect.dispose();
});

test('motion preference, replay and disposal reuse a bounded set of actors and GPU resources', () => {
  const s = setup(); s.face(0);
  const figure = s.root.children[0], home = figure.position.clone();
  const geometry = figure.children[0].geometry, material = figure.children[0].material;
  const geometries = new Set(), materials = new Set();
  s.root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  for (let i = 0; i < 12; i++) {
    s.effect.reset(); assert.equal(s.effect.foundCount, 0); assert.equal(s.root.visible, false);
    s.tick(1.1, true, true);
    assert.equal(s.effect.foundCount, 1); assert.ok(figure.position.equals(home), 'reduced motion must keep the angel stationary');
    s.tick(2, true, true); assert.equal(figure.visible, false);
    assert.equal(figure.children[0].geometry, geometry); assert.equal(figure.children[0].material, material);
    assert.equal(s.root.children.length, 3);
  }
  s.effect.reset(); s.tree.root.rotation.y = 1.1; s.face(2); s.tick(1.1);
  assert.equal(s.effect.foundCount, 1, 'finding works after the entire tree rotates');
  let disposed = 0;
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposed++);
  s.effect.dispose(); s.effect.dispose();
  assert.equal(disposed, geometries.size + materials.size);
  assert.equal(s.tree.root.getObjectByName('hidden-three-goods'), undefined);
});

test('a passing holiday visitor can temporarily cover a secret without collecting it', () => {
  let visitors = [];
  const s = setup(390, 760, { additionalOccluders: () => visitors }); s.face(2);
  const figure = s.root.children[2];
  const visitor = new THREE.Mesh(new THREE.BoxGeometry(.25, .3, .25), new THREE.MeshBasicMaterial());
  visitor.position.copy(figure.position).lerp(s.camera.position, .15);
  s.tree.root.add(visitor); visitors = [visitor];
  s.tick(2); assert.equal(s.effect.foundCount, 0, 'a foreground character must block automatic discovery');
  visitor.removeFromParent(); visitors = [];
  s.tick(1.1); assert.equal(s.effect.foundCount, 1);
  visitor.geometry.dispose(); visitor.material.dispose(); s.effect.dispose();
});
