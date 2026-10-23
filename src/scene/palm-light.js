import * as THREE from 'three';
import { createInteractionParticles } from './interaction-particles.js';

// Fixed geometry and a reusable particle pool. Awakening/rotation restore the
// base materials each frame before this local, additive feedback is applied.
export function createPalmLight(tree, capacity = 72) {
  const star = tree.animated.at(-1);
  const geometry = new THREE.BufferGeometry().setFromPoints([...tree.bulbs.map(b => b.position), star.position]);
  const material = new THREE.ShaderMaterial({
    uniforms: { head: { value: 4.3 }, strength: { value: 0 }, starGlow: { value: 0 }, pixelRatio: { value: 1 }, viewportHeight: { value: 800 } },
    vertexShader: `
      uniform float head, strength, starGlow, pixelRatio, viewportHeight;
      varying float light; varying float accent;
      void main() {
        float star=step(3.9,position.y);
        float band=exp(-pow((position.y-head)/.36,2.0));
        light=mix(band*strength,starGlow,star);
        accent=step(.5,fract(position.y*6.0));
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(mix(.22,1.3,star)*.5*viewportHeight*projectionMatrix[1][1]/max(1.0,-p.z),3.0,280.0*pixelRatio);
      }`,
    fragmentShader: `
      varying float light; varying float accent;
      void main() {
        float r=length(gl_PointCoord-.5)*2.0;
        float alpha=exp(-r*r*5.0)*(1.0-smoothstep(.55,1.0,r));
        vec3 tint=mix(vec3(1.0,.73,.35),vec3(1.0,.94,.8),accent*.6);
        gl_FragColor=vec4(tint,min(.7,alpha*light*.65));
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
  const origin = new THREE.Vector3();
  let elapsed = -1, charge = 0, targetCharge = 0, emission = 0, ordinal = 0;
  let queuedTurn = 0, present = false, freshness = 1;
  const smooth = THREE.MathUtils.smoothstep;
  return {
    get isPresent() { return present && freshness < .8; },
    get isFlowing() { return elapsed >= 0; },
    input(input, ready) {
      freshness = 0; present = input.present || input.grace;
      targetCharge = ready ? input.progress || 0 : 0;
      if (present && ready) queuedTurn = THREE.MathUtils.clamp(queuedTurn + input.turn, -1.5, 1.5);
      else queuedTurn = 0;
    },
    // A fresh presentation can restart the wave; storage stays bounded even
    // when a visitor lowers/raises their hand before the last wave has faded.
    start() { elapsed = 0; targetCharge = 0; emission = 0; return true; },
    rotate(delta, reducedMotion, ready) {
      freshness += delta;
      if (!ready || !this.isPresent) { queuedTurn = 0; targetCharge = 0; return; }
      const step = THREE.MathUtils.clamp(queuedTurn * (1 - Math.exp(-delta * 9)), -delta * 1.5, delta * 1.5);
      tree.root.rotation.y += step * (reducedMotion ? .4 : 1);
      queuedTurn -= step;
      if (Math.abs(queuedTurn) < .0001) queuedTurn = 0;
    },
    update(delta, reducedMotion, pixelRatio = 1, viewportHeight = 800) {
      charge = THREE.MathUtils.damp(charge, targetCharge, 7, delta);
      let head = 4.3, strength = 0, starGlow = charge * .9;
      if (elapsed >= 0) {
        elapsed += delta;
        const fade = 1 - smooth(elapsed, 3.5, 4.8);
        strength = smooth(elapsed, .35, .95) * fade;
        starGlow = Math.max(starGlow, (1 - smooth(elapsed, 1.2, 3.0)) * smooth(elapsed, 0, .35));
        head = THREE.MathUtils.lerp(4.05, .5, smooth(elapsed, .75, 3.5));
        if (!reducedMotion && elapsed > .8 && elapsed < 3.7) {
          emission = Math.min(2, emission + delta * (capacity <= 40 ? 4 : 8));
          while (emission >= 1) {
            const angle = ordinal++ * 2.39996, radius = Math.max(.12, 1.6 * (1 - (head - .5) / 3.75));
            origin.set(Math.sin(angle) * radius, head, Math.cos(angle) * radius);
            particles.trail(origin, .15); emission--;
          }
        }
        if (elapsed >= 4.8) { elapsed = -1; strength = 0; }
      }
      const amplitude = reducedMotion ? .35 : 1;
      material.uniforms.head.value = head;
      material.uniforms.strength.value = strength * amplitude;
      material.uniforms.starGlow.value = starGlow * amplitude;
      material.uniforms.pixelRatio.value = pixelRatio;
      material.uniforms.viewportHeight.value = viewportHeight * pixelRatio;
      halo.visible = strength > .002 || starGlow > .002;
      lamp.position.set(.2, head, .8); lamp.intensity = strength * 2.3 * amplitude;
      tree.starMaterial.emissiveIntensity += starGlow * 1.35 * amplitude;
      for (const bulb of tree.bulbs) {
        const band = Math.exp(-(((bulb.position.y - head) / .36) ** 2)) * strength * amplitude;
        bulb.material.color.multiplyScalar(1 + band * .65);
      }
      particles.update(delta, pixelRatio);
    },
    reset() {
      elapsed = -1; charge = targetCharge = queuedTurn = emission = 0; present = false; freshness = 1;
      halo.visible = false; lamp.intensity = 0; particles.reset();
    },
    dispose() { particles.dispose(); tree.root.remove(halo, lamp); geometry.dispose(); material.dispose(); },
  };
}
