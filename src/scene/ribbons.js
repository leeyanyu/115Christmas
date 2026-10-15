import * as THREE from 'three';

// Camera-space curves start close to the viewer, then recede into the tree.
export function createRibbons(scene, camera, target) {
  const ribbons = [];
  const colors = [0xffd68b, 0x9fdfcf, 0xffb4ac, 0xece2b5];
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const point = new THREE.Vector3();
  for (let i = 0; i < 16; i++) {
    const positions = new Float32Array(42 * 6);
    const indices = [];
    for (let j = 0; j < 41; j++) {
      const n = j * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colors[i % 4], side: THREE.DoubleSide, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.frustumCulled = false;
    scene.add(mesh);
    ribbons.push({ mesh, positions, curve: null });
  }
  return {
    reset() {
      camera.getWorldDirection(forward);
      right.crossVectors(forward, camera.up).normalize();
      up.crossVectors(right, forward).normalize();
      ribbons.forEach((ribbon, i) => {
        const angle = i / ribbons.length * Math.PI * 2;
        const start = camera.position.clone().addScaledVector(forward, 1.3)
          .addScaledVector(right, Math.cos(angle) * 2.8).addScaledVector(up, Math.sin(angle) * 2.6);
        const end = target.clone().add(new THREE.Vector3(Math.sin(i) * .25, (i % 4) * .2 - 1, Math.cos(i) * .25));
        const bend = start.clone().lerp(end, .45).addScaledVector(right, Math.sin(angle + 1) * 1.5).addScaledVector(up, .9);
        ribbon.curve = new THREE.QuadraticBezierCurve3(start, bend, end);
      });
    },
    update(elapsed, reduced) {
      ribbons.forEach(({ mesh, positions, curve }, i) => {
        const progress = (elapsed - i * .045) / 2.3;
        mesh.visible = progress > 0 && progress < 1.35 && !reduced;
        if (!mesh.visible || !curve) return;
        mesh.material.opacity = Math.min(progress * 5, 1, Math.max(0, (1.35 - progress) * 3)) * .85;
        for (let j = 0; j < 42; j++) {
          const t = THREE.MathUtils.clamp(progress - .3 + j / 41 * .3, 0, 1);
          curve.getPoint(t, point);
          const width = Math.sin(j / 41 * Math.PI) * .035 * (1 - t * .7);
          const twist = t * 13 + i;
          for (let side = 0; side < 2; side++) {
            const offset = (side ? 1 : -1) * width;
            const index = (j * 2 + side) * 3;
            positions[index] = point.x + right.x * offset * Math.cos(twist) + up.x * offset * Math.sin(twist);
            positions[index + 1] = point.y + right.y * offset * Math.cos(twist) + up.y * offset * Math.sin(twist);
            positions[index + 2] = point.z + right.z * offset * Math.cos(twist) + up.z * offset * Math.sin(twist);
          }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });
    },
  };
}
