import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTreeCelebration } from '../src/scene/tree-celebration.js';

test('celebration makes one eased turn, supports interruption and reduced motion', () => {
  const tree = { root: new THREE.Group() }, canvas = new EventTarget(), controls = new THREE.EventDispatcher();
  let rewards = 0;
  const effect = createTreeCelebration({ tree, canvas, controls, onStart: () => rewards++, activityTarget: new EventTarget(), visibilityTarget: new EventTarget() });
  effect.start(false);
  effect.update(1.6, true, false); assert.ok(Math.abs(tree.root.rotation.y - Math.PI) < 1e-8);
  effect.update(1.6, true, false); assert.ok(Math.abs(tree.root.rotation.y - Math.PI * 2) < 1e-8);
  assert.equal(effect.isActive, false); assert.equal(rewards, 1);
  effect.start(false); effect.update(.6, true, false);
  canvas.dispatchEvent(new Event('pointerdown')); const angle = tree.root.rotation.y;
  effect.update(5, true, false); assert.equal(tree.root.rotation.y, angle);
  effect.start(true); effect.update(4, true, true);
  assert.equal(tree.root.rotation.y, angle); assert.equal(rewards, 3);
  effect.start(false); effect.reset(); assert.equal(effect.isActive, false);
  effect.dispose();
});
