const duration = 3.2;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

// Rotate the existing root, without moving the camera or allocating particles.
export function createTreeCelebration({ tree, canvas, controls, onStart, activityTarget = window, visibilityTarget = document }) {
  let active = false, elapsed = 0;
  const cancel = () => { active = false; elapsed = 0; };
  canvas.addEventListener('pointerdown', cancel);
  canvas.addEventListener('wheel', cancel, { passive: true });
  controls.addEventListener('start', cancel);
  activityTarget.addEventListener('blur', cancel);
  visibilityTarget.addEventListener('visibilitychange', cancel);
  return {
    get isActive() { return active; },
    start(reducedMotion) {
      elapsed = 0; active = !reducedMotion;
      onStart();
    },
    update(delta, ready, reducedMotion) {
      if (!ready || reducedMotion) { cancel(); return; }
      if (!active) return;
      const previous = elapsed / duration;
      elapsed = Math.min(duration, elapsed + delta);
      tree.root.rotation.y += (ease(elapsed / duration) - ease(previous)) * Math.PI * 2;
      if (elapsed >= duration) active = false;
    },
    reset: cancel,
    dispose() {
      cancel(); canvas.removeEventListener('pointerdown', cancel); canvas.removeEventListener('wheel', cancel);
      controls.removeEventListener('start', cancel);
      activityTarget.removeEventListener('blur', cancel);
      visibilityTarget.removeEventListener('visibilitychange', cancel);
    },
  };
}
