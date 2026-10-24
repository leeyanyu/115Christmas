import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTreeHandoff, HANDOFF_DURATION, DISTANT_DEPTH, DISTANT_SCALE } from '../src/diy/tree-handoff.js';

// A grounded carousel must advance in depth and apparent size without a
// mid-turn retreat/lift. Check each tree independently, rather than allowing
// one tree's speed to mask the other tree stopping or reversing.
for (const aspect of [1440 / 960, 390 / 844, 320 / 850, 667 / 320]) for (const yaw of [0, .7, 2.5]) {
  const tangent = Math.tan(37 * Math.PI / 360);
  const distance = Math.max(2.3 / (tangent * .68), 1.95 / (tangent * aspect * .85));
  const camera = new THREE.PerspectiveCamera(37, aspect, .1, 100);
  camera.position.set(Math.sin(yaw) * distance, 2.05 + distance * .1, Math.cos(yaw) * distance);
  camera.lookAt(0, 2.05, 0); camera.updateMatrixWorld();
  const view = camera.getWorldDirection(new THREE.Vector3());
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const depth = distance * DISTANT_DEPTH;
  const far = new THREE.Vector3(camera.position.x, 0, camera.position.z).addScaledVector(forward, depth)
    .addScaledVector(right, depth * tangent * aspect * (aspect < 1 ? .56 : .64));
  const handoff = createTreeHandoff(camera, far);
  const previous = [null, null];
  const endpoints = [far.clone().project(camera).y, new THREE.Vector3().project(camera).y];
  for (let frame = 0; frame <= 240; frame++) {
    const state = handoff.sample(frame * HANDOFF_DURATION / 240);
    assert.ok(state.incoming.distanceTo(state.outgoing) > 1.85 * (state.incomingScale + state.outgoingScale) + .08, 'scaled pedestals never collide');
    let index = 0;
    for (const [position, scale] of [[state.incoming, state.incomingScale], [state.outgoing, state.outgoingScale]]) {
      assert.equal(position.y, 0, 'neither root leaves the shared ground');
      const base = position.clone().project(camera);
      const top = position.clone().add(new THREE.Vector3(0, 4.4 * scale, 0)).project(camera);
      const height = top.y - base.y;
      const viewDepth = position.clone().sub(camera.position).dot(view);
      assert.ok(viewDepth > 1 && viewDepth < camera.far - 1);
      assert.ok(base.y >= Math.min(...endpoints) - 1e-8 && base.y <= Math.max(...endpoints) + 1e-8, 'base never overshoots above/below its two destinations');
      if (previous[index]) {
        const old = previous[index];
        if (index === 0) {
          assert.ok(base.y <= old.y + 1e-8 && viewDepth <= old.depth + 1e-8, 'incoming tree never retreats or rises back up');
          assert.ok(height >= old.height - 1e-8, 'incoming tree never shrinks back midway');
        } else {
          assert.ok(base.y >= old.y - 1e-8 && viewDepth >= old.depth - 1e-8, 'departing tree never darts towards the lens');
          assert.ok(height <= old.height + 1e-8, 'departing tree never grows back midway');
        }
        if (frame > 24 && frame < 216) assert.ok(Math.hypot(base.x - old.x, base.y - old.y, height - old.height) > 1e-5, 'neither tree stalls in mid-turn');
      }
      previous[index++] = { x: base.x, y: base.y, height, depth: viewDepth };
      for (let i = 0; i < 24; i++) {
        const edge = new THREE.Vector3(Math.cos(i * Math.PI / 12) * 1.85 * scale, 0, Math.sin(i * Math.PI / 12) * 1.85 * scale).add(position).project(camera);
        assert.ok(Math.abs(edge.x) <= 1.02, `whole pedestals stay in view: ${aspect}, frame ${frame}`);
      }
    }
  }
  for (const fraction of [.15, .3, .5, .7, .85]) {
    const epsilon = .0001, time = fraction * HANDOFF_DURATION;
    const sample = t => { const state = handoff.sample(t); return [state.incoming.clone(), state.outgoing.clone()]; };
    const left = sample(time - epsilon), middle = sample(time), right = sample(time + epsilon);
    for (let i = 0; i < 2; i++) {
      const before = middle[i].clone().sub(left[i]).divideScalar(epsilon);
      const after = right[i].clone().sub(middle[i]).divideScalar(epsilon);
      assert.ok(before.distanceTo(after) < .03, 'path velocity joins smoothly through turns and easing boundaries');
    }
  }
  const start = handoff.sample(0);
  assert.ok(start.incoming.distanceTo(far) < 1e-8); assert.equal(start.outgoing.length(), 0);
  assert.equal(start.incomingScale, DISTANT_SCALE); assert.equal(start.outgoingScale, 1);
  for (const state of [handoff.sample(HANDOFF_DURATION), handoff.sample(.01, true)]) {
    assert.equal(state.incoming.length(), 0); assert.ok(state.outgoing.distanceTo(far) < 1e-8); assert.ok(state.done);
    assert.equal(state.incomingScale, 1); assert.equal(state.outgoingScale, DISTANT_SCALE);
  }
}
console.log('Grounded swaps have monotone floor anchors, depth and apparent size; no lift, reversal, stall, collision or velocity corner.');
