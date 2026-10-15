import * as THREE from 'three';

// Full-viewport light field, independent of the tree canvas and its orbit camera.
// A transverse shader provides a white core, cyan filaments and broad soft glow
// in one pass; no full-resolution bloom buffers are needed on phones.
export function createRibbons() {
  const canvas = document.createElement('canvas');
  canvas.className = 'light-flow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 40);
  camera.position.z = 8;
  const segments = 100;
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
      float wave = sin(s*18.0-time*1.8+seed)*.015;
      x += wave;
      float glow = gaussian(x,.32)*.38 + gaussian(x,.07)*.65;
      float core = gaussian(x,.007)*2.0;
      float strands = 0.0;
      for(int j=0;j<6;j++) {
        float lane = (float(j)-2.5)*.13;
        float offset = sin(s*12.0+float(j)*.9-time*.9)*.018;
        strands += gaussian(x-lane-offset,.0006)*(.24+.18*sin(s*37.0-time*4.0+float(j)));
      }
      float pulse = pow(max(0.0,sin(s*65.0-time*11.0+seed)),18.0);
      float sparks = pulse*gaussian(abs(x)-.48,.0013)*.9;
      float endFade = smoothstep(0.0,.035,s)*(1.0-smoothstep(.94,1.0,s));
      vec3 blue = vec3(.025,.32,1.0)*glow + vec3(.04,.78,1.0)*strands;
      vec3 light = blue + vec3(.48,1.0,1.0)*core + vec3(.15,.65,1.0)*sparks;
      float feather = 1.0-smoothstep(.65,1.0,abs(x));
      gl_FragColor = vec4(light*feather, endFade*opacity);
    }`;
  for (let i = 0; i < 6; i++) {
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
      fragmentShader, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    strips.push({ mesh, positions, curve: null });
  }
  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    // All entry points stay beyond the viewport edges in portrait and landscape.
    const h = Math.tan(THREE.MathUtils.degToRad(24)) * 6;
    const w = h * camera.aspect;
    const entries = [[-1.2,-1.2],[1.2,-1.15],[-1.3,.1],[1.3,.25],[-.75,1.3],[.85,1.3]];
    const rect = document.querySelector('#tree-canvas').getBoundingClientRect();
    const farH = Math.tan(THREE.MathUtils.degToRad(24)) * 11;
    const destination = new THREE.Vector3(((rect.left + rect.width/2)/innerWidth*2-1)*farH*camera.aspect, (1-(rect.top+rect.height/2)/innerHeight*2)*farH, -3);
    strips.forEach((strip,i) => {
      const [x,y] = entries[i];
      strip.curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x*w,y*h,2),
        new THREE.Vector3(x*w*.68,y*h*.6,1),
        new THREE.Vector3(x*w*.22 + Math.sin(i)*.28,y*h*.3+.35,-1),
        destination.clone().add(new THREE.Vector3(.06*Math.sin(i),.05*Math.cos(i),0)),
      ]);
    });
  };
  window.addEventListener('resize', resize);
  resize();
  let active = true;
  const p = new THREE.Vector3(), tangent = new THREE.Vector3();
  return {
    reset() { active = true; canvas.hidden = false; },
    update(elapsed, reduced) {
      if (!active) return;
      if (reduced || elapsed > 5) {
        canvas.hidden = true;
        renderer.clear();
        active = false;
        return;
      }
      strips.forEach(({ mesh, positions, curve }, i) => {
        // Establish long luminous lines, then send the tail toward the vanishing point.
        const tail = THREE.MathUtils.smoothstep(elapsed, 1.35 + i*.06, 4.5 + i*.06);
        mesh.material.uniforms.time.value = elapsed;
        mesh.material.uniforms.opacity.value = THREE.MathUtils.smoothstep(elapsed, 0, .55) * (1 - THREE.MathUtils.smoothstep(elapsed, 3.8, 5));
        for (let j = 0; j <= segments; j++) {
          const t = tail + (1-tail) * j/segments;
          curve.getPoint(t,p);
          curve.getTangent(t,tangent);
          const width = (.72 * (1-t) + .07) * (.85 + .15*Math.sin(t*8+i));
          const length = Math.hypot(tangent.x,tangent.y) || 1;
          for (let side = 0; side < 2; side++) {
            const offset = (side ? 1 : -1)*width;
            const index = (j*2+side)*3;
            positions[index] = p.x-tangent.y/length*offset;
            positions[index+1] = p.y+tangent.x/length*offset;
            positions[index+2] = p.z;
          }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      });
      renderer.render(scene,camera);
    },
    dispose() {
      window.removeEventListener('resize',resize);
      strips.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});
      renderer.dispose();
      canvas.remove();
    },
  };
}
