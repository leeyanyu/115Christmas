import * as THREE from 'three';

const DURATION = 5.2;
const APPROACH_END = .65;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

// Moves the existing tree canvas onto center stage, then hands the camera back
// to OrbitControls. The tree, its lights and pedestal rotate as one object.
export function createStage(canvas, camera, controls, tree, onStart, onComplete) {
  const container = canvas.parentElement;
  let state = 'idle';
  let startedAt = 0;
  let origin;
  let startPosition;
  let startTarget;
  let initialRotation;
  const finalTarget = new THREE.Vector3(0, 2.05, 0);
  const direction = new THREE.Vector3();

  function fittedDistance(aspect) {
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Leave room for the header, greeting and replay button in every orientation.
    return Math.max(2.3 / (tangent * .68), 1.95 / (tangent * aspect * .85));
  }

  return {
    get isMoving() { return state === 'moving'; },
    get isSettled() { return state === 'settled'; },
    start(time) {
      state = 'moving';
      startedAt = time;
      origin = container.getBoundingClientRect();
      startPosition = camera.position.clone();
      startTarget = controls.target.clone();
      initialRotation = tree.root.rotation.y;
      controls.enabled = false;
      controls.enableDamping = false;
      Object.assign(container.style, {
        position: 'fixed', right: 'auto', bottom: 'auto',
        left: `${origin.left}px`, top: `${origin.top}px`,
        width: `${origin.width}px`, height: `${origin.height}px`,
      });
      onStart();
    },
    update(time, reducedMotion) {
      if (state !== 'moving') return;
      const progress = Math.min((time - startedAt) / (reducedMotion ? .7 : DURATION), 1);
      // Finish the turn at the close-up, then let the camera breathe back out.
      // Reduced motion keeps the short, direct transition without overshoot.
      const approach = reducedMotion ? progress : Math.min(progress / APPROACH_END, 1);
      const t = ease(approach);
      const retreat = reducedMotion ? 1 : ease(THREE.MathUtils.clamp(
        (progress - APPROACH_END) / (1 - APPROACH_END), 0, 1));
      const width = THREE.MathUtils.lerp(origin.width, innerWidth, t);
      const height = THREE.MathUtils.lerp(origin.height, innerHeight, t);
      Object.assign(container.style, {
        left: `${origin.left * (1 - t)}px`, top: `${origin.top * (1 - t)}px`,
        width: `${width}px`, height: `${height}px`,
      });
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const distance = fittedDistance(innerWidth / innerHeight);
      // A restrained portrait close-up keeps the tree within narrow phone framing.
      const closeUpRatio = innerWidth < innerHeight ? .82 : .74;
      const dolly = reducedMotion ? 1 : THREE.MathUtils.lerp(closeUpRatio, 1, retreat);
      const endPosition = finalTarget.clone().add(new THREE.Vector3(0, .10, 1).normalize().multiplyScalar(distance * dolly));
      camera.position.lerpVectors(startPosition, endPosition, t);
      controls.target.lerpVectors(startTarget, finalTarget, t);
      tree.root.rotation.y = initialRotation + (reducedMotion ? 0 : Math.PI * 2 * t);
      controls.update();
      if (progress === 1) {
        state = 'settled';
        container.style.width = '100vw';
        container.style.height = '100svh';
        controls.enabled = true;
        controls.enableDamping = true;
        onComplete();
      }
    },
    resize() {
      if (state !== 'settled') return;
      direction.copy(camera.position).sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(direction, fittedDistance(camera.aspect));
      controls.update();
    },
    reset() {
      state = 'idle';
      container.removeAttribute('style');
      tree.root.rotation.y = 0;
      controls.enableDamping = false;
      camera.position.set(6, 3.4, 8);
      controls.target.set(0, 2, 0);
      controls.update();
      controls.enableDamping = true;
      controls.enabled = true;
    },
  };
}
