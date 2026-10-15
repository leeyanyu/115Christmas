import * as THREE from 'three';

export const AWAKENING_DURATION = 6.5;

export function createAwakening(tree, onComplete) {
  const count = 64;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffd889, size: .055, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  tree.root.add(particles);
  let startedAt = null;
  let complete = false;
  return {
    start(time) { if (startedAt === null) startedAt = time; },
    update(time, reducedMotion) {
      if (startedAt === null) return;
      const elapsed = time - startedAt;
      const progress = Math.min(elapsed / AWAKENING_DURATION, 1);
      tree.bulbs.forEach((bulb, i) => {
        const lit = progress >= (i + 1) / tree.bulbs.length * .82;
        bulb.material.color.setHex(lit ? 0xffdf91 : 0x6c6650);
        bulb.scale.setScalar(lit ? 1.45 : 1);
      });
      tree.starMaterial.emissiveIntensity = THREE.MathUtils.smoothstep(progress, .78, 1) * 2;
      material.opacity = reducedMotion ? .35 : Math.min(elapsed, 1) * .85;
      for (let i = 0; i < count; i++) {
        const t = ((i / count + elapsed * .15) % 1);
        const angle = t * Math.PI * 10 + (reducedMotion ? 0 : time * .5);
        const radius = 1.7 * (1 - t * .92);
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = .65 + t * 3.4;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      geometry.attributes.position.needsUpdate = true;
      if (progress === 1 && !complete) { complete = true; onComplete(); }
    },
  };
}
