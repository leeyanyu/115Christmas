import * as THREE from 'three';
import { palette } from './starlight-style.js';

// Rotation feedback is independent of gesture particles and opening choreography.
export function createRotationGlow({ tree, controls, canvas, activityTarget = window, visibilityTarget = document }) {
  const materials = new Set();
  const foliage = new Set();
  tree.layers.forEach(layer => layer.traverse(object => {
    if (object.material?.emissive) { materials.add(object.material); foliage.add(object.material); }
  }));
  tree.animated.forEach(object => {
    if (object.material?.emissive && object.material !== tree.starMaterial) materials.add(object.material);
  });
  materials.forEach(material => { material.emissive.set(foliage.has(material) ? 0x164d3c : palette.champagne); });
  const geometry = new THREE.BufferGeometry().setFromPoints(tree.bulbs.map(bulb => bulb.position));
  const material = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 }, pixelRatio: { value: 1 }, tint: { value: new THREE.Color(palette.champagne) } },
    vertexShader: `
      uniform float pixelRatio;
      void main() {
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(180.0*pixelRatio/max(1.0,-p.z),4.0,40.0);
      }`,
    fragmentShader: `
      uniform float strength;
      uniform vec3 tint;
      void main() {
        float r=length(gl_PointCoord-.5)*2.0;
        float glow=exp(-r*r*4.0)*(1.0-smoothstep(.65,1.0,r));
        gl_FragColor=vec4(tint,glow*strength*.95);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Points(geometry, material);
  halo.name = 'rotation-glow';
  halo.frustumCulled = false;
  halo.visible = false;
  tree.root.add(halo);
  let idle = 0, held = false, glow = 0, autoTurn = 0;
  let rotation = tree.root.rotation.y, azimuth = controls.getAzimuthalAngle(), polar = controls.getPolarAngle();
  const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  const activity = () => { idle = 0; autoTurn = 0; controls.autoRotate = false; };
  const start = () => { held = true; activity(); };
  const end = () => { held = false; activity(); };
  const visibility = () => { held = false; activity(); };
  controls.addEventListener('start', start);
  controls.addEventListener('end', end);
  for (const type of ['pointerdown', 'keydown', 'wheel']) activityTarget.addEventListener(type, activity, { passive: true });
  activityTarget.addEventListener('blur', visibility);
  visibilityTarget.addEventListener('visibilitychange', visibility);
  canvas?.addEventListener('pointerdown', start);
  activityTarget.addEventListener('pointerup', end);
  activityTarget.addEventListener('pointercancel', end);
  return {
    beforeUpdate(delta, ready, reducedMotion) {
      if (!ready || reducedMotion || held || visibilityTarget.hidden) {
        idle = 0; autoTurn = 0; controls.autoRotate = false;
      } else {
        idle += delta;
        controls.autoRotate = false;
        if (idle >= 10) {
          const step = Math.min(delta * Math.PI * 2 / 8, Math.PI * 2 - autoTurn);
          const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
          const previous = autoTurn / (Math.PI * 2);
          autoTurn += step;
          tree.root.rotation.y += (ease(autoTurn / (Math.PI * 2)) - ease(previous)) * Math.PI * 2;
          if (autoTurn >= Math.PI * 2 - 1e-8) { idle = 0; autoTurn = 0; }
        }
      }
    },
    update(delta, reducedMotion, pixelRatio) {
      const turn = Math.abs(wrapped(tree.root.rotation.y - rotation))
        + Math.abs(wrapped(controls.getAzimuthalAngle() - azimuth))
        + Math.abs(controls.getPolarAngle() - polar);
      rotation = tree.root.rotation.y;
      azimuth = controls.getAzimuthalAngle(); polar = controls.getPolarAngle();
      // Original manual orbit and automatic tree rotation share the same light feedback.
      const target = turn > .00001 ? 1 : 0;
      glow = THREE.MathUtils.damp(glow, target, target ? 8 : 3, delta);
      const strength = glow * (reducedMotion ? .4 : 1);
      materials.forEach(item => { item.emissiveIntensity = strength * (foliage.has(item) ? .22 : .12); });
      // Awakening writes its base light each frame; add feedback after that update.
      tree.starMaterial.emissiveIntensity += strength * .35;
      tree.bulbs.forEach(bulb => {
        bulb.material.color.multiplyScalar(1 + strength * .7);
        if (bulb.scale.x > 1) bulb.scale.setScalar(1.15 * (1 + strength * .2));
      });
      material.uniforms.strength.value = strength;
      material.uniforms.pixelRatio.value = pixelRatio;
      halo.visible = strength > .005 && tree.animated.at(-1).scale.x > .99;
    },
    reset() {
      activity(); held = false; glow = 0; halo.visible = false;
      materials.forEach(item => { item.emissiveIntensity = 0; });
      rotation = tree.root.rotation.y;
      azimuth = controls.getAzimuthalAngle(); polar = controls.getPolarAngle();
    },
    dispose() {
      controls.autoRotate = false;
      canvas?.removeEventListener('pointerdown', start);
      activityTarget.removeEventListener('pointerup', end);
      activityTarget.removeEventListener('pointercancel', end);
      controls.removeEventListener('start', start); controls.removeEventListener('end', end);
      for (const type of ['pointerdown', 'keydown', 'wheel']) activityTarget.removeEventListener(type, activity);
      activityTarget.removeEventListener('blur', visibility);
      visibilityTarget.removeEventListener('visibilitychange', visibility);
      tree.root.remove(halo); geometry.dispose(); material.dispose();
    },
  };
}
