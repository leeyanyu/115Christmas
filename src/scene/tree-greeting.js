import * as THREE from 'three';

// Keep the mobile greeting above the projected star, with real screen-space
// clearance. Reuse vectors; resize observers only invalidate layout metrics.
export function createTreeGreeting({ canvas, camera, tree, element }) {
  const star = tree.animated.at(-1);
  star.geometry.computeBoundingBox();
  const box = star.geometry.boundingBox;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const point = new THREE.Vector3();
  let dirty = true, rect, height, minimumTop, lastTop, lastOpacity;
  const observer = new ResizeObserver(() => { dirty = true; });
  observer.observe(element); observer.observe(canvas);
  return {
    update() {
      if (innerWidth > 700 || innerHeight <= 520) return;
      if (dirty) {
        rect = canvas.getBoundingClientRect(); height = element.offsetHeight;
        minimumTop = (document.querySelector('.masthead')?.getBoundingClientRect().bottom || 75) + 16;
        dirty = false;
      }
      star.updateWorldMatrix(true, false); camera.updateMatrixWorld();
      let starTop = Infinity;
      for (const corner of corners) {
        point.copy(corner).applyMatrix4(star.matrixWorld).project(camera);
        starTop = Math.min(starTop, rect.top + (1 - point.y) * rect.height / 2);
      }
      const top = Math.max(minimumTop, starTop - height - 20).toFixed(1);
      // At close zoom, let the tree take priority instead of covering its star.
      const opacity = starTop - minimumTop >= height + 12 ? '1' : '0';
      if (top !== lastTop) { element.style.setProperty('--greeting-top', `${top}px`); lastTop = top; }
      if (opacity !== lastOpacity) { element.style.setProperty('--greeting-opacity', opacity); lastOpacity = opacity; }
    },
    dispose() { observer.disconnect(); element.style.removeProperty('--greeting-top'); element.style.removeProperty('--greeting-opacity'); },
  };
}
