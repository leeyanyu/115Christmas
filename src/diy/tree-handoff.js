import * as THREE from 'three';

export const HANDOFF_DURATION = 4.2;
export const HANDOFF_RADIUS = 4.8;
// Short, smooth acceleration/deceleration with a steady middle section.
const ease = t => {
  const ramp = .16;
  if (t > 1 - ramp) return 1 - ease(1 - t);
  if (t >= ramp) return (t - ramp / 2) / (1 - ramp);
  const u = t / ramp;
  return ramp * (u ** 3 - .5 * u ** 4) / (1 - ramp);
};
// A compact C2 positive part keeps viewport corrections free of hard clamps.
const positive = (x, width = .3) => {
  if (x <= -width) return 0;
  if (x >= width) return x;
  const u = (x + width) / (2 * width);
  return 2 * width * (u ** 3 - .5 * u ** 4);
};
const maximum = (a, b) => b + positive(a - b);
const minimum = (a, b) => a - positive(a - b);
const smoothstep = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

// Both trees occupy opposite ends of one elliptical turntable. They rotate
// together through half a turn: neither tree exits the frame or teleports
// across the back. Shift the whole stage only as much as the viewport needs,
// keeping the pair visible without shrinking both trees into the distance.
export function createTreeHandoff(camera, far) {
  camera.updateMatrixWorld();
  const center = far.clone().multiplyScalar(.5), longAxis = center.clone();
  const shortAxis = new THREE.Vector3(-far.z, 0, far.x).normalize().multiplyScalar(HANDOFF_RADIUS);
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  if (shortAxis.dot(cameraRight) < 0) shortAxis.negate();
  const view = camera.getWorldDirection(new THREE.Vector3()), forward = view.clone(); forward.y = 0; forward.normalize();
  const horizontalLimit = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .98;
  const cameraX = camera.position.dot(cameraRight), cameraDepth = camera.position.dot(view);
  const depthFactor = forward.dot(view), pedestalRadius = 1.85;
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3(), radius = new THREE.Vector3(), shift = new THREE.Vector3();
  const positions = [incoming, outgoing];
  function at(phase) {
    const angle = Math.PI * phase;
    radius.copy(longAxis).multiplyScalar(Math.cos(angle)).addScaledVector(shortAxis, -Math.sin(angle));
    incoming.copy(center).add(radius); outgoing.copy(center).sub(radius);
    let lower, upper;
    for (const position of positions) {
      const x = position.dot(cameraRight) - cameraX;
      const depth = position.dot(view) - cameraDepth;
      const low = -horizontalLimit * (depth - pedestalRadius) + pedestalRadius - x;
      const high = horizontalLimit * (depth - pedestalRadius) - pedestalRadius - x;
      lower = lower === undefined ? low : maximum(lower, low);
      upper = upper === undefined ? high : minimum(upper, high);
    }
    const retreat = positive(lower - upper) / (2 * horizontalLimit * depthFactor);
    lower -= retreat * horizontalLimit * depthFactor; upper += retreat * horizontalLimit * depthFactor;
    const preferredX = -center.dot(cameraRight) * .85 * Math.sin(angle) ** 2;
    const offsetX = lower + positive(preferredX - lower) - positive(preferredX - upper);
    const gate = smoothstep(phase / .10) * smoothstep((1 - phase) / .10);
    shift.copy(forward).multiplyScalar(retreat * gate).addScaledVector(cameraRight, offsetX * gate);
    incoming.add(shift); outgoing.add(shift);
    if (phase === 0) { incoming.copy(far); outgoing.set(0, 0, 0); }
    if (phase === 1) { incoming.set(0, 0, 0); outgoing.copy(far); }
  }

  // Bake screen-space arc length once. A foreground tree no longer races
  // through the lens while the distant tree appears to stall mid-exchange.
  const steps = 512, lengths = new Float64Array(steps + 1), slopes = new Float64Array(steps + 1);
  const previous = new Float64Array(8), current = new Float64Array(8), point = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    at(i / steps);
    let index = 0;
    for (const position of positions) for (const y of [0, 4.4]) {
      point.copy(position); point.y += y; point.project(camera);
      current[index++] = point.x * camera.aspect; current[index++] = point.y;
    }
    if (i) {
      let distance = 0;
      for (let j = 0; j < current.length; j++) distance += (current[j] - previous[j]) ** 2;
      lengths[i] = lengths[i - 1] + Math.sqrt(distance);
    }
    previous.set(current);
  }
  for (let i = 0; i <= steps; i++) {
    if (i === 0) slopes[i] = 1 / (steps * (lengths[1] - lengths[0]));
    else if (i === steps) slopes[i] = 1 / (steps * (lengths[i] - lengths[i - 1]));
    else {
      const before = lengths[i] - lengths[i - 1], after = lengths[i + 1] - lengths[i];
      const w1 = 2 * after + before, w2 = after + 2 * before;
      slopes[i] = (w1 + w2) / (steps * (w1 * before + w2 * after));
    }
  }
  return {
    sample(time, reducedMotion = false) {
      const t = reducedMotion ? 1 : THREE.MathUtils.clamp(time / HANDOFF_DURATION, 0, 1);
      const distance = ease(t) * lengths[steps];
      let low = 0, high = steps;
      while (high - low > 1) { const mid = (low + high) >> 1; if (lengths[mid] < distance) low = mid; else high = mid; }
      const span = lengths[high] - lengths[low], u = (distance - lengths[low]) / (span || 1);
      // Monotone Hermite interpolation also joins the speed between samples.
      const phase = (2 * u ** 3 - 3 * u ** 2 + 1) * low / steps + (u ** 3 - 2 * u ** 2 + u) * span * slopes[low]
        + (-2 * u ** 3 + 3 * u ** 2) * high / steps + (u ** 3 - u ** 2) * span * slopes[high];
      const enter = t === 1 ? 1 : phase;
      at(enter);
      return { incoming, outgoing, enter, turn: ease(t), angle: Math.PI * enter, done: t === 1 };
    },
  };
}
