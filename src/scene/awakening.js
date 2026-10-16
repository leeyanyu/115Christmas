import * as THREE from 'three';

export const AWAKENING_DURATION = 8.5;

export function createAwakening(tree, onComplete, ribbons) {
  const count = 64;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffd889, size: .055, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  tree.root.add(particles);
  const spring = t => t <= 0 ? .001 : t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(12 * t);
  const reset = () => {
    tree.layers.forEach(layer => layer.scale.setScalar(.001));
    tree.animated.forEach(item => item.scale.setScalar(.001));
    tree.trunk.scale.setScalar(.001);
    tree.bulbs.forEach(bulb => bulb.scale.setScalar(.001));
    tree.wire.visible = false;
    tree.starMaterial.emissiveIntensity = 0;
  };
  reset();
  let startedAt = null;
  let complete = false;
  return {
    start(time) { reset(); complete = false; startedAt = time; ribbons.reset(); },
    update(time, reducedMotion) {
      if (startedAt === null) return;
      const elapsed = time - startedAt;
      ribbons.update(elapsed, reducedMotion);
      const grown = (height) => THREE.MathUtils.clamp((elapsed - 1.7 - height / 4.1 * 3.2) / 1.5, 0, 1);
      tree.layers.forEach(layer => {
        const t = grown(layer.position.y);
        const scale = reducedMotion ? Math.max(.001, t) : spring(t);
        layer.scale.set( scale, Math.max(.001, scale), scale );
      });
      tree.animated.forEach(item => item.scale.setScalar(reducedMotion ? Math.max(.001, grown(item.position.y)) : spring(grown(item.position.y))));
      tree.trunk.scale.setScalar(Math.max(.001, Math.min(1, (elapsed - 1.5) / 2)));
      tree.wire.visible = elapsed > 5.3;
      const progress = Math.min(elapsed / AWAKENING_DURATION, 1);
      tree.bulbs.forEach((bulb, i) => {
        const lit = grown(bulb.position.y) > .55;
        bulb.material.color.setHex(lit ? 0xffdf91 : 0x6c6650);
        bulb.scale.setScalar(lit ? 1.15 : .001);
      });
      tree.starMaterial.emissiveIntensity = THREE.MathUtils.smoothstep(progress, .78, 1) * 2;
      material.opacity = Math.max(0, Math.min(elapsed - 2.0, 1)) * (reducedMotion ? .25 : .8);
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
