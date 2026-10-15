import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTree } from './tree.js';
import { createAwakening } from './awakening.js';
import { createContentRoot } from '../integrations/content.js';

export function createWorld(canvas, onComplete) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 60);
  camera.position.set(6, 3.4, 8);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .06;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = .45;
  controls.minPolarAngle = Math.PI * .3;
  controls.maxPolarAngle = Math.PI * .56;
  controls.listenToKeyEvents(canvas);
  scene.add(new THREE.HemisphereLight(0xc6e4ff, 0x182b25, 2));
  const key = new THREE.DirectionalLight(0xffe0a3, 3.5);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x77b2d9, 2.4);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const contentRoot = createContentRoot();
  scene.add(contentRoot);
  const tree = createTree();
  contentRoot.add(tree.root);
  const awakening = createAwakening(tree, onComplete);
  const positions = new Float32Array(55 * 3);
  let seed = 2026;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 55; i++) {
    positions[i * 3] = (random() - .5) * 7;
    positions[i * 3 + 1] = random() * 5;
    positions[i * 3 + 2] = (random() - .5) * 5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xddbd76, size: .022, transparent: true, opacity: .65, depthWrite: false }));
  scene.add(dust);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resize = () => {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  window.addEventListener('resize', resize);
  resize();
  let frame;
  let time = 0;
  let previous = performance.now();
  function animate(now) {
    frame = requestAnimationFrame(animate);
    const delta = Math.min((now - previous) / 1000, .05);
    previous = now;
    if (document.hidden) return;
    time += delta;
    controls.update();
    if (!reducedMotion.matches) dust.rotation.y = time * .025;
    awakening.update(time, reducedMotion.matches);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    awaken: () => awakening.start(time),
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
      renderer.dispose();
    },
  };
}
