import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createCampfireParty } from '../src/scene/campfire-party.js';
import { createHolidayVisitors } from '../src/scene/holiday-visitors.js';
import { createGingerbread } from '../src/scene/gingerbread.js';

function setup({ random = () => 0, aspect = 1.5, ...options } = {}) {
  const tree = createTree(), canvas = new EventTarget(), controls = new THREE.EventDispatcher();
  const activityTarget = new EventTarget(), visibilityTarget = new EventTarget();
  const camera = new THREE.PerspectiveCamera(37, aspect); camera.position.set(0, 3, aspect < 1 ? 15 : 11); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  if (aspect < 1) {
    const tangent = Math.tan(THREE.MathUtils.degToRad(37 / 2));
    const distance = Math.max(2.3 / (tangent * .68), 1.95 / (tangent * aspect * .85));
    camera.position.set(0, 2.05 + distance / Math.sqrt(101), distance * 10 / Math.sqrt(101)); camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  }
  const events = { starts: 0, ends: 0, sparks: 0 };
  const party = createCampfireParty({ tree, canvas, controls, activityTarget, visibilityTarget, random,
    onStart: () => events.starts++, onEnd: () => events.ends++, onSpark: () => events.sparks++, ...options });
  const step = (seconds, ready = true, reduced = false, blocked = false) => {
    for (let t = 0; t < seconds - .00001; t += .1) party.update(Math.min(.1, seconds - t), camera, ready, reduced, blocked);
  };
  return { tree, canvas, controls, camera, party, events, step, activityTarget, visibilityTarget };
}

test('a rare party dances once around the tree with bounded spark bursts and clean lighting', () => {
  const f = setup(), root = f.tree.root.getObjectByName('campfire-party'), light = f.tree.root.getObjectByName('campfire-warmth');
  const camera = f.camera.position.clone(), original = f.tree.root.rotation.y;
  f.step(17.8); assert.equal(f.party.isActive, false);
  f.step(1.5); assert.ok(f.party.isActive); assert.equal(f.party.targets.length, 8); assert.ok(light.intensity > .5);
  const points = f.party.targets.map(guest => guest.getWorldPosition(new THREE.Vector3()));
  f.step(.7); assert.ok(f.party.targets.some((guest, i) => guest.getWorldPosition(new THREE.Vector3()).distanceTo(points[i]) > .1));
  assert.ok(f.party.tap(f.party.targets[0].children[0])); const sparks = f.events.sparks;
  f.party.tap(f.party.targets[0]); assert.equal(f.events.sparks, sparks);
  f.step(10); assert.equal(f.party.isActive, false); assert.equal(f.party.targets.length, 0); assert.equal(root.visible, false); assert.equal(light.intensity, 0);
  assert.ok(Math.abs(f.tree.root.rotation.y - original - Math.PI * 2) < 1e-7);
  assert.ok(f.camera.position.equals(camera)); assert.equal(f.events.starts, 1); assert.equal(f.events.ends, 1);
  assert.ok(f.events.sparks >= 4 && f.events.sparks <= 5);
  f.step(60); assert.equal(f.events.starts, 1); f.step(12); assert.equal(f.events.starts, 2); f.party.dispose();
});

test('a party waits for safe framing, reduced motion, active rewards, and visible visitors', () => {
  let safe = false; const f = setup({ canStart: () => safe });
  f.step(30); assert.equal(f.events.starts, 0); safe = true;
  f.step(40, true, true); assert.equal(f.events.starts, 0);
  f.step(20, true, false, true); assert.equal(f.events.starts, 0);
  const position = f.camera.position.clone(); f.camera.position.set(0, 3, 3.8); f.camera.lookAt(0, 2, 0); f.camera.updateMatrixWorld();
  f.step(1); assert.equal(f.events.starts, 0);
  f.camera.position.copy(position); f.camera.lookAt(0, 2, 0); f.camera.updateMatrixWorld();
  f.step(.2); assert.equal(f.events.starts, 1);
  f.step(.1, true, true); assert.equal(f.party.isActive, false); assert.equal(f.events.ends, 1);
  f.party.dispose();
});

