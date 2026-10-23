import * as THREE from 'three';
import { createInteractionParticles } from './interaction-particles.js';
import { createHandRotation } from './hand-rotation.js';

// Fixed geometry and a reusable particle pool. Awakening/rotation restore the
// base materials each frame before this local, additive feedback is applied.
export function createPalmLight(tree, capacity = 72) {
  const star = tree.animated.at(-1);
  const geometry = new THREE.BufferGeometry().setFromPoints([...tree.bulbs.map(b => b.position), star.position]);
  const material = new THREE.ShaderMaterial({
    uniforms: { head: { value: 4.3 }, strength: { value: 0 }, afterglow: { value: 0 }, starGlow: { value: 0 }, pixelRatio: { value: 1 }, viewportHeight: { value: 800 } },
    vertexShader: `
      uniform float head, strength, afterglow, starGlow, pixelRatio, viewportHeight;
      varying float light; varying float accent;
      void main() {
        float star=step(3.9,position.y);
        float band=exp(-pow((position.y-head)/.44,2.0));
        float wake=smoothstep(head-.12,head+.22,position.y)*afterglow;
        light=mix(band*strength+wake*.5,starGlow,star);
        accent=step(.5,fract(position.y*6.0));
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(mix(.34,1.5,star)*.5*viewportHeight*projectionMatrix[1][1]/max(1.0,-p.z),3.0,280.0*pixelRatio);
      }`,
    fragmentShader: `
      varying float light; varying float accent;
      void main() {
        float r=length(gl_PointCoord-.5)*2.0;
        float alpha=exp(-r*r*5.0)*(1.0-smoothstep(.55,1.0,r));
        vec3 tint=mix(vec3(1.0,.73,.35),vec3(1.0,.94,.8),accent*.6);
        gl_FragColor=vec4(tint,min(.8,alpha*light*.8));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Points(geometry, material);
  halo.name = 'palm-light-flow'; halo.frustumCulled = false; halo.visible = false;
  const lamp = new THREE.PointLight(0xffdfaa, 0, 4, 2);
  lamp.name = 'palm-flow-lamp';
  tree.root.add(halo, lamp);
  const particles = createInteractionParticles(tree.root, capacity);
  const rotation = createHandRotation();
  const gold = new THREE.Color(0xffd795), ivory = new THREE.Color(0xfff0d6);
  const origin = new THREE.Vector3();
  let elapsed = -1, charge = 0, targetCharge = 0, emission = 0, ordinal = 0;
  let present = false, freshness = 1, dim = 0;
  const smooth = THREE.MathUtils.smoothstep;
  return {
    get isPresent() { return present && freshness < .8; },
    get isRotating() { return rotation.isActive; },
    get isFlowing() { return elapsed >= 0; },
    get dimStrength() { return dim; },
    input(input, ready) {
      freshness = 0; present = input.present || input.grace;
      targetCharge = ready ? input.progress || 0 : 0;
      rotation.input(input, ready);
    },
    // A fresh presentation can restart the wave; storage stays bounded even
    // when a visitor lowers/raises their hand before the last wave has faded.
    start() { elapsed = 0; targetCharge = 0; emission = 0; return true; },
    rotate(delta, reducedMotion, ready) {
      freshness += delta;
      if (!ready || !this.isPresent) targetCharge = 0;
      tree.root.rotation.y += rotation.update(delta, reducedMotion, ready);
    },
    update(delta, reducedMotion, pixelRatio = 1, viewportHeight = 800, viewAzimuth = 0) {
      charge = THREE.MathUtils.damp(charge, targetCharge, 7, delta);
      let head = 4.3, strength = 0, afterglow = 0, starGlow = charge * 1.05, darkness = charge * .3;
      if (elapsed >= 0) {
        elapsed += delta;
        const fade = 1 - smooth(elapsed, 4.2, 5.6);
        strength = smooth(elapsed, .25, .8) * fade * 1.45;
        afterglow = smooth(elapsed, .7, 1.4) * (1 - smooth(elapsed, 5, 7));
        starGlow = Math.max(starGlow, (1 - smooth(elapsed, 2, 5.7)) * smooth(elapsed, 0, .3));
        darkness = smooth(elapsed, 0, .65) * (1 - smooth(elapsed, 5, 7));
        head = THREE.MathUtils.lerp(4.05, .5, smooth(elapsed, .65, 3.9));
        if (!reducedMotion && elapsed > .7 && elapsed < 4.2) {
          emission = Math.min(2, emission + delta * (capacity <= 40 ? 6 : 12));
          while (emission >= 1) {
            const angle = ordinal++ * 2.39996, radius = Math.max(.12, 1.6 * (1 - (head - .5) / 3.75));
            origin.set(Math.sin(angle) * radius, head, Math.cos(angle) * radius);
            particles.trail(origin, .15); emission--;
          }
        }
        if (elapsed >= 7) { elapsed = -1; strength = afterglow = darkness = 0; }
      }
      const amplitude = reducedMotion ? .35 : 1;
      dim = THREE.MathUtils.damp(dim, darkness * amplitude, 5, delta);
      material.uniforms.head.value = head;
      material.uniforms.strength.value = strength * amplitude;
      material.uniforms.afterglow.value = afterglow * amplitude;
      material.uniforms.starGlow.value = starGlow * amplitude;
      material.uniforms.pixelRatio.value = pixelRatio;
      material.uniforms.viewportHeight.value = viewportHeight * pixelRatio;
      halo.visible = strength > .002 || afterglow > .002 || starGlow > .002;
      const front = viewAzimuth - tree.root.rotation.y;
      const radius = Math.max(.65, 1.65 * (1 - (head - .5) / 3.75) + .35);
      lamp.position.set(Math.sin(front) * radius, head, Math.cos(front) * radius);
      lamp.intensity = strength * 3.2 * amplitude;
      tree.starMaterial.emissiveIntensity += starGlow * 1.7 * amplitude;
      for (let i = 0; i < tree.bulbs.length; i++) {
        const bulb = tree.bulbs[i];
        const band = Math.exp(-(((bulb.position.y - head) / .44) ** 2)) * strength * amplitude;
        const wake = smooth(bulb.position.y, head - .12, head + .22) * afterglow * amplitude;
        bulb.material.color.lerp(i % 3 ? gold : ivory, Math.min(.65, band * .3 + wake * .25));
        bulb.material.color.multiplyScalar(1 + band * .85 + wake * .3);
      }
      particles.update(delta, pixelRatio);
    },
    reset() {
      elapsed = -1; charge = targetCharge = emission = dim = 0; present = false; freshness = 1; rotation.reset();
      halo.visible = false; lamp.intensity = 0; particles.reset();
    },
    dispose() { particles.dispose(); tree.root.remove(halo, lamp); geometry.dispose(); material.dispose(); },
  };
}
