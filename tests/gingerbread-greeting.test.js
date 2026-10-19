import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createGingerbread } from '../src/scene/gingerbread.js';
import { createHolidayVisitors } from '../src/scene/holiday-visitors.js';

function setup(aspect = 1.5, angle = 0, rotation = 0) {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, aspect, .1, 60);
  tree.root.rotation.y = rotation;
  const distance = aspect < 1 ? 15 : 10.1;
  camera.position.set(Math.sin(angle) * distance, 2.05 + distance * .1, Math.cos(angle) * distance);
  camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  return { tree, camera };
}

test('entry has distinct grounded compressions, short ballistic hops and a final landing', () => {
  for (const aspect of [1.5, .5]) {
    const { tree, camera } = setup(aspect);
    const actor = createGingerbread(tree, { canGreet: true, autoCycle: false });
    actor.update(.01, camera, true, false); actor.greet(camera, -1);
    const hops = aspect > 1.1 ? 4 : 3, size = actor.root.scale.z;
    const feet = () => actor.root.position.y - .43 * actor.root.scale.y;
    for (let hop = 0; hop < hops; hop++) {
      const start = actor.root.position.clone();
      actor.update(.07, camera, true, false);
      assert.ok(Math.abs(feet()) < .00001, 'feet must stay grounded while the cookie compresses');
      assert.ok(actor.root.scale.y < size * .85 && actor.root.scale.x > size * 1.09);
      assert.ok(Math.hypot(actor.root.position.x - start.x, actor.root.position.z - start.z) < .00001,
        'the cookie must not glide sideways during ground contact');
      actor.update(.07, camera, true, false);
      actor.update(.16, camera, true, false);
      assert.ok(feet() > size * .15, 'each short jump needs a visible apex');
      assert.equal(actor.greeting, null, 'the greeting starts after the last landing');
      actor.update(.16, camera, true, false);
      assert.ok(Math.abs(feet()) < .00001, 'every hop must return to the same ground plane');
    }
    actor.update(.09, camera, true, false); assert.ok(actor.root.scale.y < size * .9);
    actor.update(.091, camera, true, false);
    assert.equal(actor.greeting, actor.root); assert.equal(actor.root.scale.y, size);
    assert.ok(Math.abs(feet()) < .00001);
    actor.dispose();
  }
});

