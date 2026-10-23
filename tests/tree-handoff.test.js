import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTreeHandoff, HANDOFF_DURATION } from '../src/diy/tree-handoff.js';

// A turning stage naturally occludes its rear tree. Verify physical clearance,
// continuous opposite arcs, and on-screen visibility rather than requiring the
// rear tree to take an invisible detour to avoid all projected occlusion.
for (const aspect of [1440 / 960, 390 / 720, 320 / 850, 667 / 320]) for (const yaw of [0, .7, 2.5]) {
  const distance = Math.max(10, 1.95 / (Math.tan(37 * Math.PI / 360) * aspect * .85));
  const camera = new THREE.PerspectiveCamera(37, aspect, .1, 100);
  camera.position.set(Math.sin(yaw) * distance, 3, Math.cos(yaw) * distance);
  camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const depth = Math.min(distance * 4.4, 90);
  const far = new THREE.Vector3(camera.position.x, 0, camera.position.z).addScaledVector(forward, depth)
    .addScaledVector(right, depth * Math.tan(37 * Math.PI / 360) * aspect * (aspect < 1 ? .56 : .64));
  const handoff = createTreeHandoff(camera, far);
  const start = handoff.sample(0);
  assert.ok(start.incoming.distanceTo(far) < 1e-8); assert.equal(start.outgoing.length(), 0);
  let previousIncoming = start.incoming.clone(), previousOutgoing = start.outgoing.clone(), previousAngle = 0;
  for (let frame = 0; frame <= 210; frame++) {
    const state = handoff.sample(frame * HANDOFF_DURATION / 210);
    assert.ok(state.incoming.distanceTo(state.outgoing) >= 5.59, `tree footprints need clearance: ${aspect}, frame ${frame}`);
    assert.ok(state.angle >= previousAngle && state.angle <= Math.PI, 'both trees share a single forward half-turn');
    assert.ok(state.incoming.distanceTo(previousIncoming) < 2 && state.outgoing.distanceTo(previousOutgoing) < 2, 'no off-screen jumps');
    const separation = state.incoming.clone().sub(state.outgoing);
    const longAxis = far.clone().normalize();
    const along = separation.dot(longAxis) / far.length();
    const across = separation.clone().addScaledVector(longAxis, -separation.dot(longAxis)).length() / 5.6;
    assert.ok(Math.abs(along * along + across * across - 1) < 1e-8, 'the trees stay opposite on the same ellipse');
    for (const position of [state.incoming, state.outgoing]) {
      const viewDepth = position.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
      assert.ok(viewDepth > 1 && viewDepth < camera.far - 1, 'neither tree is sent behind the camera or its far clip');
      for (let i = 0; i < 20; i++) {
        const edge = new THREE.Vector3(Math.cos(i * Math.PI / 10) * 1.85, 0, Math.sin(i * Math.PI / 10) * 1.85).add(position).project(camera);
        assert.ok(Math.abs(edge.x) <= 1.02, `whole pedestals stay in the viewport: ${aspect}, frame ${frame}`);
      }
    }
    previousIncoming.copy(state.incoming); previousOutgoing.copy(state.outgoing); previousAngle = state.angle;
  }
  const end = handoff.sample(HANDOFF_DURATION);
  assert.equal(end.incoming.length(), 0); assert.ok(end.outgoing.distanceTo(far) < 1e-8); assert.ok(end.done);
  const reduced = handoff.sample(.01, true);
  assert.ok(reduced.done); assert.equal(reduced.incoming.length(), 0); assert.ok(reduced.outgoing.distanceTo(far) < 1e-8);
}
console.log('Opposite stage arcs keep full tree clearance, stay in view, finish exactly, and respect reduced motion.');
