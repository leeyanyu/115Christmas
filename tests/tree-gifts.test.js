import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createTreeGifts } from '../src/scene/tree-gifts.js';
import { createHolidayCharacter } from '../src/scene/holiday-character.js';

test('three baking shades stay brown and progress from light to dark', () => {
  const character = createHolidayCharacter();
  let brightness = Infinity; const colors = new Set();
  for (let i = 0; i < 3; i++) {
    character.dress(i); const c = character.root.children[0].material.color;
    assert.ok(c.r > c.g && c.g > c.b);
    assert.ok(c.r < .5, 'the pale, overbright baking shade returned');
    assert.ok(c.r + c.g + c.b < brightness); brightness = c.r + c.g + c.b;
    colors.add(c.getHex());
  }
  assert.equal(colors.size, 3); character.dress(3);
  assert.equal(character.root.children[0].material.color.getHex(), [...colors][0]); character.dispose();
});

test('gifts pass through the tree base, emerge once, and leave the GJ inlay clear', () => {
  const tree = createTree(), effect = createTreeGifts(tree), root = tree.root.getObjectByName('tree-gifts');
  const branches = [], local = new THREE.Vector3(), point = new THREE.Vector3();
  tree.root.updateWorldMatrix(true, true);
  tree.layers.forEach(layer => layer.traverse(mesh => {
    if (mesh.geometry) branches.push({ inverse: mesh.matrixWorld.clone().invert(), ...mesh.geometry.parameters });
  }));
  effect.update(.6, true, false);
  assert.equal(root.children.filter(g => g.visible).length, 1);
  const start = root.children[0].position.clone(), rotation = root.children[0].quaternion.clone();
  effect.update(.4, true, false);
  assert.ok(root.children[0].position.length() < start.length()); assert.ok(!rotation.equals(root.children[0].quaternion));
  const reserve = new THREE.Box3(new THREE.Vector3(-.35, 0, 1.20), new THREE.Vector3(.35, .6, 1.65));
  let crossedBase = false;
  for (let frame = 0; frame < 60; frame++) {
    effect.update(.1, true, false); tree.root.updateWorldMatrix(true, true);
    for (const gift of root.children) {
      if (!gift.visible) continue;
      const bounds = new THREE.Box3().setFromObject(gift);
      assert.ok(bounds.min.y >= .0799, 'gift sinks into pedestal');
      assert.ok(!bounds.intersectsBox(reserve), 'gift crosses the GJ reserve');
      if (Math.hypot(gift.position.x, gift.position.z) < .3) crossedBase = true;
      // Crossing foliage is intentional during entry. Once parked, the boxes
      // should remain visible beneath it rather than intersecting its branches.
      if (frame < 52) continue;
      gift.traverse(mesh => {
        if (!mesh.geometry) return;
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 13) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          for (const branch of branches) {
            local.copy(point).applyMatrix4(branch.inverse);
            if (Math.abs(local.y) < branch.height / 2) assert.ok(Math.hypot(local.x, local.z) >= branch.radius * (.5 - local.y / branch.height) - .005, `gift intersects foliage at frame ${frame}`);
          }
        }
      });
    }
  }
  assert.ok(crossedBase, 'gifts still approach only along the outside rim');
  const resting = root.children.map(gift => gift.position.clone());
  effect.update(100, true, false); root.children.forEach((gift, i) => assert.ok(gift.position.equals(resting[i])));
  const colors = root.children.map(gift => gift.children[0].material.color.getHex()); assert.equal(new Set(colors).size, 3);
  effect.dispose(); assert.equal(tree.root.getObjectByName('tree-gifts'), undefined);
});

