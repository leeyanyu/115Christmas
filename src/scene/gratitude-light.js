import * as THREE from 'three';

// Energy is independent of its input source, so a future local audio analyser
// can contribute through addEnergy without owning materials or the camera.
export function createGratitudeLight({ tree, onChange = () => {} }) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    ...tree.bulbs.map(b => b.position), tree.animated.at(-1).position,
  ]);
  const foliage = new Set();
  tree.layers.forEach(layer => layer.traverse(object => {
    if (object.material?.emissive) foliage.add(object.material);
  }));
  const warmLight = new THREE.PointLight(0xffd89a, 0, 9, 2);
  warmLight.name = 'gratitude-warm-light';
  warmLight.position.set(0, 2.8, 2);
  tree.root.add(warmLight);
  const lampGold = new THREE.Color(0xffcf7a);
  const material = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, bloom: { value: 0 }, strength: { value: 0 }, pixelRatio: { value: 1 }, tint: { value: new THREE.Color(0xf1c47c) } },
    vertexShader: `
      uniform float progress, bloom, strength, pixelRatio;
      varying float light;
      void main() {
        float height=(position.y-.7)/3.05;
        float star=step(3.9,position.y);
        light=mix(smoothstep(height-.07,height+.07,progress)*strength*(1.0+bloom*.9),bloom*1.5,star);
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp((145.0+bloom*300.0+star*bloom*260.0)*pixelRatio/max(1.0,-p.z),3.0,100.0);
      }`,
    fragmentShader: `
      varying float light;
      uniform vec3 tint;
      void main() {
        float r=length(gl_PointCoord-.5)*2.0;
        float a=exp(-r*r*5.0)*(1.0-smoothstep(.45,1.0,r));
        gl_FragColor=vec4(tint,min(.8,a*light*.45));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  });
  const halo = new THREE.Points(geometry, material);
  halo.name = 'gratitude-light'; halo.frustumCulled = false; halo.visible = false;
  tree.root.add(halo);
  let energy = 0, progress = 0, phase = 'collecting', elapsed = 0, clock = 0, lastTouch = -Infinity, voiceLevel = 0;
  const notify = () => onChange({ phase, count: Math.round(energy * 12), total: 12 });
  function addEnergy(amount) {
    if (phase !== 'collecting' || !Number.isFinite(amount) || amount <= 0) return false;
    const oldCount = Math.round(energy * 12);
    energy = Math.min(1, energy + amount);
    if (energy >= 1 - 1e-8) { energy = 1; phase = 'blooming'; elapsed = 0; }
    if (Math.round(energy * 12) !== oldCount || phase === 'blooming') notify();
    return true;
  }
  return {
    addEnergy,
    setVoiceLevel(value) { voiceLevel = THREE.MathUtils.clamp(value, 0, 1); },
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
      material.uniforms.strength.value = (strength + voiceLevel * .35) * amplitude;
      material.uniforms.pixelRatio.value = pixelRatio;
      halo.visible = strength > .001;
      warmLight.intensity = bloom * amplitude * 3.8;
      foliage.forEach(item => { item.emissiveIntensity += bloom * amplitude * .3; });
      // Awakening and rotation feedback restore their base values each frame.
      tree.bulbs.forEach(bulb => {
        const height = (bulb.position.y - .7) / 3.05;
        const lit = THREE.MathUtils.smoothstep(progress, height - .07, height + .07) * strength * amplitude;
        bulb.material.color.lerp(lampGold, bloom * amplitude * .65);
        bulb.material.color.multiplyScalar(1 + lit * .18 + bloom * amplitude * .22 + voiceLevel * amplitude * .22);
        if (bulb.scale.x > 1) bulb.scale.multiplyScalar(1 + bloom * amplitude * .18);
      });
      tree.starMaterial.emissiveIntensity += bloom * amplitude * .9;
    },
    reset() {
      energy = 0; progress = 0; phase = 'collecting'; elapsed = 0; clock = 0; lastTouch = -Infinity; voiceLevel = 0;
      halo.visible = false; material.uniforms.strength.value = 0; notify();
      warmLight.intensity = 0;
    },
    dispose() { tree.root.remove(halo, warmLight); geometry.dispose(); material.dispose(); },
  };
}
