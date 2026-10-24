import * as THREE from 'three';

export const HANDOFF_DURATION = 3.2;
export const DISTANT_DEPTH = 1.9;
export const DISTANT_SCALE = .45;

// Accelerate once, travel steadily, then ease to a stop. No path remapping or
// per-frame camera-fit corrections can reverse either tree's depth motion.
const ease = t => {
  const ramp = .15;
  if (t > 1 - ramp) return 1 - ease(1 - t);
  if (t >= ramp) return (t - ramp / 2) / (1 - ramp);
  const u = t / ramp;
  return ramp * (u ** 3 - .5 * u ** 4) / (1 - ramp);
};

export function createTreeHandoff(camera, far, farScale = DISTANT_SCALE) {
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  right.y = 0; right.normalize();
  const center = far.clone().multiplyScalar(.5), longAxis = center.clone();
  const across = longAxis.dot(right), perpendicular = longAxis.lengthSq() - across * across;
  const clearance = 1.85 * (1 + farScale) / 2 + .1;
  // The two differently sized pedestals retain clearance even on a wide stage.
  const minimumRadius = clearance * Math.sqrt(Math.max(1, (longAxis.lengthSq() - clearance ** 2) / Math.max(.1, perpendicular - clearance ** 2)));
  const viewDepth = center.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
  const halfWidth = viewDepth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const radius = Math.max(1.5, minimumRadius, Math.min(2.6, halfWidth * .42));
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const offset = new THREE.Vector3(), radial = new THREE.Vector3();
  return {
    sample(time, reducedMotion = false) {
      const t = reducedMotion ? 1 : THREE.MathUtils.clamp(time / HANDOFF_DURATION, 0, 1);
      const angle = Math.PI * ease(t), sine = Math.sin(angle), enter = (1 - Math.cos(angle)) / 2;
      radial.copy(longAxis).multiplyScalar(Math.cos(angle)).addScaledVector(right, -radius * sine);
      // Only the horizontal center bows inward. No extra retreat, vertical
      // lift or late correction is added to either floor anchor.
      offset.copy(center).addScaledVector(right, -across * sine * sine * 2 * (1 - enter));
      incoming.copy(offset).add(radial); outgoing.copy(offset).sub(radial);
      if (t === 0) { incoming.copy(far); outgoing.set(0, 0, 0); }
      if (t === 1) { incoming.set(0, 0, 0); outgoing.copy(far); }
      return { incoming, outgoing, enter, angle, radius, done: t === 1,
        incomingScale: THREE.MathUtils.lerp(farScale, 1, enter),
        outgoingScale: THREE.MathUtils.lerp(1, farScale, enter) };
    },
  };
}
