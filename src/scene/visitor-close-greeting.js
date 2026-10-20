import * as THREE from 'three';

const radius = 2.35;

// Reusable ground route: a straight segment when clear, otherwise two tangents
// and a short arc around the foliage. Height changes only as a hop advances.
function createRoute() {
  const start = new THREE.Vector3(), end = new THREE.Vector3();
  const arcStart = new THREE.Vector3(), arcEnd = new THREE.Vector3();
  let direct = true, angle = 0, turn = 0, first = 0, arc = 0, length = 0;
  return {
    plan(a, b, direction) {
      start.copy(a); end.copy(b);
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(-(a.x * dx + a.z * dz) / Math.max(.000001, dx * dx + dz * dz), 0, 1);
      direct = Math.hypot(a.x + t * dx, a.z + t * dz) >= radius;
      if (direct) return;
      angle = Math.atan2(a.x, a.z) + direction * Math.acos(Math.min(1, radius / Math.hypot(a.x, a.z)));
      const endAngle = Math.atan2(b.x, b.z) - direction * Math.acos(Math.min(1, radius / Math.hypot(b.x, b.z)));
      turn = direction * THREE.MathUtils.euclideanModulo(direction * (endAngle - angle), Math.PI * 2);
      arcStart.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      arcEnd.set(Math.sin(endAngle) * radius, 0, Math.cos(endAngle) * radius);
      first = Math.hypot(a.x - arcStart.x, a.z - arcStart.z);
      arc = Math.abs(turn) * radius;
      length = first + arc + Math.hypot(b.x - arcEnd.x, b.z - arcEnd.z);
    },
    sample(progress, point) {
      if (direct) point.lerpVectors(start, end, progress);
      else {
        const distance = progress * length;
        if (distance < first) point.lerpVectors(start, arcStart, distance / first);
        else if (distance < first + arc) {
          const current = angle + turn * (distance - first) / arc;
          point.set(Math.sin(current) * radius, 0, Math.cos(current) * radius);
        } else {
          const last = length - first - arc;
          point.lerpVectors(arcEnd, end, last > .000001 ? (distance - first - arc) / last : 1);
        }
        point.y = THREE.MathUtils.lerp(start.y, end.y, progress);
      }
    },
  };
}

// A real move toward the lens supplies the apparent size. Camera, tree scale,
// geometry and materials stay unchanged, and every visit reuses these routes.
export function createVisitorCloseGreeting(tree) {
  const mark = new THREE.Vector3(), top = new THREE.Vector3(), bottom = new THREE.Vector3();
  const approach = createRoute(), retreat = createRoute();
  return {
    mark,
    plan(camera, start, exit, side, size) {
      camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, false);
      top.set(0, 4.33, 0); tree.root.localToWorld(top); top.project(camera);
      bottom.set(0, -.04, 0); tree.root.localToWorld(bottom); bottom.project(camera);
      const height = THREE.MathUtils.clamp(Math.abs(top.y - bottom.y) * .54, .42, .82);
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const depth = .9 * size / (tangent * height);
      // Keep the face below the star and leave space above for Merry Xmas.
      mark.set(side * .12 * depth * tangent * camera.aspect, -.14 * depth * tangent, -depth);
      mark.applyMatrix4(camera.matrixWorld); tree.root.worldToLocal(mark);
      if (Math.hypot(mark.x, mark.z) < radius + .3) return false;
      approach.plan(start, mark, -side);
      retreat.plan(mark, exit, -side);
      return true;
    },
    approach(progress, point) { approach.sample(progress, point); },
    retreat(progress, point) { retreat.sample(progress, point); },
  };
}
