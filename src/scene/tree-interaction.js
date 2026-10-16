import * as THREE from 'three';
import { createInteractionParticles } from './interaction-particles.js';

export function createTreeInteraction({ canvas, camera, controls, tree, scene, reducedMotion, isBlocked }) {
  const constrained = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const particles = createInteractionParticles(scene, constrained ? 48 : 96);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(), origin = new THREE.Vector3();
  const targets = [...tree.layers, ...tree.animated, tree.trunk, ...tree.bulbs];
  const hits = [];
  const pointers = new Set();
  let gesture = null, previousAngle = tree.root.rotation.y - controls.getAzimuthalAngle(), emission = 0;
  let slowFrames = 0, lowQuality = constrained;
  const blocked = () => !controls.enabled || isBlocked() || document.hidden;
  function hit(x, y) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    pointer.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(targets, true, hits);
    return hits[0]?.point;
  }
  function down(event) {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { gesture = null; return; }
    if (event.button !== 0 || blocked() || !event.isPrimary) return;
    const point = hit(event.clientX, event.clientY);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now(), dragged: false, height: point?.y ?? 2 };
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.dragged = true;
  }
  function up(event) {
    pointers.delete(event.pointerId);
    if (!gesture || event.pointerId !== gesture.id) return;
    move(event);
    if (!gesture.dragged && performance.now() - gesture.start < 650 && !blocked()) {
      const point = hit(event.clientX, event.clientY);
      if (point) particles.burst(point, reducedMotion.matches, lowQuality);
    }
    gesture = null; emission = 0;
  }
  function cancel() { gesture = null; pointers.clear(); emission = 0; }
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', cancel);
  const motionChanged = () => { cancel(); particles.reset(); };
  reducedMotion.addEventListener('change', motionChanged);
  return {
    update(delta, pixelRatio) {
      if (blocked()) cancel();
      const angle = tree.root.rotation.y - controls.getAzimuthalAngle();
      const change = Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
      previousAngle = angle;
      // Sustained slow rendering reduces emission; a single resize stall does not.
      slowFrames = delta > .04 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 30) lowQuality = true;
      if (!blocked() && !reducedMotion.matches && delta > 0) {
        const speed = Math.min(Math.abs(change) / delta, 4);
        if (speed > .015) {
          emission = Math.min(emission + Math.min(delta, .05) * Math.min(lowQuality ? 10 : 22, speed * 16), 2);
          while (emission >= 1) {
            const y = THREE.MathUtils.clamp((gesture?.height ?? 2) + (Math.random() - .5) * .35, .75, 3.65);
            const radius = 1.75 * (1 - (y - .5) / 4.5);
            const front = controls.getAzimuthalAngle();
            origin.set(Math.sin(front) * radius, y, Math.cos(front) * radius);
            particles.trail(origin, Math.sign(change) * Math.min(speed, 1.4));
            emission--;
          }
        }
      } else emission = 0;
      particles.update(delta, pixelRatio);
    },
    reset() { cancel(); previousAngle = tree.root.rotation.y - controls.getAzimuthalAngle(); particles.reset(); },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      reducedMotion.removeEventListener('change', motionChanged);
      particles.dispose();
    },
  };
}
