import * as THREE from 'three';

// Energy is independent of its input source, so a future local audio analyser
// can contribute through addEnergy without owning materials or the camera.
export function createGratitudeLight({ tree, onChange = () => {} }) {
  const geometry = new THREE.BufferGeometry().setFromPoints(tree.bulbs.map(b => b.position));
  const material = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, bloom: { value: 0 }, strength: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float progress, bloom, strength, pixelRatio;
      varying float light;
      void main() {
        float height=(position.y-.7)/3.05;
        light=smoothstep(height-.07,height+.07,progress)*strength;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp((145.0+bloom*65.0)*pixelRatio/max(1.0,-p.z),3.0,44.0);
      }`,
    fragmentShader: `
      varying float light;
      void main() {
        float r=length(gl_PointCoord-.5)*2.0;
        float a=exp(-r*r*4.0)*(1.0-smoothstep(.65,1.0,r));
        gl_FragColor=vec4(1.0,.77,.39,a*light*.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Points(geometry, material);
  halo.name = 'gratitude-light'; halo.frustumCulled = false; halo.visible = false;
  tree.root.add(halo);
  let energy = 0, progress = 0, phase = 'collecting', elapsed = 0, clock = 0, lastTouch = -Infinity;
  const notify = () => onChange({ phase, count: Math.round(energy * 12), total: 12 });
  function addEnergy(amount) {
    if (phase !== 'collecting' || !Number.isFinite(amount) || amount <= 0) return false;
    energy = Math.min(1, energy + amount);
    if (energy >= 1 - 1e-8) { energy = 1; phase = 'blooming'; elapsed = 0; }
    notify(); return true;
  }
  return {
    addEnergy,
    touch() {
      if (clock - lastTouch < .18 || phase !== 'collecting') return false;
      lastTouch = clock; return addEnergy(1 / 12);
    },
    update(delta, reducedMotion, pixelRatio = 1) {
      clock += delta;
      let bloom = 0, strength = energy > 0 ? .65 : 0;
      progress = THREE.MathUtils.damp(progress, energy, reducedMotion ? 4 : 6, delta);
      if (phase === 'blooming') {
        elapsed += delta;
        bloom = THREE.MathUtils.smoothstep(elapsed, 0, 1.8) * (1 - THREE.MathUtils.smoothstep(elapsed, 4, 7));
        strength = 1 - THREE.MathUtils.smoothstep(elapsed, 4, 7);
        if (elapsed >= 7) { energy = 0; progress = 0; phase = 'collecting'; elapsed = 0; strength = 0; notify(); }
      }
      const amplitude = reducedMotion ? .35 : 1;
      material.uniforms.progress.value = progress;
      material.uniforms.bloom.value = bloom * amplitude;
      material.uniforms.strength.value = strength * amplitude;
      material.uniforms.pixelRatio.value = pixelRatio;
      halo.visible = strength > .001;
      // Awakening and rotation feedback restore their base values each frame.
      tree.bulbs.forEach(bulb => {
        const height = (bulb.position.y - .7) / 3.05;
        const lit = THREE.MathUtils.smoothstep(progress, height - .07, height + .07) * strength * amplitude;
        bulb.material.color.multiplyScalar(1 + lit * .4 + bloom * amplitude * .15);
      });
      tree.starMaterial.emissiveIntensity += bloom * amplitude * .8;
    },
    reset() {
      energy = 0; progress = 0; phase = 'collecting'; elapsed = 0; clock = 0; lastTouch = -Infinity;
      halo.visible = false; material.uniforms.strength.value = 0; notify();
    },
    dispose() { tree.root.remove(halo); geometry.dispose(); material.dispose(); },
  };
}
