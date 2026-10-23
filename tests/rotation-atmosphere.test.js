import test from 'node:test';
import assert from 'node:assert/strict';
import { createRotationAtmosphere } from '../src/scene/rotation-atmosphere.js';

test('rotation and palm dim independently, and both original backgrounds restore on disposal', () => {
  const values = new Map([['--rotation-dim', '.2']]);
  const main = { style: { getPropertyValue: key => values.get(key) || '',
    setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) } };
  const effect = createRotationAtmosphere({ closest: () => main });
  effect.update(1, 0); assert.equal(values.get('--rotation-dim'), '0.850'); assert.equal(values.get('--palm-dim'), '0.000');
  effect.update(0, 1); assert.equal(values.get('--rotation-dim'), '0.000'); assert.equal(values.get('--palm-dim'), '0.950');
  effect.update(0, 0); assert.equal(values.get('--palm-dim'), '0.000');
  effect.dispose(); assert.equal(values.get('--rotation-dim'), '.2'); assert.equal(values.has('--palm-dim'), false);
});
