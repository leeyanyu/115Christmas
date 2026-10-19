import * as THREE from 'three';

// One reusable speech bubble follows the actor's real 3D position. It neither
// intercepts tree gestures nor adds textures/materials to the scene.
export function createVisitorGreeting({ canvas, visitors, element }) {
  const point = new THREE.Vector3();
  const header = canvas.ownerDocument.querySelector('.masthead');
  const observer = new ResizeObserver(() => { dirty = true; });
  let dirty = true, width = 0, height = 0;
  observer.observe(element);
  function hide() { element.hidden = true; }
  return {
    update(camera, ready) {
      const actor = visitors.greeting;
      if (!ready || !actor) { hide(); return; }
      camera.updateMatrixWorld(); actor.updateWorldMatrix(true, false);
      point.set(0, .63, .08).applyMatrix4(actor.matrixWorld).project(camera);
      if (Math.abs(point.z) >= 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) { hide(); return; }
      element.hidden = false;
      if (dirty || !width) { width = element.offsetWidth; height = element.offsetHeight; dirty = false; }
      const rect = canvas.getBoundingClientRect();
      const x = rect.left + (point.x + 1) * rect.width / 2;
      const y = rect.top + (1 - point.y) * rect.height / 2;
      const top = Math.max(rect.top + height + 10, (header?.getBoundingClientRect().bottom ?? 0) + height + 10);
      element.style.left = `${THREE.MathUtils.clamp(x, width / 2 + 12, innerWidth - width / 2 - 12).toFixed(1)}px`;
      element.style.top = `${THREE.MathUtils.clamp(y, top, rect.bottom - 95).toFixed(1)}px`;
      element.style.opacity = actor.userData.greetingOpacity.toFixed(3);
    },
    reset: hide,
    dispose() { observer.disconnect(); hide(); element.removeAttribute('style'); },
  };
}
