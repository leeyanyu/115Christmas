import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createRotationGlow } from '../src/scene/rotation-glow.js';
function setup() {
  const controls = new THREE.EventDispatcher();
  controls.getAzimuthalAngle = () => 0; controls.getPolarAngle = () => 1;
  const activityTarget = new EventTarget(), visibilityTarget = new EventTarget(), canvas = new EventTarget();
  visibilityTarget.hidden = false;
  const tree = createTree();
  const effect = createRotationGlow({ tree, controls, canvas, activityTarget, visibilityTarget });
  return { controls, tree, effect, activityTarget, visibilityTarget, canvas };
}
test('idle rotates the tree one full turn, pauses ten seconds and repeats', () => {
  const s = setup();
  s.effect.beforeUpdate(20, false, false); assert.equal(s.tree.root.rotation.y, 0);
  s.effect.beforeUpdate(9.99, true, false); assert.equal(s.tree.root.rotation.y, 0);
  s.effect.beforeUpdate(.02, true, false); assert.ok(s.tree.root.rotation.y > 0);
  s.effect.beforeUpdate(8, true, false); assert.ok(Math.abs(s.tree.root.rotation.y - Math.PI * 2) < 1e-8);
  assert.equal(s.controls.autoRotate, false);
  s.effect.beforeUpdate(9.99, true, false); assert.ok(Math.abs(s.tree.root.rotation.y - Math.PI * 2) < 1e-8);
  s.effect.beforeUpdate(.02, true, false); assert.ok(s.tree.root.rotation.y > Math.PI * 2);
  s.canvas.dispatchEvent(new Event('pointerdown')); const held = s.tree.root.rotation.y;
  s.effect.beforeUpdate(30, true, false); assert.equal(s.tree.root.rotation.y, held);
  s.activityTarget.dispatchEvent(new Event('pointerup'));
  s.effect.beforeUpdate(9, true, false); assert.equal(s.tree.root.rotation.y, held);
  s.effect.reset(); s.effect.beforeUpdate(9, true, false); assert.equal(s.tree.root.rotation.y, held);
  s.effect.dispose();
});
test('tree rotation lights the tree and larger bulb halos, then fades', () => {
  const s = setup(), halo = s.tree.root.getObjectByName('rotation-glow');
  const sample = turn => {
    s.tree.starMaterial.emissiveIntensity = .45;
    s.tree.bulbs.forEach(b => { b.material.color.set('#F4E9D9'); b.scale.setScalar(1.15); });
    s.tree.root.rotation.y += turn; s.effect.update(.1, false, 1);
  };
  sample(0); assert.equal(halo.visible, false);
  sample(.05); const first = halo.material.uniforms.strength.value;
  assert.ok(first > 0 && first < 1); assert.ok(s.tree.bulbs[0].scale.x > 1.15);
  sample(.01); assert.ok(halo.material.uniforms.strength.value > first);
  assert.ok(s.tree.starMaterial.emissiveIntensity > .45); assert.equal(halo.visible, true);
  const peak = halo.material.uniforms.strength.value;
  sample(0); assert.ok(halo.material.uniforms.strength.value < peak);
  for (let i = 0; i < 30; i++) sample(0);
  assert.equal(halo.visible, false);
  s.effect.dispose(); assert.equal(s.tree.root.getObjectByName('rotation-glow'), undefined);
});
test('reduced motion and hidden pages prevent automatic tree rotation', () => {
  const s = setup();
  s.effect.beforeUpdate(20, true, true); assert.equal(s.tree.root.rotation.y, 0);
  s.visibilityTarget.hidden = true; s.visibilityTarget.dispatchEvent(new Event('visibilitychange'));
  s.effect.beforeUpdate(30, true, false); assert.equal(s.tree.root.rotation.y, 0);
  s.visibilityTarget.hidden = false; s.effect.beforeUpdate(9, true, false); assert.equal(s.tree.root.rotation.y, 0);
  s.effect.beforeUpdate(1, true, false); assert.ok(s.tree.root.rotation.y > 0);
  s.effect.dispose();
});

test('original OrbitControls rotation also lights the tree without changing its pose', () => {
  const s = setup();
  s.controls.getAzimuthalAngle = () => .2;
  s.effect.update(.1, false, 1);
  const halo = s.tree.root.getObjectByName('rotation-glow');
  assert.ok(halo.material.uniforms.strength.value > 0);
  assert.equal(s.tree.root.rotation.y, 0);
  s.effect.dispose();
});
