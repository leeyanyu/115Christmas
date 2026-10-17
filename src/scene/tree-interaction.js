import * as THREE from 'three';
import { createPlayTriggers } from './play-triggers.js';
import { createPlayRewards } from './play-rewards.js';
import { createInteractionParticles } from './interaction-particles.js';

export function createTreeInteraction({ canvas, camera, controls, tree, scene, reducedMotion, isBlocked, onReward = () => {}, onTreeTouch = () => {}, visitorTargets = () => [], onVisitorTap = () => false }) {
  const constrained = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const particles = createInteractionParticles(scene, constrained ? 48 : 96);
  const rewards = createPlayRewards(scene, constrained ? 96 : 192);
  const star = tree.animated.at(-1);
  const starPoint = new THREE.Vector3();
  const triggers = createPlayTriggers(() => {
    star.updateWorldMatrix(true, false); star.getWorldPosition(starPoint);
    rewards.stars(starPoint, reducedMotion.matches, lowQuality);
    onReward('星光被你喚醒了！再試試連點樹頂星星三下 ✧');
  }, () => {
    rewards.snow(reducedMotion.matches, lowQuality);
    onReward('下雪了！願這場冬夜的驚喜，陪你度過聖誕 ✧');
  });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(), origin = new THREE.Vector3();
  const targets = [...tree.layers, ...tree.animated, tree.trunk, ...tree.bulbs];
  const hits = [];
  const starSphere = new THREE.Sphere(), starHit = new THREE.Vector3(), starScale = new THREE.Vector3();
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
    // A small spherical touch target also works when the thin star is edge-on.
    star.getWorldPosition(starSphere.center); star.getWorldScale(starScale);
    starSphere.radius = .34 * Math.max(starScale.x, starScale.y, starScale.z);
    if (starScale.x > .9 && raycaster.ray.intersectSphere(starSphere, starHit)) {
      return { point: starHit, object: star };
    }
    hits.length = 0;
    raycaster.intersectObjects(targets, true, hits);
    raycaster.intersectObjects(visitorTargets(), true, hits);
    hits.sort((a, b) => a.distance - b.distance);
    const first = hits[0];
    if (first) {
      let object = first.object;
      while (object && object !== tree.root && !object.userData.holidayCharacter) object = object.parent;
      first.visitor = object?.userData.holidayCharacter ? object : null;
    }
    return first;
  }
  function down(event) {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { gesture = null; triggers.cancelGesture(); return; }
    if (event.button !== 0 || blocked() || !event.isPrimary) return;
    const point = hit(event.clientX, event.clientY);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now(), dragged: false, lastX: event.clientX, lastTime: performance.now(), height: point?.point.y ?? 2, visitor: point?.visitor };
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.dragged = true;
    const now = performance.now();
    const dx = event.clientX - gesture.lastX;
    // Measure the deliberate drag before damping cancels fast direction changes.
    if (gesture.dragged && !blocked() && Math.abs(event.clientX - gesture.x) > Math.abs(event.clientY - gesture.y)) {
      const turn = dx / Math.max(300, canvas.getBoundingClientRect().height) * Math.PI * 2 * controls.rotateSpeed;
      triggers.spin(turn, Math.max(.016, (now - gesture.lastTime) / 1000));
    }
    gesture.lastX = event.clientX; gesture.lastTime = now;
  }
  function up(event) {
    pointers.delete(event.pointerId);
    if (!gesture || event.pointerId !== gesture.id) return;
    move(event);
    if (!gesture.dragged && performance.now() - gesture.start < 650 && !blocked()) {
      const point = hit(event.clientX, event.clientY);
      if (point?.visitor) {
        if (point.visitor === gesture.visitor) onVisitorTap(point.visitor);
      } else if (point && !gesture.visitor) {
        particles.burst(point.point, reducedMotion.matches, lowQuality);
        onTreeTouch();
        if (point.object === star) triggers.tapStar();
      }
    }
    gesture = null; emission = 0;
  }
  function cancel() { gesture = null; pointers.clear(); emission = 0; triggers.cancelGesture(); }
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', cancel);
  const motionChanged = () => { cancel(); particles.reset(); triggers.reset(); rewards.reset(); };
  reducedMotion.addEventListener('change', motionChanged);
  return {
    snowfall() { rewards.snow(reducedMotion.matches, lowQuality); },
    celebrate() {
      star.updateWorldMatrix(true, false); star.getWorldPosition(starPoint);
      rewards.stars(starPoint, reducedMotion.matches, lowQuality);
      rewards.snow(reducedMotion.matches, lowQuality);
    },
    update(delta, pixelRatio) {
      if (blocked()) cancel();
      const angle = tree.root.rotation.y - controls.getAzimuthalAngle();
      const change = Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
      previousAngle = angle;
      triggers.update(delta);
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
      rewards.update(delta, pixelRatio, camera.position.distanceTo(controls.target));
    },
    reset() { cancel(); previousAngle = tree.root.rotation.y - controls.getAzimuthalAngle(); particles.reset(); triggers.reset(); rewards.reset(); },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      reducedMotion.removeEventListener('change', motionChanged);
      rewards.dispose();
      particles.dispose();
    },
  };
}
