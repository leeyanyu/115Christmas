import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeARTree } from './model.js';
import { createXRSession } from './xr-session.js';
import { readFloorHit, placeSpatialTree, spatialScale } from './xr-placement.js';

export function createWebXRTree({ overlay, canvas, url, onStatus, onError, onEnd, xr = navigator.xr }) {
  const get = id => overlay.querySelector(`#${id}`);
  const note = get('xr-note'), scale = get('xr-scale');
  const abort = new AbortController();
  let model, renderer, scene, environment, reticle, hitSource, placed = false, ready = false, disposed = false;
  let strength = 1, lastTouch, pinching = false, hadPinch = false, moved = false;
  const pointers = new Map(), hitMatrix = new THREE.Matrix4(), cameraPosition = new THREE.Vector3();
  function cleanup() {
    renderer?.setAnimationLoop(null); hitSource?.cancel(); hitSource = undefined;
    if (reticle) { reticle.geometry.dispose(); reticle.material.dispose(); }
    if (model) { scene?.remove(model); disposeARTree(model); model.visible = false; }
    environment?.dispose(); environment = undefined;
    renderer?.dispose(); renderer = undefined; scene = undefined; reticle = undefined;
    pointers.clear(); overlay.hidden = true;
    if (!disposed) onEnd();
  }
  const session = createXRSession({ xr, overlay, onEnd: cleanup, onError,
    async onStart(incoming, current) {
      showTools();
      overlay.hidden = false; placed = false; strength = 1; scale.value = '100';
      note.textContent = '慢慢移動手機，尋找地板或桌面…';
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
      renderer.setSize(innerWidth, innerHeight, false);
      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
      scene.environment = environment.texture; scene.environmentIntensity = .7;
      scene.add(new THREE.HemisphereLight(0xfff4df, 0x34434d, .7));
      const key = new THREE.DirectionalLight(0xffe6b9, 1.7); key.position.set(3, 5, 4); scene.add(key);
      reticle = new THREE.Mesh(new THREE.RingGeometry(.12, .15, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xeacb94, transparent: true, opacity: .8 }));
      reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
      model.visible = false; model.scale.setScalar(1); scene.add(model);
      await renderer.xr.setSession(incoming); if (!current()) return;
      const viewer = await incoming.requestReferenceSpace('viewer'); if (!current()) return;
      const source = await incoming.requestHitTestSource({ space: viewer });
      if (!current()) { source.cancel(); return; }
      hitSource = source;
      renderer.setAnimationLoop((time, frame) => {
        if (!frame || !renderer || !current()) return;
        if (!placed) {
          const found = readFloorHit(frame, hitSource, renderer.xr.getReferenceSpace(), hitMatrix);
          if (reticle.visible !== found) note.textContent = found ? '圓環找到地面了，輕點畫面放置聖誕樹' : '慢慢移動手機，尋找地板或桌面…';
          reticle.visible = found;
          if (found) reticle.matrix.copy(hitMatrix);
        }
        renderer.render(scene, camera);
      });
    } });
  function place() {
    if (!renderer || placed || !reticle?.visible) return;
    renderer.xr.getCamera().getWorldPosition(cameraPosition);
    placeSpatialTree(model, hitMatrix, cameraPosition); model.scale.setScalar(strength);
    placed = true; reticle.visible = false;
    note.textContent = '聖誕樹已放好，可移動手機取景；以手機截圖保存合照。';
  }
  function zoom(value) { strength = spatialScale(value); scale.value = String(Math.round(strength * 100)); if (model) model.scale.setScalar(strength); }
  function pairDistance() { const [a, b] = [...pointers.values()]; return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  function down(event) {
    if (event.target.closest('button,input,a')) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) { lastTouch = { x: event.clientX, y: event.clientY }; moved = false; hadPinch = false; }
    if (pointers.size >= 2) { pinching = true; hadPinch = true; lastTouch = pairDistance(); }
  }
  function move(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinching && pointers.size >= 2) { const distance = pairDistance(); if (lastTouch > 0) zoom(strength * distance / lastTouch); lastTouch = distance; }
    else if (!hadPinch && lastTouch && Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) > 8) moved = true;
  }
  function up(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size) { if (!hadPinch && !moved && event.type !== 'pointercancel') place(); pinching = false; }
  }
  function beforeSelect(event) { event.preventDefault(); } // DOM gestures own placement; no duplicate XR select.
  const scaled = () => zoom(+scale.value / 100);
  const reposition = () => { placed = false; if (model) model.visible = false; note.textContent = '慢慢移動手機，找到圓環後輕點重新放置。'; };
  const exit = () => session.stop();
  const clean = () => { overlay.classList.add('xr-clean'); get('xr-show-tools').hidden = false; };
  const showTools = () => { overlay.classList.remove('xr-clean'); get('xr-show-tools').hidden = true; };
  overlay.addEventListener('pointerdown', down); overlay.addEventListener('pointermove', move);
  overlay.addEventListener('pointerup', up); overlay.addEventListener('pointercancel', up);
  overlay.addEventListener('beforexrselect', beforeSelect);
  get('xr-exit').addEventListener('click', exit); get('xr-reposition').addEventListener('click', reposition);
  get('xr-clean').addEventListener('click', clean); get('xr-show-tools').addEventListener('click', showTools);
  scale.addEventListener('input', scaled);
  return { get ready() { return ready; }, get active() { return session.active; },
    async prepare() {
      if (!xr?.isSessionSupported || !await xr.isSessionSupported('immersive-ar')) return false;
      onStatus('正在準備瀏覽器的 3D 空間 AR…');
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error('聖誕樹模型下載失敗');
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), new URL('.', url).href);
      if (disposed) { disposeARTree(gltf.scene); return false; }
      model = gltf.scene; ready = true; return true;
    },
    start() { if (!ready || disposed) return; onStatus('正在啟動瀏覽器 3D 空間 AR，請允許空間追蹤與相機權限。'); return session.start(); },
    dispose() {
      disposed = true; ready = false; abort.abort();
      session.dispose().finally(cleanup);
      overlay.removeEventListener('pointerdown', down); overlay.removeEventListener('pointermove', move);
      overlay.removeEventListener('pointerup', up); overlay.removeEventListener('pointercancel', up);
      overlay.removeEventListener('beforexrselect', beforeSelect);
      get('xr-exit').removeEventListener('click', exit); get('xr-reposition').removeEventListener('click', reposition);
      get('xr-clean').removeEventListener('click', clean); get('xr-show-tools').removeEventListener('click', showTools);
      scale.removeEventListener('input', scaled);
    } };
}
