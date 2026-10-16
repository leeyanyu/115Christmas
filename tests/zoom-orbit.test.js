import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createZoomOrbit } from '../src/scene/zoom-orbit.js';

class PointerEventLike extends Event {
  constructor(type, values) { super(type); Object.assign(this, values); }
}

test('wheel and pinch add a bounded orbit while preserving camera distance', () => {
  const oldWindow = globalThis.window;
  const windowTarget = new EventTarget(); globalThis.window = windowTarget;
  const canvas = new EventTarget();
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 10);
  const controls = { enabled: true, enableZoom: true, target: new THREE.Vector3(0, 2, 0) };
  const effect = createZoomOrbit({ canvas, camera, controls });
  const distance = camera.position.distanceTo(controls.target);

  canvas.dispatchEvent(new PointerEventLike('wheel', { deltaY: -200 }));
  effect.update(.1, false, true);
  assert.ok(Math.abs(camera.position.x) > 0);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - distance) < 1e-10);

  canvas.dispatchEvent(new PointerEventLike('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 }));
  canvas.dispatchEvent(new PointerEventLike('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 100 }));
  windowTarget.dispatchEvent(new PointerEventLike('pointermove', { pointerId: 1, clientX: 80, clientY: 80 }));
  effect.update(.1, false, true);
  const afterPinch = camera.position.x;
  assert.notEqual(afterPinch, 0);

  effect.update(.1, true, true);
  const reduced = camera.position.clone(); effect.update(.1, true, true);
  assert.deepEqual(camera.position.toArray(), reduced.toArray());
  effect.dispose(); globalThis.window = oldWindow;
});
