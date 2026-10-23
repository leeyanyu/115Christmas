import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeARTree } from './model.js';

export async function createPhotoTree(canvas, url, { signal } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .1, 30);
  camera.position.z = 5;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = .7;
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x34434d, .7));
  const key = new THREE.DirectionalLight(0xffe6b9, 1.7); key.position.set(3, 5, 4); scene.add(key);
  const placement = new THREE.Group(); scene.add(placement);
  let root, disposed = false, width = 1, height = 1;
  const size = new THREE.Vector3();
  function draw() { if (!disposed && root) renderer.render(scene, camera); }
  function resize(w, h) {
    width = Math.max(1, w); height = Math.max(1, h);
    camera.left = -width / height / 2; camera.right = width / height / 2; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); draw();
  }
  function setPlacement(value) {
    placement.scale.setScalar(value.height / size.y);
    placement.position.set((value.x - .5) * width / height, .5 - value.y, 0); draw();
  }
  function dispose() {
    if (disposed) return; disposed = true;
    if (root) disposeARTree(root);
    environment.dispose(); renderer.dispose(); signal?.removeEventListener('abort', dispose);
  }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) { dispose(); throw new DOMException('Cancelled', 'AbortError'); }
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('聖誕樹載入失敗，請確認網路後重試。');
    root = (await new GLTFLoader().parseAsync(await response.arrayBuffer(), new URL('.', url).href)).scene;
    if (disposed) { disposeARTree(root); throw new DOMException('Cancelled', 'AbortError'); }
    root.rotation.x = .14; // Fixed view that keeps the GJ inlay visible.
    const bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
    bounds.getSize(size); root.position.x -= center.x; root.position.y -= bounds.min.y;
    placement.add(root);
    return { resize, setPlacement, ratio: size.x / size.y, dispose,
      drawOn(context, w, h) {
        // Render and copy in the same task; no preserved WebGL framebuffer needed.
        const pixelRatio = renderer.getPixelRatio();
        try { renderer.setPixelRatio(1); renderer.setSize(w, h, false); draw(); context.drawImage(canvas, 0, 0, w, h); }
        finally { renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false); draw(); }
      } };
  } catch (error) { dispose(); throw error; }
}
