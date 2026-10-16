import * as THREE from 'three';
import { palette } from './art-direction.js';

// One draw call and fixed storage. Expired slots are reused, never appended.
export function createInteractionParticles(scene, capacity = 96) {
  const positions = new Float32Array(capacity * 3);
  const alpha = new Float32Array(capacity);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const slots = Array.from({ length: capacity }, () => ({
    age: 2, life: 1, origin: new THREE.Vector3(), velocity: new THREE.Vector3(),
    angle: 0, turn: 0, radius: 0, trail: false, still: false,
  }));
  const gold = new THREE.Color(palette.champagne), ivory = new THREE.Color(palette.ivory);
  for (let i = 0; i < capacity; i++) {
    (i % 3 ? gold : ivory).toArray(colors, i * 3);
    sizes[i] = 3 + (i % 4) * .65;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio;
      attribute float alpha;
      attribute vec3 tint;
      attribute float size;
      varying float opacity;
      varying vec3 color;
      void main() {
        opacity=alpha; color=tint;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*pixelRatio*12.0/max(1.0,-p.z),1.0,18.0);
      }`,
    fragmentShader: `
      varying float opacity;
      varying vec3 color;
      void main() {
        vec2 p=abs(gl_PointCoord-.5)*2.0;
        float r=length(p);
        float glow=exp(-r*r*5.0)*(1.0-smoothstep(.6,1.0,r));
        float star=pow(max(0.0,1.0-p.x),12.0)*pow(max(0.0,1.0-p.y),2.0)
                  +pow(max(0.0,1.0-p.y),12.0)*pow(max(0.0,1.0-p.x),2.0);
        gl_FragColor=vec4(color, min(1.0,glow*.65+star*.25)*opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'interaction-starlight';
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  let cursor = 0;
  function spawn(origin, trail, turn, still) {
    const slot = slots[cursor];
    cursor = (cursor + 1) % capacity;
    slot.age = 0;
    slot.life = trail ? .8 + Math.random() * .25 : 1 + Math.random() * .4;
    slot.origin.copy(origin);
    slot.trail = trail; slot.still = still;
    slot.angle = Math.atan2(origin.x, origin.z);
    slot.radius = Math.hypot(origin.x, origin.z);
    slot.turn = turn;
    slot.velocity.set((Math.random() - .5) * .55, .12 + Math.random() * .25, (Math.random() - .5) * .55);
  }
  return {
    burst(point, reduced, lowQuality) {
      const count = reduced || lowQuality ? 8 : 12;
      for (let i = 0; i < count; i++) spawn(point, false, 0, reduced);
    },
    trail(point, turn) { spawn(point, true, turn, false); },
    update(delta, pixelRatio) {
      let active = 0;
      for (let i = 0; i < capacity; i++) {
        const slot = slots[i]; slot.age += delta;
        if (slot.age >= slot.life) { alpha[i] = 0; continue; }
        active++;
        const t = slot.age / slot.life;
        // Exponential drag slows the gentle outward drift, with no ballistic burst.
        const drift = slot.still ? 0 : (1 - Math.exp(-slot.age * 3)) / 3;
        let x = slot.origin.x, z = slot.origin.z;
        if (slot.trail) {
          const angle = slot.angle + slot.turn * drift;
          x = Math.sin(angle) * slot.radius; z = Math.cos(angle) * slot.radius;
        }
        positions[i * 3] = x + slot.velocity.x * drift * (slot.trail ? .15 : 1);
        positions[i * 3 + 1] = slot.origin.y + slot.velocity.y * drift;
        positions[i * 3 + 2] = z + slot.velocity.z * drift * (slot.trail ? .15 : 1);
        alpha[i] = Math.sin(Math.PI * Math.min(t * 5, .5)) * (1 - t) ** 2 * (slot.still ? .45 : .8);
      }
      material.uniforms.pixelRatio.value = pixelRatio;
      points.visible = active > 0;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.alpha.needsUpdate = true;
    },
    reset() { slots.forEach(slot => { slot.age = slot.life; }); alpha.fill(0); points.visible = false; },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); },
  };
}
