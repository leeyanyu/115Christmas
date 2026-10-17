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
import { createZoomOrbit } from './zoom-orbit.js';
import { createGratitudeLight } from './gratitude-light.js';
import { createGratitudePrompt } from '../integrations/gratitude-prompt.js';
import { createTreeGreeting } from './tree-greeting.js';
import { createTreeCelebration } from './tree-celebration.js';
import { createHolidayVisitors } from './holiday-visitors.js';
import { createTreeTheme } from './tree-theme.js';
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
  // Two fingers can change distance and viewing angle in one continuous move.
  // Desktop users get the same combined motion by dragging while scrolling.
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.minPolarAngle = Math.PI * .3;
  controls.maxPolarAngle = Math.PI * .56;
  controls.listenToKeyEvents(canvas);
  const zoomOrbit = createZoomOrbit({ canvas, camera, controls });
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
  const visitors = createHolidayVisitors(tree, { onDrop: (kind, reduced) => {
    if (!reduced) {
      const message = kind === 'gingerbread' ? '哎呀！薑餅人跳下來了，等等還有誰會來呢？' : '拐杖糖也跳下來了！看看下一位聖誕訪客 ✧';
      document.querySelector('#status').textContent = message;
      if (window.innerWidth <= 700) gratitudePrompt.announce(message);
    }
  } });
  const treeTheme = createTreeTheme(tree);
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
  const gratitudePrompt = createGratitudePrompt(document.querySelector('#gratitude'), reducedMotion);
  const greeting = createTreeGreeting({ canvas, camera, tree, element: document.querySelector('#reveal') });
  let celebration;
  const gratitude = createGratitudeLight({ tree, onChange: state => {
    gratitudePrompt.show(state);
    if (state.phase === 'blooming') celebration?.start(reducedMotion.matches);
  } });
  const interaction = createTreeInteraction({ canvas, camera, controls, tree, scene, reducedMotion, isBlocked: () => stage.isMoving,
    visitorTargets: () => visitors.targets, onVisitorTap: object => visitors.tap(object),
    onTreeTouch: () => { if (stage.isSettled) gratitude.touch(); },
    onReward: message => {
      document.querySelector('#status').textContent = message;
      if (window.innerWidth <= 700) gratitudePrompt.announce(message);
    } });
  const atmosphere = createRotationAtmosphere(canvas);
  const rotationGlow = createRotationGlow({ tree, controls, canvas, onGlow: atmosphere.update });
  celebration = createTreeCelebration({ tree, canvas, controls, onStart: () => interaction.celebrate() });
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
    rotationGlow.beforeUpdate(delta, stage.isSettled && !celebration.isActive && !visitors.isPerforming, reducedMotion.matches);
    celebration.update(delta, stage.isSettled, reducedMotion.matches);
    controls.update(delta);
    zoomOrbit.update(delta, reducedMotion.matches, stage.isSettled);
    motes.update(time-sequenceStart, reducedMotion.matches);
    awakening.update(time, reducedMotion.matches);
    stage.update(time, reducedMotion.matches);
    // Any buffer allocation must be followed by a render in the same frame.
    syncRendererSize();
    interaction.update(delta, renderer.getPixelRatio());
    rotationGlow.update(delta, reducedMotion.matches, renderer.getPixelRatio());
    treeTheme.update(delta, reducedMotion.matches);
    visitors.update(delta, camera, stage.isSettled, reducedMotion.matches);
    if (stage.isSettled) {
      gratitude.update(delta, reducedMotion.matches, renderer.getPixelRatio());
      gratitudePrompt.update(delta);
      greeting.update();
    }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    setTheme: theme => { treeTheme.set(theme); if (theme === 'snow') interaction.snowfall(); },
    addVoiceEnergy: amount => stage.isSettled && gratitude.addEnergy(amount),
    setVoiceLevel: value => gratitude.setVoiceLevel(value),
    awaken: () => { visitors.reset(); celebration.reset(); rotationGlow.reset(); interaction.reset(); gratitude.reset(); zoomOrbit.reset(); stage.reset(); requestResize(); sequenceStart = time; awakening.start(time); },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', requestResize);
      rotationGlow.dispose();
      celebration.dispose();
      atmosphere.dispose();
      interaction.dispose();
      gratitude.dispose();
      gratitudePrompt.dispose();
      greeting.dispose();
      visitors.dispose();
      treeTheme.dispose();
      zoomOrbit.dispose();
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
