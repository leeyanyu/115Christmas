import * as THREE from 'three';

const clampTurn = value => THREE.MathUtils.clamp(value, -.18, .18);
const wrappedAngle = value => Math.atan2(Math.sin(value), Math.cos(value));

// Adds a small, damped orbit while zooming. OrbitControls still owns the
// distance limits and all direct rotation; this module only links the two
// gestures so a close-up feels like circling an object rather than scaling it.
export function createZoomOrbit({ canvas, camera, controls }) {
  const touches = new Map();
  const offset = new THREE.Vector3();
  let pending = 0;
  let previousDistance = 0;
  let previousAngle = 0;

  function pair() {
    if (touches.size !== 2) return null;
    const [a, b] = touches.values();
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  function beginPair() {
    const current = pair();
    previousDistance = current?.distance || 0;
    previousAngle = current?.angle || 0;
  }

  function pointerDown(event) {
    if (event.pointerType !== 'touch') return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginPair();
  }

  function pointerMove(event) {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = pair();
    if (!current || !previousDistance) { beginPair(); return; }
    const zoomTurn = Math.log(current.distance / previousDistance) * .24;
    const twistTurn = wrappedAngle(current.angle - previousAngle) * .42;
    pending = clampTurn(pending + THREE.MathUtils.clamp(zoomTurn + twistTurn, -.045, .045));
    previousDistance = current.distance;
    previousAngle = current.angle;
  }

  function pointerUp(event) {
    if (!touches.delete(event.pointerId)) return;
    beginPair();
  }

  function wheel(event) {
    if (!controls.enabled || !controls.enableZoom) return;
    pending = clampTurn(pending + THREE.MathUtils.clamp(event.deltaY * .00016, -.04, .04));
  }

  canvas.addEventListener('wheel', wheel, { passive: true });
  canvas.addEventListener('pointerdown', pointerDown, { passive: true });
  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerup', pointerUp, { passive: true });
  window.addEventListener('pointercancel', pointerUp, { passive: true });

  return {
    update(delta, reducedMotion, enabled) {
      if (reducedMotion || !enabled) { pending = 0; return; }
      if (Math.abs(pending) < .00001) { pending = 0; return; }
      const portion = 1 - Math.exp(-Math.min(delta, .05) * 9);
      const turn = pending * portion;
      pending -= turn;
      offset.copy(camera.position).sub(controls.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
    },
    reset() { pending = 0; touches.clear(); previousDistance = 0; previousAngle = 0; },
    dispose() {
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      touches.clear();
    },
  };
}
