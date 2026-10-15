import * as THREE from 'three';

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
      float wave = sin(s*7.0-time*.55+seed)*.04;
      x += wave;
      float distanceBlur = smoothstep(.45,1.0,s);
      float glow = gaussian(x,.38)*.38 + gaussian(x,.14)*.4;
      float core = gaussian(x,mix(.018,.15,distanceBlur)) * mix(.85,.28,distanceBlur);
      // Broad, overlapping light veils replace parallel wires and packet-like sparks.
      float silk = gaussian(x-.12*sin(s*5.0-time*.4+seed),.04)*.13;
      float breath = .92+.08*sin(s*7.0-time*1.1+seed);
      float endFade = smoothstep(0.0,.08,s)*(1.0-smoothstep(.68,1.0,s));
      vec3 amber = vec3(.65,.47,.26)*glow;
      vec3 light = amber + vec3(.95,.86,.65)*core + vec3(.72,.6,.42)*silk;
      float feather = 1.0-smoothstep(.55,1.0,abs(x));
      gl_FragColor = vec4(light*feather*breath, endFade*opacity);
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
    // All entry points stay beyond the viewport edges in portrait and landscape.
    const h = Math.tan(THREE.MathUtils.degToRad(24)) * 6;
    const w = h * camera.aspect;
    const entries = [[-1.2,-1.2],[1.2,-1.15],[-1.3,.1],[1.3,.25],[-.75,1.3],[.85,1.3]];
    const landing = getLandingPoint();
    const farH = Math.tan(THREE.MathUtils.degToRad(24)) * 11;
    const destination = new THREE.Vector3((landing.x/innerWidth*2-1)*farH*camera.aspect, (1-landing.y/innerHeight*2)*farH, -3);
    haze.position.copy(destination);
    haze.position.z += .02;
    strips.forEach((strip,i) => {
      const [x,y] = entries[i];
      strip.curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x*w,y*h,2),
        new THREE.Vector3(x*w*.72 + destination.x*.15,y*h*.62 + destination.y*.15,.2),
        new THREE.Vector3(destination.x*.85+x*w*.13,destination.y*.8+y*h*.16+.25,-1.8),
        destination.clone().add(new THREE.Vector3(.035*Math.sin(i),.02*Math.cos(i),0)),
      ]);
    });
  };
  window.addEventListener('resize', resize);
  const onScroll = () => { if (active) resize(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  resize();
  let active = true;
  const p = new THREE.Vector3(), tangent = new THREE.Vector3();
  return {
    reset() { active = true; canvas.hidden = false; hazeMaterial.uniforms.opacity.value = 0; resize(); },
    update(elapsed, reduced) {
      if (!active) return;
      if (reduced || elapsed > 6.4) {
        canvas.hidden = true;
        renderer.clear();
        active = false;
        return;
      }
      hazeMaterial.uniforms.opacity.value = THREE.MathUtils.smoothstep(elapsed,1.6,3.7) * (1-THREE.MathUtils.smoothstep(elapsed,4.4,6.4)) * .48;
      strips.forEach(({ mesh, positions, curve }, i) => {
        // Establish long luminous lines, then send the tail toward the vanishing point.
        const tail = THREE.MathUtils.smoothstep(elapsed, 1.5 + i*.08, 4.8 + i*.08);
        mesh.material.uniforms.time.value = elapsed;
        mesh.material.uniforms.opacity.value = THREE.MathUtils.smoothstep(elapsed, 0, .85) * (1 - THREE.MathUtils.smoothstep(elapsed, 3.8, 5.5));
        for (let j = 0; j <= segments; j++) {
          const t = tail + (1-tail) * j/segments;
          curve.getPoint(t,p);
          curve.getTangent(t,tangent);
          const width = (1.55 * Math.pow(1-t, 1.8) + .022) * (.96 + .04*Math.sin(t*5+i));
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
      window.removeEventListener('scroll',onScroll);
      haze.geometry.dispose();
      hazeMaterial.dispose();
      strips.forEach(({mesh})=>{mesh.geometry.dispose();mesh.material.dispose();});
      renderer.dispose();
      canvas.remove();
    },
  };
}
