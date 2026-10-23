import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createDisplayTree } from './design-layer.js';
import { MAX_ORNAMENTS } from './design.js';

export function createEditorScene(canvas, { design, onChange, onSelect, onNotice }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(37, 1, .1, 60);
  const { tree, layer } = createDisplayTree(design); scene.add(tree.root);
  scene.add(new THREE.HemisphereLight(0xc6e4ff, 0x182b25, 2));
  const key = new THREE.DirectionalLight(0xffe0a3, 3.5); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x77b2d9, 2.4); rim.position.set(-4, 3, -3); scene.add(rim);
  const controls = new OrbitControls(camera, canvas); controls.target.set(0, 2, 0); controls.enablePan = false;
  controls.minPolarAngle = Math.PI * .25; controls.maxPolarAngle = Math.PI * .62; controls.rotateSpeed = .6;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), normalMatrix = new THREE.Matrix3();
  let current = design, tool = 'view', color = '#eacb94', size = 1, selected, down, frame, disposed = false;
  const render = () => { if (!frame && !disposed) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); }); };
  controls.addEventListener('change', render);
  function resize() {
    const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    const distance = Math.max(8.8, 2.1 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect);
    camera.position.set(0, 2 + distance * .16, distance); controls.minDistance = distance * .65; controls.maxDistance = distance * 1.5; controls.update(); render();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function hit(event, objects) {
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    tree.root.updateMatrixWorld(true); camera.updateMatrixWorld(); ray.setFromCamera(pointer, camera); return ray.intersectObjects(objects, true)[0];
  }
  function ornamentAt(event) {
    let object = hit(event, layer.targets)?.object;
    while (object && !object.userData.designId) object = object.parent;
    return object?.userData.designId;
  }
  function surface(event) {
    const contact = hit(event, tree.layers); if (!contact) return null;
    const normal = contact.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(contact.object.matrixWorld)).normalize();
    const position = tree.root.worldToLocal(contact.point.clone().addScaledVector(normal, .075));
    normal.transformDirection(tree.root.matrixWorld.clone().invert());
    return { position: position.toArray(), normal: normal.toArray() };
  }
  function start(event) {
    if (event.isPrimary === false) { down = null; return; }
    if (event.button !== 0 || tool === 'view') return;
    const id = ornamentAt(event); down = { id, x: event.clientX, y: event.clientY, moved: false, pointer: event.pointerId, surface: null };
    canvas.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!down || down.pointer !== event.pointerId) return;
    down.moved ||= Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7;
    if (down.moved && down.id && tool !== 'remove') {
      const contact = surface(event); if (!contact) return;
      down.surface = contact;
      const preview = { ...current, ornaments: current.ornaments.map(o => o.id === down.id ? { ...o, ...contact } : o) }; layer.apply(preview); layer.select(down.id); render();
    }
  }
  function end(event) {
    const tap = down; down = null; if (!tap || tap.pointer !== event.pointerId) return;
    if (tap.moved) { if (tap.surface) { onChange({ ...current, ornaments: current.ornaments.map(o => o.id === tap.id ? { ...o, ...tap.surface } : o) }); onSelect(tap.id); } else { layer.apply(current); render(); } return; }
    if (tap.id) {
      if (tool === 'remove') onChange({ ...current, ornaments: current.ornaments.filter(o => o.id !== tap.id) });
      else { selected = tap.id; layer.select(selected); onSelect(selected); render(); }
      return;
    }
    if (tool === 'remove') return;
    const contact = surface(event); if (!contact) return;
    if (current.ornaments.length >= MAX_ORNAMENTS) { onNotice('最多放置 36 件裝飾，可以先移除或調整現有裝飾。'); return; }
    const id = Math.max(0, ...current.ornaments.map(o => o.id)) + 1; selected = id;
    onChange({ ...current, ornaments: [...current.ornaments, { id, type: tool, color, size, ...contact }] }); onSelect(id);
  }
  const cancel = () => { down = null; layer.apply(current); render(); };
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', cancel);
  resize();
  return {
    apply(value) { current = value; layer.apply(value); layer.select(selected); render(); },
    select(id) { selected = id; layer.select(id); render(); },
    configure(nextTool, nextColor, nextSize) { tool = nextTool; color = nextColor; size = nextSize; controls.enabled = tool === 'view'; },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', cancel);
      layer.dispose(); const geometries = new Set(), materials = new Set(); tree.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
