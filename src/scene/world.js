import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRibbons } from './ribbons.js';
import { createTreeMotes } from './tree-motes.js';
import { createStage } from './stage.js';
import { createTreeInteraction } from './tree-interaction.js';
import { createRotationAtmosphere } from './rotation-atmosphere.js';
import { createRotationGlow } from './rotation-glow.js';
import { createTree } from './tree.js';
import { createAwakening } from './awakening.js';
import { createContentRoot } from '../integrations/content.js';

export function createWorld(canvas, onComplete, onStageStart) {
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
  controls.zoomSpeed = .65;
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
  const stage = createStage(canvas, camera, controls, tree, onStageStart, onComplete);
  const awakening = createAwakening(tree, () => stage.start(time), ribbons);
  awakening.start(0);
  const motes = createTreeMotes(scene);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interaction = createTreeInteraction({ canvas, camera, controls, tree, scene, reducedMotion, isBlocked: () => stage.isMoving, onReward: message => { document.querySelector('#status').textContent = message; } });
  const atmosphere = createRotationAtmosphere(canvas);
  const rotationGlow = createRotationGlow({ tree, controls, canvas, onGlow: atmosphere.update });
  let resizePending = true;
  const drawingSize = new THREE.Vector2();
  // Observers run after animation callbacks. Never resize/clear a WebGL buffer
  // here: it could erase a frame that has already been drawn for presentation.
  const requestResize = () => { resizePending = true; };
  const syncRendererSize = () => {
    if (!resizePending && !stage.isMoving) return;
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    // Allocate the final-size buffer once for the whole turn. CSS moves/scales
    // its presentation while the camera follows the displayed aspect ratio.
    const drawWidth = Math.round(stage.isMoving ? innerWidth : width);
    const drawHeight = Math.round(stage.isMoving ? innerHeight : height);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.75);
    renderer.getSize(drawingSize);
    if (drawingSize.x !== drawWidth || drawingSize.y !== drawHeight || renderer.getPixelRatio() !== pixelRatio) {
      renderer.setDrawingBufferSize(drawWidth, drawHeight, pixelRatio);
    }
    const aspect = width / height;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    if (resizePending) stage.resize();
    resizePending = false;
  };
  const observer = new ResizeObserver(requestResize);
  observer.observe(canvas.parentElement);
  window.addEventListener('resize', requestResize);
  syncRendererSize();
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
    rotationGlow.beforeUpdate(delta, stage.isSettled, reducedMotion.matches);
    controls.update(delta);
    motes.update(time-sequenceStart, reducedMotion.matches);
    awakening.update(time, reducedMotion.matches);
    stage.update(time, reducedMotion.matches);
    // Any buffer allocation must be followed by a render in the same frame.
    syncRendererSize();
    interaction.update(delta, renderer.getPixelRatio());
    rotationGlow.update(delta, reducedMotion.matches, renderer.getPixelRatio());
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    awaken: () => { rotationGlow.reset(); interaction.reset(); stage.reset(); requestResize(); sequenceStart = time; awakening.start(time); },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', requestResize);
      rotationGlow.dispose();
      atmosphere.dispose();
      interaction.dispose();
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
