import { createDesignStage } from '../diy/design-stage.js';
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
import { createTreeGifts } from './tree-gifts.js';
import { createCampfireParty } from './campfire-party.js';
import { createTreeTheme } from './tree-theme.js';
import { createHiddenGoodness } from './hidden-goodness.js';
import { createContentRoot } from '../integrations/content.js';
import { createVisitorGreeting } from '../integrations/visitor-greeting.js';
import { createPalmLight } from './palm-light.js';

export function createWorld(canvas, onComplete, onStageStart, onRotation = () => {}, diyOptions = {}) {
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
  let manualControl = false;
  controls.addEventListener('start', () => { manualControl = true; });
  controls.addEventListener('end', () => { manualControl = false; });
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
  const gifts = createTreeGifts(tree);
  const visitors = createHolidayVisitors(tree, { onDrop: (kind, reduced) => {
    if (!reduced) {
      const message = kind === 'gingerbread' ? '哎呀！薑餅人跳下來了，等等還有誰會來呢？' : '拐杖糖也跳下來了！看看下一位聖誕訪客 ✧';
      document.querySelector('#status').textContent = message;
      if (window.innerWidth <= 700) gratitudePrompt.announce(message);
    }
  } });
  const treeTheme = createTreeTheme(tree);
  const hiddenGoodness = createHiddenGoodness({ tree, canvas, additionalOccluders: () => visitors.targets, onFound: ({ label, count }) => {
    const message = count === 3 ? '三好格致：好兒女、好學生、好國民。三份祝福，都化成天使了 ✧'
      : `你找到「${label}」的小天使了！三好祝福 ${count} / 3 ✧`;
    document.querySelector('#status').textContent = count === 3 ? '再次喚醒聖誕樹，就能重新尋找三好祝福 ✧'
      : '再放大、輕輕轉動，尋找枝葉間的另一份三好祝福 ✧';
    gratitudePrompt.announce(message);
  } });
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
  const guideDialog = document.querySelector('#interaction-guide');
  const gratitudePrompt = createGratitudePrompt(document.querySelector('#gratitude'), reducedMotion);
  const greeting = createTreeGreeting({ canvas, camera, tree, element: document.querySelector('#reveal') });
  const visitorGreeting = createVisitorGreeting({ canvas, visitors, element: document.querySelector('#visitor-greeting') });
  let celebration, campfire, designStage;
  const editorDialog = document.querySelector('#diy-editor');
  const gratitude = createGratitudeLight({ tree, onChange: state => {
    gratitudePrompt.show(state);
    if (state.phase === 'blooming') celebration?.start(reducedMotion.matches);
  } });
  const interaction = createTreeInteraction({ canvas, camera, controls, tree, scene, reducedMotion, isBlocked: () => stage.isMoving || designStage?.isMoving || editorDialog?.open,
    extraTargets: () => designStage?.targets || [],
    visitorTargets: () => [...visitors.targets, ...gifts.hitTargets, ...(campfire?.targets ?? [])],
    onVisitorTap: object => object.userData.campfireGuest ? campfire.tap(object) : object.userData.holidayGift ? gifts.tap(object, camera) : visitors.tap(object),
    onTreeTouch: () => { if (stage.isSettled) gratitude.touch(); },
    onReward: message => {
      document.querySelector('#status').textContent = message;
      if (window.innerWidth <= 700) gratitudePrompt.announce(message);
    } });
  const atmosphere = createRotationAtmosphere(canvas);
  let rotationDim = 0;
  const rotationGlow = createRotationGlow({ tree, controls, canvas, onGlow: strength => { rotationDim = strength; } });
  const palmLight = createPalmLight(tree, (navigator.hardwareConcurrency || 4) <= 4 ? 36 : 72);
  celebration = createTreeCelebration({ tree, canvas, controls, onStart: () => { campfire?.stop(); interaction.celebrate(); } });
  campfire = createCampfireParty({ tree, canvas, controls,
    canStart: camera => !palmLight.isPresent && !palmLight.isRotating && !palmLight.isFlowing && !gifts.isMoving && visitors.canGather(camera),
    onStart: () => {
      visitors.beginParty();
      const message = '聖誕營火晚會開始了！薑餅人與拐杖糖來跳舞 ✧';
      document.querySelector('#status').textContent = message;
      if (window.innerWidth <= 700) gratitudePrompt.announce(message);
    },
    onEnd: () => {
      visitors.endParty();
      document.querySelector('#status').textContent = '輕轉聖誕樹，等待下一份悄悄靠近的驚喜 ✧';
    },
    onSpark: () => interaction.starlight(),
  });
  designStage = createDesignStage({ tree, theme: treeTheme, scene, camera, controls, canvas, label: document.querySelector('#diy-distant'), onActivate: () => diyOptions.onActivate?.(), initial: diyOptions.initial });
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
    if (document.hidden || editorDialog?.open) return;
    time += delta;
    const ready = stage.isSettled && !designStage.isMoving;
    const handReady = ready && !manualControl && !celebration.isActive && !campfire.isActive && !guideDialog?.open;
    palmLight.rotate(delta, reducedMotion.matches, handReady);
    rotationGlow.beforeUpdate(delta, ready && !palmLight.isPresent && !palmLight.isRotating && !palmLight.isFlowing && !celebration.isActive && !campfire.isActive && !visitors.isPerforming, reducedMotion.matches);
    celebration.update(delta, ready, reducedMotion.matches);
    controls.update(delta);
    zoomOrbit.update(delta, reducedMotion.matches, ready);
    motes.update(time-sequenceStart, reducedMotion.matches);
    awakening.update(time, reducedMotion.matches);
    stage.update(time, reducedMotion.matches);
    // Any buffer allocation must be followed by a render in the same frame.
    syncRendererSize();
    campfire.update(delta, camera, ready, reducedMotion.matches, celebration.isActive);
    interaction.update(delta, renderer.getPixelRatio());
    rotationGlow.update(delta, reducedMotion.matches, renderer.getPixelRatio());
    onRotation(delta, stage.isSettled && rotationGlow.isTurning);
    treeTheme.update(delta, reducedMotion.matches);
    visitors.update(delta, camera, ready, reducedMotion.matches, !celebration.isActive && !guideDialog?.open);
    visitorGreeting.update(camera, ready && !celebration.isActive && !campfire.isActive && !guideDialog?.open);
    gifts.update(delta, ready, reducedMotion.matches);
    hiddenGoodness.update(delta, camera, ready && !celebration.isActive && !campfire.isActive && !guideDialog?.open, reducedMotion.matches, stage.zoomRatio);
    if (stage.isSettled) {
      gratitude.update(delta, reducedMotion.matches, renderer.getPixelRatio());
      palmLight.update(delta, reducedMotion.matches, renderer.getPixelRatio(), drawingSize.y, controls.getAzimuthalAngle());
      gratitudePrompt.update(delta);
      greeting.update();
    }
    atmosphere.update(rotationDim, palmLight.dimStrength);
    designStage.update(delta, stage.isSettled, reducedMotion.matches, stage.zoomRatio);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    applyDesign: (design, active) => { palmLight.reset(); campfire.reset(); visitors.reset(); gifts.reset(); celebration.reset(); rotationGlow.reset(); interaction.reset(); gratitude.reset(); designStage.apply(design, active); },
    canUseHands: () => stage.isSettled && !designStage.isMoving && !editorDialog?.open && !manualControl && !celebration.isActive && !campfire.isActive && !guideDialog?.open,
    setHandInput: input => palmLight.input(input, stage.isSettled && !designStage.isMoving && !editorDialog?.open && !manualControl && !celebration.isActive && !campfire.isActive && !guideDialog?.open),
    lightFromPalm: () => { if (!stage.isSettled) return false; palmLight.start(); interaction.starlight(2); return true; },
    setTheme: theme => { treeTheme.set(theme); if (theme === 'snow') interaction.snowfall(); },
    addVoiceEnergy: amount => stage.isSettled && gratitude.addEnergy(amount),
    setVoiceLevel: value => gratitude.setVoiceLevel(value),
    awaken: () => { designStage.reset(); controls.enabled = true; palmLight.reset(); visitorGreeting.reset(); hiddenGoodness.reset(); campfire.reset(); gifts.reset(); visitors.reset(); celebration.reset(); rotationGlow.reset(); interaction.reset(); gratitude.reset(); zoomOrbit.reset(); stage.reset(); requestResize(); sequenceStart = time; awakening.start(time); },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', requestResize);
      rotationGlow.dispose();
      palmLight.dispose();
      celebration.dispose();
      atmosphere.dispose();
      interaction.dispose();
      gratitude.dispose();
      gratitudePrompt.dispose();
      greeting.dispose();
      visitorGreeting.dispose();
      campfire.dispose();
      visitors.dispose();
      gifts.dispose();
      hiddenGoodness.dispose();
      designStage.dispose();
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
