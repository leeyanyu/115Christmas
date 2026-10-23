import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDisplayTree } from './design-layer.js';

function dispose(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => { if (m.map) textures.add(m.map); m.dispose(); }); textures.forEach(t => t.dispose());
}

// Bake the distant tree into a handful of draws instead of duplicating the
// animated invitation's actors, particles and hundreds of separate meshes.
export function createDistantModel(design, bare) {
  const { tree, layer } = createDisplayTree(design, { bare });
  tree.root.updateMatrixWorld(true);
  const batches = new Map(), output = new THREE.Group(); output.name = 'diy-distant-tree';
  tree.root.traverseVisible(o => {
    if (o.isLine) { const line = new THREE.Line(o.geometry.clone(), o.material.clone()); line.material.opacity = .2; line.applyMatrix4(o.matrixWorld); output.add(line); return; }
    if (!o.isMesh) return;
    const m = o.material;
    if (m.map) {
      const material = m.clone(); material.map = m.map.clone();
      material.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
      material.userData.baseColor = material.color.clone();
      output.add(new THREE.Mesh(o.geometry.clone().applyMatrix4(o.matrixWorld), material)); return;
    }
    const key = [m.type, m.color.getHex(), m.metalness, m.roughness, m.emissive?.getHex(), m.emissiveIntensity].join('-');
    if (!batches.has(key)) batches.set(key, { material: m.clone(), geometries: [] });
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    geometry.applyMatrix4(o.matrixWorld); batches.get(key).geometries.push(geometry);
  });
  for (const { material, geometries } of batches.values()) {
    output.add(new THREE.Mesh(mergeGeometries(geometries), material)); geometries.forEach(g => g.dispose());
    material.userData.baseColor = material.color.clone();
    material.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
  }
  layer.dispose(); dispose(tree.root);
  return output;
}

export function createDistantTree({ scene, tree, camera, controls, canvas, label, onActivate }) {
  let root, moving = false, elapsed = 0, fromAngle = 0, incomingAngle = 0, sourceScale = .4;
  const far = new THREE.Vector3(), from = new THREE.Vector3(), point = new THREE.Vector3(), direction = new THREE.Vector3(), right = new THREE.Vector3();
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), navy = new THREE.Color(0x233c46);
  let farScale = .4, enabled = false, down;
  function appearance(design, bare) {
    if (root) { scene.remove(root); dispose(root); }
    root = createDistantModel(design, bare); scene.add(root);
  }
  function start(event) { if (event.isPrimary === false) { down = null; return; } if (event.button === 0) down = { id: event.pointerId, x: event.clientX, y: event.clientY }; }
  function move(event) { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down = null; }
  function end(event) {
    const tap = down; down = null;
    if (!enabled || moving || !tap || tap.id !== event.pointerId || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 7) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(pointer, camera);
    const first = ray.intersectObjects([...tree.layers, tree.trunk, ...tree.animated.filter(o => o.visible), root], true)[0];
    let hit = first?.object;
    while (hit && hit !== root) hit = hit.parent;
    if (hit === root) onActivate();
  }
  const cancel = () => { down = null; };
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointermove', move);
  return {
    get isMoving() { return moving; },
    appearance,
    swap(design, bare) {
      if (moving) return;
      from.copy(far); sourceScale = farScale; fromAngle = tree.root.rotation.y;
      incomingAngle = Math.atan2(camera.position.x - from.x, camera.position.z - from.z);
      appearance(design, bare); elapsed = 0; moving = true; controls.enabled = false;
      tree.root.position.copy(from); tree.root.scale.setScalar(sourceScale); tree.root.rotation.y = incomingAngle;
      if (label) label.hidden = true;
    },
    reset() { moving = false; tree.root.position.set(0, 0, 0); tree.root.scale.setScalar(1); },
    update(delta, ready, reducedMotion, zoomRatio = 1) {
      if (!root) return;
      enabled = ready && zoomRatio < 1.6; root.visible = ready; if (label) label.hidden = !enabled || moving;
      if (!ready) return;
      camera.updateMatrixWorld();
      const distance = camera.position.distanceTo(controls.target) + 5;
      const x = innerWidth <= 700 ? .61 : .67;
      direction.set(x, .25, .5).unproject(camera).sub(camera.position).normalize();
      farScale = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (innerWidth <= 700 ? .27 : .34) / 4.4;
      far.copy(camera.position).addScaledVector(direction, distance); far.y -= 2.05 * farScale;
      let progress = 1;
      if (moving) {
        elapsed += delta; const t = reducedMotion ? 1 : Math.min(1, elapsed / 3);
        progress = ease(t);
        // Two separate arcs keep the incoming and outgoing silhouettes apart.
        const enter = ease(Math.max(0, (t - .10) / .90));
        const leave = ease(Math.min(1, t / .85));
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        tree.root.position.copy(from).multiplyScalar(1 - enter).addScaledVector(right, Math.sin(enter * Math.PI) * .35);
        tree.root.scale.setScalar(THREE.MathUtils.lerp(sourceScale, 1, enter));
        const front = Math.atan2(camera.position.x, camera.position.z);
        tree.root.rotation.y = incomingAngle + wrapped(front - incomingAngle) * enter + (reducedMotion ? 0 : Math.PI * 2 * progress);
        root.position.copy(far).multiplyScalar(leave).addScaledVector(right, -Math.sin(leave * Math.PI) * (innerWidth <= 700 ? .7 : 1.1));
        root.scale.setScalar(THREE.MathUtils.lerp(1, farScale, leave));
        const facing = Math.atan2(camera.position.x - far.x, camera.position.z - far.z);
        root.rotation.y = fromAngle + wrapped(facing - fromAngle) * leave + (reducedMotion ? 0 : Math.PI * 2 * leave);
        if (t === 1) { moving = false; controls.enabled = true; tree.root.position.set(0, 0, 0); tree.root.scale.setScalar(1); }
      } else {
        root.position.copy(far); root.scale.setScalar(farScale);
        root.rotation.y = Math.atan2(camera.position.x - far.x, camera.position.z - far.z);
      }
      root.traverse(o => { if (o.material?.userData.baseColor) {
        o.material.color.copy(o.material.userData.baseColor).lerp(navy, .52 * progress).multiplyScalar(1 - .35 * progress);
        if (o.material.emissive) o.material.emissiveIntensity = o.material.userData.baseEmissiveIntensity * (1 - .85 * progress);
      } });
      if (label && enabled && !moving) {
        point.copy(far).project(camera); const rect = canvas.getBoundingClientRect();
        const w = Math.min(label.offsetWidth || 150, innerWidth - 24);
        label.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, rect.left + (point.x + 1) * rect.width / 2 - w / 2))}px`;
        label.style.top = `${Math.max(140, Math.min(innerHeight - 165, rect.top + (1 - point.y) * rect.height / 2 + 10))}px`;
      }
    },
    dispose() { canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointermove', move); if (root) { scene.remove(root); dispose(root); } if (label) label.hidden = true; },
  };
}
