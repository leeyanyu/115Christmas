import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createTreeTheme } from '../src/scene/tree-theme.js';
import { createGingerbread } from '../src/scene/gingerbread.js';

test('tree themes restore the original foliage and leave ornaments untouched', () => {
  const tree = createTree(), material = tree.layers[0].children[0].material;
  const original = material.color.clone(), gold = tree.animated[0].material.color.clone();
  const theme = createTreeTheme(tree);
  theme.set('snow'); theme.update(10, false);
  assert.ok(material.color.r > original.r);
  assert.ok(tree.animated[0].material.color.equals(gold));
  theme.set('classic'); theme.update(10, false);
  assert.ok(Math.abs(material.color.g - original.g) < .001);
  theme.set('aurora'); theme.update(1, true); const color = material.color.clone();
  theme.update(1, true); assert.ok(material.color.equals(color));
  theme.dispose(); assert.ok(material.color.equals(original));
});

test('gingerbread bounces offscreen without shrinking, waits out of view and reuses its model', () => {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 10);
  const effect = createGingerbread(tree), ginger = tree.root.getObjectByName('hidden-gingerbread');
  const home = ginger.position.clone(), count = ginger.children.length;
  effect.update(2, camera, true, false); assert.ok(ginger.position.equals(home));
  camera.position.z = -10;
  camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  effect.update(1.2, camera, true, false); effect.update(.6, camera, true, false);
  assert.ok(ginger.position.y < home.y);
  effect.update(.6, camera, true, false); assert.ok(Math.abs(ginger.position.y - .51) < .001);
  effect.update(.8, camera, true, false); effect.update(.45, camera, true, false);
  assert.ok(ginger.position.y > .51); assert.ok(ginger.scale.x > .9);
  effect.update(2.25, camera, true, false); assert.equal(ginger.visible, false);
  const screen = ginger.getWorldPosition(new THREE.Vector3()).project(camera);
  assert.ok(screen.x > 1.2); assert.ok(ginger.scale.x > .9);
  effect.update(25, camera, true, false); assert.equal(ginger.visible, false);
  camera.position.z = 10; effect.update(.1, camera, true, false);
  assert.ok(ginger.position.equals(home)); assert.equal(ginger.children.length, count);
  effect.reset(); assert.equal(ginger.visible, false);
  effect.dispose(); assert.equal(tree.root.getObjectByName('hidden-gingerbread'), undefined);
});
