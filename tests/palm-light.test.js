import test from 'node:test';
import assert from 'node:assert/strict';
import { createTree } from '../src/scene/tree.js';
import { createPalmLight } from '../src/scene/palm-light.js';

test('palm rotation is eased, bounded, pauses while blocked and does not touch camera controls', () => {
  const tree = createTree(), effect = createPalmLight(tree);
  effect.input({ present: true, turn: .4, progress: 0 }, true);
  effect.rotate(.1, false, true);
  assert.ok(tree.root.rotation.y > 0 && tree.root.rotation.y <= .15 + 1e-10);
  const angle = tree.root.rotation.y;
  effect.rotate(.1, false, false); assert.equal(tree.root.rotation.y, angle);
  effect.input({ present: true, turn: .2, progress: 0 }, true);
  effect.rotate(.9, false, true); assert.equal(effect.isPresent, false);
  assert.equal(tree.root.rotation.y, angle, 'stale detections stop motion');
  effect.reset(); assert.equal(effect.isPresent, false); effect.dispose();
});
test('brief missing observations ease out existing motion, while explicit camera stop cancels it', () => {
  const tree = createTree(), effect = createPalmLight(tree);
  effect.input({ present: true, turn: .8, progress: 0 }, true);
  effect.rotate(.05, false, true); const angle = tree.root.rotation.y;
  effect.input({ present: false, grace: true, turn: 0, progress: 0 }, true);
  effect.rotate(.05, false, true); assert.ok(tree.root.rotation.y > angle);
  effect.input({ present: false, turn: 0, progress: 0, reset: true }, true);
  const stopped = tree.root.rotation.y;
  effect.rotate(.1, false, true); assert.equal(tree.root.rotation.y, stopped);
  effect.dispose();
});
test('palm light charges the star then flows downward, fading with pooled resources', () => {
  const tree = createTree(), effect = createPalmLight(tree, 36);
  const halo = tree.root.getObjectByName('palm-light-flow');
  const particles = tree.root.children.findLast(o => o.name === 'interaction-starlight');
  const count = tree.root.children.length, geometry = particles.geometry;
  effect.input({ present: true, turn: 0, progress: .8 }, true);
  effect.update(.1, false); assert.ok(halo.material.uniforms.starGlow.value > 0);
  assert.equal(effect.start(), true); assert.equal(effect.start(), true);
  effect.update(1, false); const top = halo.material.uniforms.head.value;
  for (let i = 0; i < 15; i++) effect.update(.1, false);
  assert.ok(halo.material.uniforms.head.value < top);
  assert.equal(particles.visible, true);
  effect.update(2.3, false);
  assert.ok(halo.material.uniforms.afterglow.value > .5, 'the light remains after the front has passed');
  assert.ok(effect.dimStrength > .5); assert.equal(halo.visible, true);
  effect.update(3, false); assert.equal(effect.isFlowing, false);
  for (let j = 0; j < 20; j++) { effect.start(); for (let i = 0; i < 60; i++) effect.update(.1, false); }
  assert.equal(tree.root.children.length, count); assert.equal(particles.geometry, geometry);
  effect.reset(); assert.equal(halo.visible, false); assert.equal(particles.visible, false);
  effect.dispose(); assert.equal(tree.root.getObjectByName('palm-light-flow'), undefined);
});
test('reduced motion uses dimmer light without dispersing particles', () => {
  const tree = createTree(), effect = createPalmLight(tree);
  const particles = tree.root.children.findLast(o => o.name === 'interaction-starlight');
  effect.start(); for (let i = 0; i < 20; i++) effect.update(.1, true);
  assert.equal(particles.visible, false);
  assert.ok(tree.root.getObjectByName('palm-flow-lamp').intensity < 2);
  assert.ok(effect.dimStrength < .4);
  effect.dispose();
});
test('the flow lamp faces the viewer even when the tree has turned around', () => {
  const tree = createTree(), effect = createPalmLight(tree);
  tree.root.rotation.y = Math.PI;
  effect.start(); effect.update(2, false, 1, 800, .3);
  const lamp = tree.root.getObjectByName('palm-flow-lamp');
  const world = lamp.getWorldPosition(lamp.position.clone());
  assert.ok(world.z > 0);
  assert.ok(Math.abs(Math.atan2(world.x, world.z) - .3) < .001);
  effect.reset(); assert.equal(effect.dimStrength, 0); assert.equal(effect.isRotating, false);
  effect.dispose();
});
