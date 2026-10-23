import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeARTree } from './model.js';

// Static, on-demand preview of the same GLB sent to the system AR viewer.
// No invitation animation loop, actors, microphone or camera recognition.
export async function createARPreview(canvas, url, { signal } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .01, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = false;
  controls.minPolarAngle = Math.PI * .22; controls.maxPolarAngle = Math.PI * .53;
  controls.rotateSpeed = .6;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .7;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x34434d, .7));
  const light = new THREE.DirectionalLight(0xffe6b9, 1.7);
  light.position.set(3, 5, 4); scene.add(light);
  let root, disposed = false, frame;
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  function draw() { if (!disposed && root) renderer.render(scene, camera); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || disposed) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    if (root) {
      const vertical = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const distance = Math.max(vertical, size.x / camera.aspect / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.4;
      camera.position.set(center.x, center.y + distance * .12, center.z + distance);
      controls.target.copy(center); controls.minDistance = distance * .4; controls.maxDistance = distance * 2.5;
      camera.lookAt(center);
    }
    camera.updateProjectionMatrix(); controls.update(); draw();
  }
  const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(resize); });
  observer.observe(canvas); controls.addEventListener('change', draw);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
    if (root) disposeARTree(root);
    environment.dispose(); renderer.dispose();
    signal?.removeEventListener('abort', dispose);
  }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) { dispose(); throw new DOMException('Cancelled', 'AbortError'); }
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('無法載入聖誕樹');
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), url.startsWith('blob:') ? '' : new URL('.', url).href);
    root = gltf.scene;
    if (disposed) { disposeARTree(root); throw new DOMException('Cancelled', 'AbortError'); }
    new THREE.Box3().setFromObject(root).getSize(size);
    new THREE.Box3().setFromObject(root).getCenter(center);
    scene.add(root); resize();
    return { dispose };
  } catch (error) { dispose(); throw error; }
}
