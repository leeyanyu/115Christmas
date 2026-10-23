import * as THREE from 'three';

// Fixed snow/star buffers, shared across every replay; two effects, one draw call.
export function createPlayRewards(scene, capacity = 192) {
  const starCount = Math.floor(capacity / 3);
  const positions = new Float32Array(capacity * 3), alphas = new Float32Array(capacity);
  const types = new Float32Array(capacity), sizes = new Float32Array(capacity);
  const seeds = Array.from({ length: capacity }, (_, i) => {
    types[i] = i < starCount ? 1 : 0;
    const layer = i % 3;
    sizes[i] = i < starCount ? [4.5, 8, 12][layer] + Math.random() * 2 : [1.4, 3, 5.5][layer] + Math.random() * 1.2;
    return { angle: Math.random() * Math.PI * 2, radius: Math.random(), phase: Math.random(), speed: .45 + Math.random() * .7, opacity: [.4, .65, .9][i % 3] };
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('kind', new THREE.BufferAttribute(types, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 }, focusDistance: { value: 10 }, starBrightness: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio; uniform float focusDistance; uniform float starBrightness;
      attribute float alpha; attribute float kind; attribute float size;
      varying float opacity; varying float shape; varying float softness;
      void main(){
        opacity=alpha*mix(1.0,starBrightness,kind); shape=kind;
        vec4 p=modelViewMatrix*vec4(position,1.0);
        float distance=-p.z;
        // Perspective size plus distance fade makes foreground and background distinct.
        opacity *= mix(.42,1.0,1.0-smoothstep(focusDistance-2.0,focusDistance+4.0,distance));
        softness=1.0-smoothstep(focusDistance-4.0,focusDistance-1.0,distance);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*pixelRatio*15.0/max(1.0,-p.z),1.0,30.0);
      }`,
    fragmentShader: `
      varying float opacity; varying float shape; varying float softness;
      void main(){
        vec2 p=gl_PointCoord*2.0-1.0;
        float r=length(p);
        float a=atan(p.y,p.x);
        float edge=mix(.32,.86,.5+.5*cos(5.0*a));
        float star=1.0-smoothstep(edge-.09,edge+.03,r);
        float snow=exp(-r*r*mix(5.5,2.8,softness))*(1.0-smoothstep(.65,1.0,r));
        vec3 tint=mix(vec3(.90,.94,1.0),vec3(1.0,.77,.38),shape);
        gl_FragColor=vec4(tint,min(.95,mix(snow,star,shape)*opacity));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'christmas-surprises'; points.frustumCulled = false; points.visible = false;
  scene.add(points);
  let stars = 4, snow = 11, reducedStars = false, reducedSnow = false;
  let starLimit = starCount, snowLimit = capacity - starCount;
  const origin = new THREE.Vector3();
  return {
    stars(point, reduced, lowQuality = false, brightness = 1) {
      origin.copy(point); stars = 0; reducedStars = reduced; starLimit = reduced ? 8 : lowQuality ? Math.min(24, starCount) : starCount;
      material.uniforms.starBrightness.value = THREE.MathUtils.clamp(brightness, 1, reduced ? 1.25 : 2.2);
    },
    snow(reduced, lowQuality = false) { snow = 0; reducedSnow = reduced; snowLimit = reduced ? 24 : lowQuality ? Math.min(64, capacity - starCount) : capacity - starCount; },
    update(delta, pixelRatio, focusDistance = 10) {
      stars += delta; snow += delta;
      let active = false;
      for (let i = 0; i < capacity; i++) {
        const seed = seeds[i], index = i * 3;
        alphas[i] = 0;
        if (i < starLimit && stars < 2.4) {
          const age = stars, drift = reducedStars ? .12 : (1 - Math.exp(-age * 1.4)) / 1.4;
          positions[index] = origin.x + Math.cos(seed.angle) * (1 + seed.radius * 1.9) * drift;
          positions[index + 1] = origin.y + (reducedStars ? 0 : Math.sin(Math.min(age / 2.4, 1) * Math.PI) * (.35 + seed.radius * .65));
          positions[index + 2] = origin.z + Math.sin(seed.angle) * (1 + seed.radius * 1.9) * drift;
          alphas[i] = Math.min(1, age * 8) * (1 - age / 2.4) * (reducedStars ? .45 : .9) * seed.opacity;
        } else if (i >= starCount && i < starCount + snowLimit && snow < 10) {
          const age = snow;
          const drift = reducedSnow ? 0 : age;
          const radius = .7 + seed.radius * 3.3;
          positions[index] = Math.cos(seed.angle) * radius + Math.sin(drift * .7 + seed.phase * 6) * .15;
          positions[index + 1] = 5.5 - ((seed.phase * 5.5 + drift * seed.speed) % 5.5);
          positions[index + 2] = Math.sin(seed.angle) * radius;
          alphas[i] = Math.min(1, age / 1.2, (10 - age) / 2) * (reducedSnow ? .3 : .8) * seed.opacity * (reducedSnow ? 1 : .9 + .1 * Math.sin(age * .8 + seed.phase * 6));
        }
        if (alphas[i] > 0) active = true;
      }
      material.uniforms.pixelRatio.value = pixelRatio;
      material.uniforms.focusDistance.value = focusDistance;
      geometry.attributes.position.needsUpdate = true; geometry.attributes.alpha.needsUpdate = true;
      points.visible = active;
    },
    reset() { stars = 4; snow = 11; alphas.fill(0); points.visible = false; material.uniforms.starBrightness.value = 1; },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); },
  };
}
