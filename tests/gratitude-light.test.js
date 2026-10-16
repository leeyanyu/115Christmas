import test from 'node:test';
import assert from 'node:assert/strict';
import { createTree } from '../src/scene/tree.js';
import { createGratitudeLight } from '../src/scene/gratitude-light.js';

test('twelve deliberate touches illuminate upwards, bloom, reset and reuse resources', () => {
  const tree = createTree(), messages = [];
  const effect = createGratitudeLight({ tree, onChange: state => messages.push(state) });
  const halo = tree.root.getObjectByName('gratitude-light');
  const geometry = halo.geometry;
  for (let i = 0; i < 6; i++) { assert.equal(effect.touch(), true); effect.update(.25, false); }
  assert.equal(messages.at(-1).count, 6);
  assert.ok(halo.material.uniforms.progress.value > .3);
  assert.ok(halo.material.uniforms.progress.value < .51);
  assert.equal(effect.touch(), true);
  assert.equal(effect.touch(), false);
  effect.update(.25, false);
  for (let i = 0; i < 5; i++) { effect.touch(); effect.update(.25, false); }
  assert.equal(messages.at(-1).phase, 'blooming');
  assert.equal(effect.touch(), false);
  for (let i = 0; i < 30; i++) effect.update(.25, false);
  assert.equal(messages.at(-1).count, 0);
  assert.equal(halo.visible, false);
  effect.addEnergy(.5); effect.update(.25, true);
  assert.equal(halo.geometry, geometry);
  assert.ok(halo.material.uniforms.strength.value <= .35);
  effect.reset(); assert.equal(halo.visible, false);
  effect.dispose(); assert.equal(tree.root.getObjectByName('gratitude-light'), undefined);
});
