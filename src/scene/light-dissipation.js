import * as THREE from 'three';

// Small, deterministic motes inherit positions along each dissolving light band.
export function createLightDissipation(scene, strips, pixelRatio) {
  const count = 80;
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = Array.from({ length: count }, (_, i) => {
    const random = n => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
    return { strip: i % strips.length, t: .42 + random(1) * .56,
      birth: 2.0 + random(2) * 1.7, life: 1.5 + random(3) * 1.9,
      dx: (random(4) - .5) * .55, dy: .12 + random(5) * .35,
      dz: (random(6) - .5) * .3, size: 2 + random(7) * 4,
      phase: random(8) * Math.PI * 2 };
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: pixelRatio } },
    vertexShader: `
      uniform float pixelRatio;
      attribute float alpha;
      attribute float size;
      varying float vAlpha;
      void main(){
        vAlpha=alpha;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*pixelRatio*8.0/max(1.0,-p.z),1.0,18.0);
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        float r=length(gl_PointCoord-.5)*2.0;
        float glow=exp(-r*r*4.0)*(1.0-smoothstep(.5,1.0,r));
        gl_FragColor=vec4(1.0,.86,.6,glow*vAlpha);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  const origin = new THREE.Vector3();
  return {
    update(elapsed) {
      points.visible = elapsed >= 2.0 && elapsed < 8;
      seeds.forEach((seed, i) => {
        const age = elapsed - seed.birth;
        const progress = THREE.MathUtils.clamp(age / seed.life, 0, 1);
        alphas[i] = age < 0 ? 0 : Math.sin(Math.PI * progress) * .45;
        const curve = strips[seed.strip].curve;
        if (!curve) return;
        // Detach from the curve, drift gently, then fade without a final flash.
        curve.getPoint(seed.t, origin);
        const drift = Math.max(0, age);
        positions[i * 3] = origin.x + seed.dx * drift + Math.sin(seed.phase + drift) * drift * .04;
        positions[i * 3 + 1] = origin.y + seed.dy * drift;
        positions[i * 3 + 2] = origin.z + seed.dz * drift;
        sizes[i] = seed.size * (1 + progress * .5);
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.alpha.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
    },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); },
  };
}