test('tapped presents roll out of the frame once and stay gone until replay', () => {
  for (const aspect of [1.5, .5]) {
    const tree = createTree(), effect = createTreeGifts(tree), camera = new THREE.PerspectiveCamera(37, aspect);
    camera.position.set(0, 3, 10); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
    effect.update(.6, true, false); assert.equal(effect.targets.length, 0);
    effect.update(10, true, false); assert.equal(effect.targets.length, 3);
    const gift = effect.targets[1], position = gift.position.clone(), rotation = gift.quaternion.clone();
    assert.equal(effect.tap(gift.children[0], camera), true); assert.equal(effect.tap(gift, camera), false);
    assert.equal(effect.targets.includes(gift), false);
    effect.update(.4, true, false);
    assert.ok(gift.visible); assert.ok(gift.position.distanceTo(position) > .01); assert.ok(!gift.quaternion.equals(rotation));
    assert.ok(effect.hitTargets.includes(gift), 'a moving gift should still block clicks on the tree behind it');
    assert.ok(new THREE.Box3().setFromObject(gift).min.y >= .0799);
    const pause = gift.position.clone(), pausedRotation = gift.quaternion.clone();
    effect.update(.08, true, false);
    assert.ok(gift.position.distanceTo(pause) < .00001, 'each roll needs a quiet pause');
    assert.ok(gift.quaternion.angleTo(pausedRotation) < .00001);
    effect.update(.14, true, false); assert.ok(gift.position.distanceTo(pause) > .01);
    let time = .62;
    while (gift.visible && time < 20) {
      const previous = gift.position.clone(); effect.update(.02, true, false); time += .02;
      assert.ok(gift.position.distanceTo(previous) / .02 < 2, 'gift launches across the scene too fast');
      assert.ok(gift.position.y < .08 + gift.scale.x * 1.1, 'gift flies above the ground');
    }
    assert.equal(gift.visible, false); assert.ok(time > 1.5 && time < 20);
    assert.ok(!effect.hitTargets.includes(gift));
    const screen = gift.getWorldPosition(new THREE.Vector3()).project(camera); assert.ok(Math.abs(screen.x) > 1.1);
    effect.update(100, true, false); assert.equal(gift.visible, false);
    effect.reset(); effect.update(0, true, true); assert.equal(effect.targets.length, 3);
    assert.equal(effect.tap(gift, camera), true); assert.equal(gift.visible, false);
    effect.update(.1, true, false); assert.equal(gift.visible, false);
    effect.dispose();
  }
});

test('replay reuses gifts and reduced motion shows them at rest immediately', () => {
  const tree = createTree(), effect = createTreeGifts(tree), root = tree.root.getObjectByName('tree-gifts');
  effect.update(0, true, true); const positions = root.children.map(gift => gift.position.clone());
  const geometry = root.children[0].children[0].geometry;
  for (let i = 0; i < 20; i++) {
    effect.reset(); assert.equal(root.visible, false); effect.update(.1, false, false); assert.equal(root.visible, false);
    effect.update(.1, true, true);
    effect.update(.1, true, false);
    root.children.forEach((gift, index) => { assert.ok(gift.visible); assert.ok(gift.position.equals(positions[index])); });
    assert.equal(root.children[0].children[0].geometry, geometry);
    assert.equal(root.children.length, 3);
  }
  let disposed = 0; geometry.addEventListener('dispose', () => disposed++); effect.dispose(); assert.equal(disposed, 1);
});

test('a turning camera does not make a departing gift vanish inside the new view', () => {
  const tree = createTree(), effect = createTreeGifts(tree), camera = new THREE.PerspectiveCamera(37, 1.5);
  camera.position.set(0, 3, 10); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  effect.update(10, true, false); const gift = effect.targets[1]; effect.tap(gift, camera); effect.update(.4, true, false);
  camera.position.set(10, 3, 0); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  for (let time = 0; gift.visible && time < 30; time += .1) effect.update(.1, true, false);
  assert.equal(gift.visible, false);
  const p = gift.getWorldPosition(new THREE.Vector3()).project(camera);
  assert.ok(Math.abs(p.x) >= 1.1 || Math.abs(p.y) >= 1.1, 'gift disappeared while still inside the camera frame');
  effect.dispose();
});