test('manual camera gestures suspend automatic turning and a blessing finale fades the party out', () => {
  const f = setup(); f.step(20); assert.ok(f.party.isActive);
  f.canvas.dispatchEvent(new Event('pointerdown')); const angle = f.tree.root.rotation.y;
  f.step(1); assert.equal(f.tree.root.rotation.y, angle); assert.ok(f.party.isActive);
  f.activityTarget.dispatchEvent(new Event('pointerup')); f.step(.8); assert.ok(f.tree.root.rotation.y > angle);
  f.canvas.dispatchEvent(new Event('wheel')); const zoomAngle = f.tree.root.rotation.y;
  f.step(.5); assert.equal(f.tree.root.rotation.y, zoomAngle);
  f.party.stop(); const stopped = f.tree.root.rotation.y;
  f.step(.5, true, false, true); assert.ok(f.party.isActive); assert.equal(f.tree.root.rotation.y, stopped);
  f.step(.6, true, false, true); assert.equal(f.party.isActive, false); assert.equal(f.events.ends, 1);
  f.party.reset(); f.step(19); assert.ok(f.party.isActive);
  f.visibilityTarget.hidden = true; f.visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.party.isActive, false); assert.equal(f.tree.root.getObjectByName('campfire-warmth').intensity, 0);
  f.party.dispose();
});

test('eight full-size dancers stay grounded and separated on desktop and phone without accumulating models', () => {
  for (const aspect of [1.5, .5]) {
    const f = setup({ aspect }), root = f.tree.root.getObjectByName('campfire-party');
    const climber = createGingerbread(f.tree); climber.update(.1, f.camera, true, true);
    const size = climber.root.scale.z; climber.dispose();
    const branches = []; f.tree.root.updateWorldMatrix(true, true);
    f.tree.layers.forEach(layer => layer.traverse(mesh => {
      if (mesh.geometry) branches.push({ inverse: mesh.matrixWorld.clone().invert(), ...mesh.geometry.parameters });
    }));
    const inverseTree = new THREE.Matrix4(), point = new THREE.Vector3(), local = new THREE.Vector3(), projected = new THREE.Vector3();
    const geometries = root.children.filter(g => g.userData.campfireGuest).map(g => g.children[0].geometry);
    for (let repeat = 0; repeat < 3; repeat++) {
      f.party.reset(); f.step(18.1);
      for (let i = 0; i < 100; i++) {
        f.step(.1); f.tree.root.updateWorldMatrix(true, true);
        const guests = f.party.targets; assert.equal(guests.length, 8);
        inverseTree.copy(f.tree.root.matrixWorld).invert();
        guests.forEach((guest, index) => {
          const bounds = new THREE.Box3().setFromObject(guest);
          assert.ok(bounds.min.y >= -.00001, 'a dancer sinks below the ground');
          assert.equal(guest.scale.z, size, 'dance guests must match the regular climber size');
          const positions = guest.children[0].geometry.attributes.position;
          for (let vertex = 0; vertex < positions.count; vertex += 37) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(guest.children[0].matrixWorld).applyMatrix4(inverseTree);
            assert.ok(point.y > .08 || Math.hypot(point.x, point.z) > 1.80, 'a dancer passes through the pedestal');
            if (aspect < 1 && !repeat) {
              projected.copy(point).applyMatrix4(f.tree.root.matrixWorld).project(f.camera);
              assert.ok(Math.abs(projected.x) <= 1, 'a full-size phone dancer is clipped by the screen edge');
            }
            if (!repeat) for (const branch of branches) {
              local.copy(point).applyMatrix4(branch.inverse);
              if (Math.abs(local.y) < branch.height / 2) assert.ok(Math.hypot(local.x, local.z) >= branch.radius * (.5 - local.y / branch.height) - .005, `dancer intersects foliage at frame ${i}`);
            }
          }
          assert.equal(guest.children[0].geometry, geometries[index]);
          guests.slice(index + 1).forEach(other => assert.ok(guest.position.distanceTo(other.position) > 1.1));
        });
      }
      f.step(1); assert.equal(f.party.isActive, false); assert.equal(root.children.length, 9);
    }
    let disposed = 0; geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
    f.party.dispose(); assert.equal(disposed, 8); assert.equal(f.tree.root.getObjectByName('campfire-party'), undefined);
  }
});

test('regular visitors gather only when concealed and resume their arrivals after the party', () => {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, 1.5); camera.position.set(0, 3, 11);
  const visitors = createHolidayVisitors(tree, { random: () => .9 }); visitors.update(.1, camera, true, false);
  assert.ok(visitors.canGather(camera)); camera.position.z = -11; assert.equal(visitors.canGather(camera), false);
  visitors.beginParty(); visitors.update(20, camera, true, false); assert.equal(visitors.targets.length, 0);
  assert.equal(visitors.canGather(camera), false);
  visitors.endParty();
  for (let i = 0; i < 180; i++) visitors.update(.1, camera, true, false);
  assert.ok(visitors.targets.length > 0); visitors.reset(); visitors.update(.1, camera, true, true);
  assert.equal(visitors.targets.length, 1); visitors.dispose();
});
