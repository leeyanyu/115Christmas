import * as THREE from 'three';
import { createLightDissipation } from './light-dissipation.js';

// Full-viewport light field, independent of the tree canvas and its orbit camera.
// A transverse shader provides a warm core and soft atmospheric glow
// in one pass; no full-resolution bloom buffers are needed on phones.
export function createRibbons(getLandingPoint) {
  const canvas = document.createElement('canvas');
  canvas.className = 'light-flow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 40);
  camera.position.z = 8;
  const segments = 320;
  const strips = [];
  const fragmentShader = `
    uniform float time;
    uniform float opacity;
    uniform float seed;
    varying vec2 vUv;
    float gaussian(float x, float width) { return exp(-x*x/width); }
    void main() {
      float x = vUv.y * 2.0 - 1.0;
      float s = vUv.x;
      float fold = sin(s*8.0-time*.65+seed);
      float body = 1.0-smoothstep(.46,.68,abs(x));
      float sheen = gaussian(x-fold*.28,.035);
      float edgeLight = gaussian(abs(x)-.48,.008)*.3;
      float halo = gaussian(x,.45)*.14;
      vec3 gold = mix(vec3(.55,.32,.10),vec3(.94,.72,.36),.5+.5*fold);
      vec3 satin = gold + vec3(.42,.34,.20)*sheen + vec3(.28,.20,.09)*edgeLight;
      vec3 color = mix(vec3(.95,.69,.32),satin,body);
      float endFade = smoothstep(0.0,.09,s)*(1.0-smoothstep(.88,1.0,s));
      float feather = 1.0-smoothstep(.75,1.0,abs(x));
      gl_FragColor = vec4(color,(body*.83+halo)*feather*endFade*opacity);
    }`;
  for (let i = 0; i < 5; i++) {
    const positions = new Float32Array((segments + 1) * 6);
    const uvs = new Float32Array((segments + 1) * 4);
    const indices = [];
    for (let j = 0; j <= segments; j++) {
      uvs.set([j / segments, 0, j / segments, 1], j * 4);
      if (j < segments) { const n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, opacity: { value: 0 }, seed: { value: i * 2.17 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader, transparent: true, blending: THREE.NormalBlending,
      depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    strips.push({ mesh, positions, curve: null });
  }
  const dissipation = createLightDissipation(scene, strips, renderer.getPixelRatio());
  const hazeMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform float opacity;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv*2.0-1.0;
        float radius = dot(p,p);
        float mist = exp(-radius*3.8)*(1.0-smoothstep(.35,1.0,radius));
        vec3 color = mix(vec3(.7,.51,.29),vec3(1.0,.88,.65),exp(-radius*9.0));
        gl_FragColor=vec4(color,mist*opacity);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(1,1),hazeMaterial);
  haze.scale.set(2.3,1.1,1);
  scene.add(haze);
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    const landing = getLandingPoint();
    const end = [landing.x / innerWidth, landing.y / innerHeight];
    const toWorld = (uv, z) => {
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(24)) * (8-z);
      return new THREE.Vector3((uv[0]*2-1)*halfHeight*camera.aspect,(1-uv[1]*2)*halfHeight,z);
    };
    const destination = toWorld(end,-3);
    haze.position.copy(destination);
    haze.position.z += .02;
    // Five hand-shaped, broad S-curves follow the user's ribbon sketch.
    // Controls are authored in viewport space, then placed at receding depths.
    const paths = [
      [[.18,-.25],[.55,.02],[-.18,.22],[.22,.28],[end[0]-.3,end[1]-.08]],
      [[1.25,.1],[.85,.16],[.55,.35],[.86,.48],[end[0]+.12,end[1]-.04]],
      [[-.25,.6],[.4,.1],[.38,.52],[.2,.62],[end[0]-.15,end[1]+.05]],
      [[.04,1.25],[.72,.98],[-.15,.98],[.24,.85],[end[0]-.15,end[1]+.12]],
      [[1.2,1.25],[.55,1.1],[1.2,.9],[.85,.8],[end[0]+.2,end[1]+.12]],
    ];
    strips.forEach((strip,i) => {
      const [start,a,b,join,last] = paths[i];
      const p0=toWorld(start,2), p1=toWorld(a,1.2), p2=toWorld(b,.4), p3=toWorld(join,-.5);
      // Mirrored handles preserve a continuous tangent through the broad S bend.
      const p4=p3.clone().add(p3.clone().sub(p2));
      const path=new THREE.CurvePath();
      path.add(new THREE.CubicBezierCurve3(p0,p1,p2,p3));
      path.add(new THREE.CubicBezierCurve3(p3,p4,toWorld(last,-2.3),destination.clone()));
      strip.curve=path;
    });
  };
  window.addEventListener('resize', resize);
  const onScroll = () => { if (active) resize(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  resize();
  let active = true;
  const p = new THREE.Vector3();
  const before = new THREE.Vector3(), after = new THREE.Vector3();
  return {
    reset() { active = true; canvas.hidden = false; hazeMaterial.uniforms.opacity.value = 0; dissipation.update(0); resize(); },
    update(elapsed, reduced) {
      if (!active) return;
      if (reduced || elapsed > 8.2) {
        canvas.hidden = true;
        renderer.clear();
        active = false;
        return;
      }
      dissipation.update(elapsed);
      hazeMaterial.uniforms.opacity.value = THREE.MathUtils.smoothstep(elapsed,.8,2.3) * (1-THREE.MathUtils.smoothstep(elapsed,3.1,5.2)) * .48;
      strips.forEach(({ mesh, positions, curve }, i) => {
        // The leading edge flies in quickly; a long trailing ribbon preserves the S silhouette.
        const local = elapsed-i*.075;
        const head = THREE.MathUtils.smoothstep(local,0,1.15);
        const tail = THREE.MathUtils.smoothstep(local,1.1,3.6)*.72;
        mesh.material.uniforms.time.value = elapsed;
        mesh.material.uniforms.opacity.value = THREE.MathUtils.smoothstep(local, 0, .2) * (1 - THREE.MathUtils.smoothstep(local, 1.8, 4.0));
        for (let j = 0; j <= segments; j++) {
          const t = Math.min(head, tail) + Math.max(0, head-tail) * j/segments;
          curve.getPoint(t,p);
          const width = (.48 * Math.pow(1-t, .85) + .055) * (.85 + .15*Math.cos(t*7+i*.9));
          // A centered screen-space difference keeps the band normal smooth at every bend.
          curve.getPoint(Math.max(0,t-.004),before);
          curve.getPoint(Math.min(1,t+.004),after);
          const tx=after.x/(8-after.z)-before.x/(8-before.z);
          const ty=after.y/(8-after.z)-before.y/(8-before.z);
          const length=Math.hypot(tx,ty) || 1;
          for (let side = 0; side < 2; side++) {
            const offset = (side ? 1 : -1)*width;
            const index = (j*2+side)*3;
            positions[index] = p.x-ty/length*offset;
            positions[index+1] = p.y+tx/length*offset;
            positions[index+2] = p.z;
          }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });
      renderer.render(scene,camera);
    },
    dispose() {
      window.removeEventListener('resize',resize);
      window.removeEventListener('scroll',onScroll);
      dissipation.dispose();
      haze.geometry.dispose();
      hazeMaterial.dispose();
      strips.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});
      renderer.dispose();
      canvas.remove();
    },
  };
}
