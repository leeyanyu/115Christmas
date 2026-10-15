import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRibbons } from './ribbons.js';
import { createTreeMotes } from './tree-motes.js';
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
  const ribbons = createRibbons(() => {
    const rect = canvas.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    controls.update();
    camera.updateMatrixWorld();
    // Project the actual tree base, including the orbit camera's current angle.
    const base = tree.root.localToWorld(new THREE.Vector3(0, .12, 0)).project(camera);
    return { x: rect.left + (base.x + 1) * rect.width / 2,
      y: rect.top + (1 - base.y) * rect.height / 2 };
  });
  const awakening = createAwakening(tree, onComplete, ribbons);
  awakening.start(0);
  const motes = createTreeMotes(scene);
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
  let sequenceStart = 0;
  let previous = performance.now();
  function animate(now) {
    frame = requestAnimationFrame(animate);
    const delta = Math.min((now - previous) / 1000, .25);
    previous = now;
    if (document.hidden) return;
    time += delta;
    controls.update();
    motes.update(time-sequenceStart, reducedMotion.matches);
    awakening.update(time, reducedMotion.matches);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    awaken: () => { sequenceStart = time; awakening.start(time); },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      ribbons.dispose();
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
