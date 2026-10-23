import * as THREE from 'three';

export const HANDOFF_DURATION = 3.6;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

// Both trees occupy opposite ends of one elliptical turntable. They rotate
// together through half a turn: neither tree exits the frame or teleports
// across the back. Shift the whole stage only as much as the viewport needs,
// keeping the pair visible without shrinking both trees into the distance.
export function createTreeHandoff(camera, far) {
  camera.updateMatrixWorld();
  const center = far.clone().multiplyScalar(.5), longAxis = center.clone();
  const shortAxis = new THREE.Vector3(-far.z, 0, far.x).normalize().multiplyScalar(2.8);
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  if (shortAxis.dot(cameraRight) < 0) shortAxis.negate();
  const view = camera.getWorldDirection(new THREE.Vector3()), forward = view.clone(); forward.y = 0; forward.normalize();
  const horizontalLimit = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .98;
  const cameraX = camera.position.dot(cameraRight), cameraDepth = camera.position.dot(view);
  const depthFactor = forward.dot(view), pedestalRadius = 1.85;
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3(), radius = new THREE.Vector3(), shift = new THREE.Vector3();
  return {
    sample(time, reducedMotion = false) {
      const t = reducedMotion ? 1 : THREE.MathUtils.clamp(time / HANDOFF_DURATION, 0, 1);
      const enter = ease(t), angle = Math.PI * enter;
      radius.copy(longAxis).multiplyScalar(Math.cos(angle)).addScaledVector(shortAxis, -Math.sin(angle));
      incoming.copy(center).add(radius); outgoing.copy(center).sub(radius);
      let lower = -Infinity, upper = Infinity;
      for (const position of [incoming, outgoing]) {
        const x = position.dot(cameraRight) - cameraX;
        const depth = position.dot(view) - cameraDepth;
        lower = Math.max(lower, -horizontalLimit * (depth - pedestalRadius) + pedestalRadius - x);
        upper = Math.min(upper, horizontalLimit * (depth - pedestalRadius) - pedestalRadius - x);
      }
      const retreat = Math.max(0, (lower - upper) / (2 * horizontalLimit * depthFactor));
      lower -= retreat * horizontalLimit * depthFactor; upper += retreat * horizontalLimit * depthFactor;
      const preferredX = -center.dot(cameraRight) * .85 * Math.sin(angle) ** 2;
      const offsetX = THREE.MathUtils.clamp(preferredX, lower, upper);
      const gate = Math.min(1, enter * 8, (1 - enter) * 8);
      shift.copy(forward).multiplyScalar(retreat * gate).addScaledVector(cameraRight, offsetX * gate);
      incoming.add(shift); outgoing.add(shift);
      if (t === 1) { incoming.set(0, 0, 0); outgoing.copy(far); }
      return { incoming, outgoing, enter, angle, done: t === 1 };
    },
  };
}
