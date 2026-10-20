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

test('a close greeting frames a giant face at the side of the lens with the body cropped outside the screen', () => {
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
    const foreground = height(actor.root, camera), faceHeight = height(actor.root, camera, .18, .49);
    const treeHeight = height(tree.root, camera, -.04, 4.33), ratio = faceHeight / treeHeight;
    assert.ok(ratio > (aspect < 1 ? .4 : .65) && ratio < 1.05, `giant face/tree height ratio: ${ratio}`);
    assert.ok(foreground > distant * 6, 'the face must be a much closer crop than an enlarged whole-body greeting');
    assert.ok(actor.root.userData.greetingOpacity > .99);
    actor.root.updateWorldMatrix(true, true);
    const face = new THREE.Vector3(0, 0, 1).transformDirection(actor.root.matrixWorld);
    const facePosition = new THREE.Vector3(0, .32, .075).applyMatrix4(actor.root.matrixWorld);
    const toward = camera.position.clone().sub(facePosition).normalize();
    assert.ok(face.dot(toward) > .95, 'the large smiling face should look at the viewer');
    const center = facePosition.clone().project(camera);
    assert.ok(center.x * side > .1 && center.x * side < .7, 'the face must peek in from its entrance side');
    for (const feature of actor.root.children.slice(1, 5)) {
      const point = feature.getWorldPosition(new THREE.Vector3()).project(camera);
      assert.ok(Math.abs(point.x) < .95 && Math.abs(point.y) < .85 && Math.abs(point.z) < 1,
        'eyes and cheeks must stay visible even when the body is cropped');
    }
    const feet = new THREE.Vector3(0, -.43, 0).applyMatrix4(actor.root.matrixWorld).project(camera);
    assert.ok(feet.y < -1, 'feet must be outside the viewport, matching the giant-head reference');
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

test('the close-up waves the visible inner hand and restores both solid arms on retreat', () => {
  for (const side of [-1, 1]) {
    const { tree, camera } = fixture();
    const actor = createGingerbread(tree, { canGreet: true, autoCycle: false });
    const positions = actor.root.children[0].geometry.attributes.position.array, rest = positions.slice();
    actor.update(.1, camera, true, false); actor.greet(camera, side, 'close');
    for (let i = 0; i < 100 && !actor.greeting; i++) actor.update(.05, camera, true, false);
    actor.update(.8, camera, true, false);
    let moving = 0;
    for (let i = 0; i < rest.length; i += 3) {
      assert.equal(positions[i + 2], rest[i + 2], 'waving preserves the closed cookie thickness');
      if (Math.sign(rest[i]) === -side && Math.abs(rest[i]) > .23 && rest[i + 1] > .1 && rest[i + 1] < .29) {
        if (Math.abs(positions[i + 1] - rest[i + 1]) > .01) moving++;
      }
      if (Math.sign(rest[i]) === side) {
        assert.equal(positions[i], rest[i]); assert.equal(positions[i + 1], rest[i + 1], 'the outer arm stays in its rest pose');
      }
    }
    assert.ok(moving > 100, 'the hand toward the middle of the screen must actually wave');
    actor.update(3, camera, true, false); assert.deepEqual(positions, rest);
    actor.reset(); assert.deepEqual(positions, rest);
    actor.dispose();
  }
});

test('the giant head leans into the greeting and straightens before retreat without a sudden turn', () => {
  const { tree, camera } = fixture();
  const actor = createGingerbread(tree, { canGreet: true, autoCycle: false });
  const tick = delta => actor.update(delta, camera, true, false);
  tick(.1); actor.greet(camera, 1, 'close');
  for (let i = 0; i < 120 && !actor.greeting; i++) tick(.05);
  assert.ok(actor.greeting);
  const landed = actor.root.quaternion.clone();
  tick(.01); assert.ok(actor.root.quaternion.angleTo(landed) < .02, 'the close-up must not snap into its leaning pose');
  tick(.79); assert.ok(actor.root.rotation.z > .07, 'the head should gradually lean toward the tree');
  tick(2.89); assert.ok(actor.greeting && Math.abs(actor.root.rotation.z) < .01, 'the head must straighten gently before jumping backward');
  tick(.02); assert.equal(actor.greeting, null);
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