test('side greeting jumps into view, faces the viewer, waves its own arm and climbs slowly behind the tree', () => {
  for (const [aspect, angle, side, rotation] of [[1.5, 0, -1, 0], [.5, 0, 1, 0], [1.5, 1.8, 1, .7], [.5, -2, -1, 1.1]]) {
    const { tree, camera } = setup(aspect, angle, rotation);
    const actor = createGingerbread(tree, { canGreet: true, autoCycle: false, linger: 20 });
    const body = actor.root.children[0].geometry, rest = body.attributes.position.array.slice();
    const cameraPosition = camera.position.clone(), treeAngle = tree.root.rotation.y;
    assert.equal(actor.greet(camera, side), false);
    actor.update(.01, camera, true, false); assert.equal(actor.greet(camera, side), true);
    assert.equal(actor.greet(camera, side), false, 'a second arrival cannot interrupt the first');
    const point = actor.root.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(point.x * side > 1.2, 'arrival must begin beyond the chosen screen edge');
    actor.update(.65, camera, true, false); assert.ok(actor.root.position.y > .43 * actor.root.scale.z);
    actor.update((aspect > 1.1 ? 2.02 : 1.56) - .65 + .001, camera, true, false); assert.equal(actor.greeting, actor.root);
    actor.update(.6, camera, true, false);
    assert.ok(actor.root.userData.greetingOpacity > .9);
    assert.notDeepEqual(body.attributes.position.array, rest, 'the cookie arm must actually move');
    for (let i = 0; i < rest.length; i += 3) {
      assert.equal(body.attributes.position.array[i + 2], rest[i + 2], 'waving must preserve the thin, closed cookie thickness');
      if (rest[i] < 0 || rest[i + 1] > .35 || rest[i + 1] < 0) {
        assert.equal(body.attributes.position.array[i], rest[i]);
        assert.equal(body.attributes.position.array[i + 1], rest[i + 1]);
      }
    }
    actor.root.updateWorldMatrix(true, false);
    const face = new THREE.Vector3(0, 0, 1).transformDirection(actor.root.matrixWorld);
    const toward = camera.position.clone().sub(actor.root.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(face.dot(toward) > .8, 'the viewer should see the face while it waves');
    actor.update(3.1, camera, true, false); assert.equal(actor.greeting, null);
    assert.deepEqual(body.attributes.position.array, rest, 'the solid cookie must return to its original shape');
    for (let i = 0; i < 50; i++) actor.update(.1, camera, true, false);
    const base = actor.root.position.y;
    actor.update(2.7, camera, true, false);
    assert.ok(actor.root.position.y > base && actor.root.position.y < 1.95, 'the climb must still be progressing after 2.7 seconds');
    actor.update(3, camera, true, false);
    assert.equal(actor.isPerforming, false); assert.equal(actor.root.position.y, 1.95);
    const localCamera = tree.root.worldToLocal(camera.position.clone());
    assert.ok(actor.root.position.x * localCamera.x + actor.root.position.z * localCamera.z < 0, 'the final perch must be behind the tree for this viewer');
    assert.ok(camera.position.equals(cameraPosition)); assert.equal(tree.root.rotation.y, treeAngle);
    actor.dispose();
  }
});

test('random greetings reach a waiting front-view visitor and pause for dialogs, parties and reduced motion', () => {
  const { tree, camera } = setup();
  const visitors = createHolidayVisitors(tree, { random: () => 0 });
  const tick = (seconds, reduced = false, allow = true) => { for (let elapsed = 0; elapsed < seconds; elapsed += .1) visitors.update(.1, camera, true, reduced, allow); };
  tick(20, false, false); assert.equal(visitors.greeting, null);
  tick(14.5); assert.ok(visitors.greeting, 'a greeting cannot depend on first discovering or tapping the old hidden climber');
  const actor = visitors.greeting, position = actor.position.clone(), opacity = actor.userData.greetingOpacity;
  tick(2, false, false); assert.ok(actor.position.equals(position)); assert.equal(actor.userData.greetingOpacity, opacity);
  assert.equal(visitors.canGather(camera), false);
  visitors.beginParty(); tick(2); assert.equal(visitors.greeting, null); assert.equal(visitors.targets.length, 0);
  visitors.endParty(); visitors.reset(); tick(120, true); assert.equal(visitors.greeting, null);
  const initial = visitors.targets[0].position.clone(); tick(5, true); assert.ok(visitors.targets[0].position.equals(initial));
  visitors.dispose();
});

test('greetings respect close-ups and reuse the same solid cookie through replay and disposal', () => {
  const { tree, camera } = setup(.5);
  const actor = createGingerbread(tree, { canGreet: true, autoCycle: false, linger: 20 });
  actor.update(.1, camera, true, false);
  const original = camera.position.clone(); camera.position.set(0, 2.31, 2.6); camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  assert.equal(actor.greet(camera, -1), false, 'zoomed-in tree searches must not be interrupted');
  camera.position.copy(original); camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  const geometry = actor.root.children[0].geometry, positions = geometry.attributes.position.array, material = actor.root.children[0].material;
  const count = tree.root.children.length;
  for (let round = 0; round < 8; round++) {
    actor.reset(); actor.update(.1, camera, true, false); assert.ok(actor.greet(camera, round % 2 ? -1 : 1));
    for (let i = 0; i < 160; i++) actor.update(.1, camera, true, false);
    assert.equal(actor.root.children[0].geometry, geometry); assert.equal(geometry.attributes.position.array, positions);
    assert.equal(actor.root.children[0].material, material); assert.equal(tree.root.children.length, count);
    assert.equal(actor.isGreetingVisit, false);
  }
  let disposed = 0; geometry.addEventListener('dispose', () => disposed++);
  actor.dispose(); assert.equal(disposed, 1);
});

test('the entire greeting, return and slower climb stay outside the branch volumes', () => {
  for (const aspect of [1.5, .5]) {
    const { tree, camera } = setup(aspect, 1.6);
    const actor = createGingerbread(tree, { canGreet: true, autoCycle: false, linger: 20 });
    actor.update(.01, camera, true, false); assert.ok(actor.greet(camera, -1));
    const branches = []; tree.root.updateWorldMatrix(true, true);
    tree.layers.forEach(layer => layer.traverse(mesh => {
      if (mesh.geometry) branches.push({ inverse: mesh.matrixWorld.clone().invert(), ...mesh.geometry.parameters });
    }));
    const body = actor.root.children[0], positions = body.geometry.attributes.position;
    const point = new THREE.Vector3(), local = new THREE.Vector3();
    for (let frame = 0; frame < 160; frame++) {
      actor.update(.1, camera, true, false); body.updateWorldMatrix(true, false);
      for (let i = 0; i < positions.count; i += 37) {
        point.fromBufferAttribute(positions, i).applyMatrix4(body.matrixWorld);
        for (const branch of branches) {
          local.copy(point).applyMatrix4(branch.inverse);
          if (Math.abs(local.y) < branch.height / 2) {
            assert.ok(Math.hypot(local.x, local.z) >= branch.radius * (.5 - local.y / branch.height) - .005,
              `cookie passes through a branch at frame ${frame}, aspect ${aspect}`);
          }
        }
      }
    }
    actor.dispose();
  }
});
