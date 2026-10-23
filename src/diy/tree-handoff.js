import * as THREE from 'three';

export const HANDOFF_DURATION = 3.2;
const ease = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

// Concurrent rotating entrance and exit, on opposite sides of the stage.
// The departing tree returns through an off-screen rear route.
export function createTreeHandoff(camera, far, outgoingAngle) {
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); right.y = 0; right.normalize();
  const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
  const origin = new THREE.Vector3(camera.position.x, 0, camera.position.z);
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const frontDepth = -origin.dot(forward);
  const farDepth = far.clone().sub(origin).dot(forward);
  const side = far.clone().sub(origin).dot(right) >= 0 ? 1 : -1;
  const point = (depth, screenX) => origin.clone().addScaledVector(forward, depth).addScaledVector(right, depth * tangent * camera.aspect * screenX);
  const parkDepth = Math.max(frontDepth * 2.1, 22);
  const park = point(parkDepth, -side * 1.65);
  const rearDepth = Math.max(camera.far + 12, farDepth + 24);
  const leftRear = point(rearDepth, -side * 1.65), rightRear = point(rearDepth, side * 1.65);
  const rightGate = point(farDepth, side * 1.65);
  const incomingAngle = Math.atan2(camera.position.x - far.x, camera.position.z - far.z);
  const frontAngle = Math.atan2(camera.position.x, camera.position.z);
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  return {
    sample(time, reducedMotion = false) {
      const t = reducedMotion ? 1 : THREE.MathUtils.clamp(time / HANDOFF_DURATION, 0, 1);
      const enter = ease(t);
      // Harmonic depth interpolation gives an even change in apparent size.
      const depth = 1 / THREE.MathUtils.lerp(1 / farDepth, 1 / frontDepth, enter);
      incoming.copy(far).multiplyScalar((depth - frontDepth) / (farDepth - frontDepth));
      if (t < .40) {
        const leave = ease(t / .40);
        const depth = 1 / THREE.MathUtils.lerp(1 / frontDepth, 1 / parkDepth, leave);
        outgoing.copy(point(depth, -side * 1.65 * leave));
      } else if (t < .52) outgoing.lerpVectors(park, leftRear, ease((t - .40) / .12));
      else if (t < .70) outgoing.lerpVectors(leftRear, rightRear, ease((t - .52) / .18));
      else if (t < .85) outgoing.lerpVectors(rightRear, rightGate, ease((t - .70) / .15));
      else outgoing.lerpVectors(rightGate, far, ease((t - .85) / .15));
      return { incoming, outgoing, enter, done: t === 1,
        incomingAngle: incomingAngle + wrapped(frontAngle - incomingAngle) * enter + (reducedMotion ? 0 : Math.PI * 2 * enter),
        outgoingAngle: outgoingAngle + (reducedMotion ? 0 : Math.PI * 2 * ease(t / .85)) + wrapped(incomingAngle - outgoingAngle) * ease(t),
      };
    },
  };
}
