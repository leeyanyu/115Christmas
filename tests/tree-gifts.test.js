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
    assert.ok(c.r + c.g + c.b < brightness); brightness = c.r + c.g + c.b;
    colors.add(c.getHex());
  }
  assert.equal(colors.size, 3); character.dress(3);
  assert.equal(character.root.children[0].material.color.getHex(), [...colors][0]); character.dispose();
});

test('small gifts roll once, stay above the pedestal and clear foliage and the GJ inlay', () => {
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
  for (let frame = 0; frame < 60; frame++) {
    effect.update(.1, true, false); tree.root.updateWorldMatrix(true, true);
    for (const gift of root.children) {
      if (!gift.visible) continue;
      const bounds = new THREE.Box3().setFromObject(gift);
      assert.ok(bounds.min.y >= .0799, 'gift sinks into pedestal');
      assert.ok(bounds.min.x > .45 || bounds.max.x < -.45, 'gift crosses the GJ reserve');
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
  const resting = root.children.map(gift => gift.position.clone());
  effect.update(100, true, false); root.children.forEach((gift, i) => assert.ok(gift.position.equals(resting[i])));
  const colors = root.children.map(gift => gift.children[0].material.color.getHex()); assert.equal(new Set(colors).size, 3);
  effect.dispose(); assert.equal(tree.root.getObjectByName('tree-gifts'), undefined);
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
