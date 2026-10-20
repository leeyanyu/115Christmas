import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createGingerbread } from '../src/scene/gingerbread.js';
import { createHolidayVisitors } from '../src/scene/holiday-visitors.js';

function fixture(aspect = 1.5, angle = 0, rotation = 0) {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, aspect, .1, 60);
  tree.root.rotation.y = rotation;
  const distance = aspect < 1 ? 15 : 10.1;
  camera.position.set(Math.sin(angle) * distance, 2.05 + distance * .1, Math.cos(angle) * distance);
  camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  return { tree, camera };
}

function height(root, camera, low = -.43, high = .49) {
  root.updateWorldMatrix(true, false);
  const a = new THREE.Vector3(0, low, 0).applyMatrix4(root.matrixWorld).project(camera);
  const b = new THREE.Vector3(0, high, 0).applyMatrix4(root.matrixWorld).project(camera);
  return Math.abs(b.y - a.y);
}

test('a close greeting hops around the foliage toward the lens and waves at about half the tree height', () => {
  for (const [aspect, angle, side, rotation] of [[1.5, 0, -1, 0], [.5, 0, 1, 0], [2.4, 1.8, 1, .7], [.4, -2, -1, 1.1]]) {
    const { tree, camera } = fixture(aspect, angle, rotation);
    const actor = createGingerbread(tree, { canGreet: true, autoCycle: false });
    const initialCamera = camera.position.clone(), initialAngle = tree.root.rotation.y;
    const tick = delta => actor.update(delta, camera, true, false);
    tick(.01); assert.ok(actor.greet(camera, side, 'close'));
    assert.equal(actor.root.userData.greetingStyle, 'close');
    tick(2.1); assert.equal(actor.greeting, null, 'the wave waits until the foreground landing');
    const distant = height(actor.root, camera), size = actor.root.scale.z;
    const contact = actor.root.position.clone();
    tick(.07);
    assert.ok(actor.root.scale.y < size * .85 && actor.root.scale.x > size * 1.09);
    assert.ok(Math.hypot(actor.root.position.x - contact.x, actor.root.position.z - contact.z) < .000001);
    assert.ok(Math.abs(actor.root.position.y - .43 * actor.root.scale.y) < .000001, 'the first foreground hop starts with planted feet');
    for (let i = 0; i < 160 && !actor.greeting; i++) {
      tick(.02);
      assert.ok(Math.hypot(actor.root.position.x, actor.root.position.z) >= 2.35 - .000001, 'approach must go around the tree');
      assert.equal(actor.root.scale.z, size, 'apparent growth must come from real depth');
    }
    assert.equal(actor.greeting, actor.root); tick(.7);
    const foreground = height(actor.root, camera), treeHeight = height(tree.root, camera, -.04, 4.33);
    assert.ok(foreground / treeHeight > .47 && foreground / treeHeight < .65, `close-up/tree height ratio: ${foreground / treeHeight}`);
    assert.ok(foreground > distant * 3, 'the face should be dramatically closer than a regular side greeting');
    assert.ok(actor.root.userData.greetingOpacity > .99);
    actor.root.updateWorldMatrix(true, true);
    const face = new THREE.Vector3(0, 0, 1).transformDirection(actor.root.matrixWorld);
    const toward = camera.position.clone().sub(actor.root.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(face.dot(toward) > .95, 'the large smiling face should look at the viewer');
    const body = actor.root.children[0], position = body.geometry.attributes.position, point = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 11) {
      point.fromBufferAttribute(position, i).applyMatrix4(body.matrixWorld).project(camera);
      assert.ok(Math.abs(point.x) < .95 && point.y > -.85 && point.y < .7 && Math.abs(point.z) < 1,
        'the whole foreground cookie must fit inside the viewport');
    }
    tick(3.01); assert.equal(actor.greeting, null);
    let previous = foreground;
    for (let hop = 0; hop < 6; hop++) {
      tick(.48);
      const current = height(actor.root, camera);
      assert.ok(current < previous + .001, 'backward hops should recede naturally in perspective');
      assert.ok(Math.hypot(actor.root.position.x, actor.root.position.z) >= 2.35 - .000001);
      assert.equal(actor.isClimbing, false); previous = current;
    }
    tick(.19); assert.ok(actor.isAway); assert.equal(actor.root.visible, false);
    const end = actor.root.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(end.x * -side > 1.4, 'the retreat finishes beyond the opposite screen edge');
    assert.ok(previous < foreground * .35);
    assert.ok(camera.position.equals(initialCamera)); assert.equal(tree.root.rotation.y, initialAngle);
    actor.dispose();
  }
});

test('close greetings preserve the solid cookie, reuse resources and reset on replay or reduced motion', () => {
  const { tree, camera } = fixture(.5);
  const actor = createGingerbread(tree, { canGreet: true, autoCycle: false });
  const geometry = actor.root.children[0].geometry, positions = geometry.attributes.position.array;
  const rest = positions.slice(), material = actor.root.children[0].material, count = tree.root.children.length;
  for (let round = 0; round < 6; round++) {
    actor.reset(); actor.update(.1, camera, true, false);
    assert.ok(actor.greet(camera, round % 2 ? 1 : -1, 'close'));
    for (let frame = 0; frame < 200 && !actor.isAway; frame++) actor.update(.1, camera, true, false);
    assert.ok(actor.isAway); assert.equal(actor.greeting, null);
    assert.deepEqual(positions, rest); assert.equal(actor.root.children[0].geometry, geometry);
    assert.equal(actor.root.children[0].material, material); assert.equal(tree.root.children.length, count);
  }
  actor.reset(); actor.update(.1, camera, true, false); actor.greet(camera, -1, 'close');
  actor.update(2.1, camera, true, false); actor.update(.5, camera, true, false);
  actor.update(.1, camera, true, true);
  assert.equal(actor.greeting, null); assert.equal(actor.isGreetingVisit, false); assert.equal(actor.root.position.y, 1.95);
  assert.deepEqual(positions, rest);
  camera.position.set(0, 2.31, 2.6); camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  assert.equal(actor.greet(camera, -1, 'close'), false, 'zoomed-in searches must not be interrupted');
  actor.dispose();
});

test('random visits include both greeting styles, and the foreground wave pauses with the interaction guide', () => {
  const { tree, camera } = fixture();
  const visitors = createHolidayVisitors(tree, { random: () => 0 });
  const styles = [];
  let waving = false;
  for (let frame = 0; frame < 2400 && styles.length < 2; frame++) {
    if (!visitors.isPerforming) tree.root.rotation.y += .2;
    visitors.update(.1, camera, true, false);
    if (visitors.greeting && !waving) styles.push(visitors.greeting.userData.greetingStyle);
    waving = Boolean(visitors.greeting);
  }
  assert.deepEqual(styles, ['side', 'close'], 'each shuffled pair of greetings must include both styles');
  const root = visitors.greeting, geometry = root.children[0].geometry;
  const position = root.position.clone(), pose = geometry.attributes.position.array.slice();
  visitors.update(2, camera, true, false, false);
  assert.ok(root.position.equals(position)); assert.deepEqual(geometry.attributes.position.array, pose);
  visitors.reset(); assert.equal(visitors.greeting, null);
  visitors.dispose();
});
