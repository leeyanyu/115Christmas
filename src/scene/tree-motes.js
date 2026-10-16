import * as THREE from 'three';
import { palette } from './art-direction.js';

// A fixed budget of soft lights appears gradually, then remains around the tree.
export function createTreeMotes(scene) {
  const count = 180;
  const positions = new Float32Array(count * 3);
  const births = new Float32Array(count);
  const sizes = new Float32Array(count);
  let seed = 2026;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.2 + random() * 1.5;
    positions.set([Math.cos(angle) * radius, .2 + random() * 4.4, Math.sin(angle) * radius], i * 3);
    births[i] = i < 18 ? -2 : 1.5 + (i - 18) / (count - 18) * 12;
    sizes[i] = 2 + random() * 3.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('birth', new THREE.BufferAttribute(births, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(palette.champagne) }, elapsed: { value: 0 }, motion: { value: 1 }, pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float elapsed;
      uniform float motion;
      uniform float pixelRatio;
      attribute float birth;
      attribute float size;
      varying float alpha;
      void main(){
        vec3 p=position;
        p.x += sin(elapsed*.23+position.y*3.0)*.12*motion;
        p.y += sin(elapsed*.3+position.x*2.0)*.13*motion;
        alpha=smoothstep(birth,birth+1.8,elapsed)*(.5+.14*sin(elapsed*.7+position.y*4.0));
        vec4 view=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(size*pixelRatio*9.0/max(1.0,-view.z),1.0,12.0);
      }`,
    fragmentShader: `
      uniform vec3 tint;
      varying float alpha;
      void main(){
        float radius=length(gl_PointCoord-.5)*2.0;
        float glow=exp(-radius*radius*3.0)*(1.0-smoothstep(.6,1.0,radius));
        gl_FragColor=vec4(tint,glow*alpha*.65);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return {
    update(elapsed, reducedMotion) {
      material.uniforms.elapsed.value = elapsed;
      material.uniforms.motion.value = reducedMotion ? 0 : 1;
      material.uniforms.pixelRatio.value = Math.min(devicePixelRatio, 1.75);
    },
  };
}
