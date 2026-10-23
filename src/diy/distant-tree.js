import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDisplayTree } from './design-layer.js';
import { createTreeHandoff } from './tree-handoff.js';
import { createDepthStage } from './depth-stage.js';

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

export function createDistantTree({ scene, tree, camera, controls, canvas, onActivate, onTransition = () => {}, foregroundTargets = () => [] }) {
  let root, moving = false, elapsed = 0, handoff, anchored = false, viewport = '', referenceDistance = 10;
  let damping = controls.enableDamping;
  const far = new THREE.Vector3(), projection = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), mist = new THREE.Color(0x233d4a);
  const ground = createDepthStage(scene);
  let enabled = false, down;
  function releaseControls() { controls.enabled = true; controls.enableDamping = damping; }
  function appearance(design, bare) {
    if (root) { scene.remove(root); dispose(root); }
    root = createDistantModel(design, bare); scene.add(root);
  }
  function anchor() {
    camera.updateMatrixWorld();
    forward.copy(controls.target).sub(camera.position); forward.y = 0; forward.normalize();
    right.setFromMatrixColumn(camera.matrixWorld, 0); right.y = 0; right.normalize();
    const depth = Math.min(referenceDistance * 4.4, camera.far - 10);
    const side = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * (innerWidth <= 700 ? .79 : .70);
    far.set(camera.position.x, 0, camera.position.z).addScaledVector(forward, depth).addScaledVector(right, side);
    anchored = true;
  }
  function inBackground(position) {
    camera.getWorldDirection(forward);
    const depth = projection.copy(position).sub(camera.position).dot(forward);
    const front = controls.target.distanceTo(camera.position);
    return depth > front + 3 && depth < camera.far + 6;
  }
  function start(event) { if (event.isPrimary === false) { down = null; return; } if (event.button === 0) down = { id: event.pointerId, x: event.clientX, y: event.clientY }; }
  function move(event) { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down = null; }
  function end(event) {
    const tap = down; down = null;
    if (!enabled || moving || !tap || tap.id !== event.pointerId || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 7) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true); root.updateWorldMatrix(true, true); ray.setFromCamera(pointer, camera);
    const near = [...tree.layers, ...tree.root.children.filter(o => o.isMesh && o.visible), ...foregroundTargets()];
    const first = ray.intersectObjects([...near, root], true)[0];
    let hit = first?.object; while (hit && hit !== root) hit = hit.parent;
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
      // Clear queued orbit inertia while retaining the exact displayed camera.
      const position = camera.position.clone(); damping = controls.enableDamping;
      controls.enableDamping = false; controls.enabled = false; controls.update?.();
      camera.position.copy(position); controls.update?.(); camera.updateMatrixWorld();
      const projectedX = projection.copy(far).project(camera).x;
      if (!anchored || !inBackground(far) || Math.abs(projectedX) > 1.1) anchor();
      handoff = createTreeHandoff(camera, far, tree.root.rotation.y);
      appearance(design, bare); elapsed = 0; moving = true; controls.enabled = false;
      const initial = handoff.sample(0); tree.root.position.copy(initial.incoming); tree.root.scale.setScalar(1); tree.root.rotation.y = initial.incomingAngle;
      onTransition(true);
    },
    reset() { moving = false; anchored = false; tree.root.position.set(0, 0, 0); tree.root.scale.setScalar(1); releaseControls(); onTransition(false); },
    update(delta, ready, reducedMotion, zoomRatio = 1) {
      if (!root) return;
      root.visible = ready; enabled = false;
      if (!ready) { ground.update(false, tree.root.position, far, false); return; }
      camera.updateMatrixWorld();
      const nextViewport = `${innerWidth}:${innerHeight}`;
      if (moving && nextViewport !== viewport) {
        moving = false; tree.root.position.set(0, 0, 0); tree.root.rotation.y = Math.atan2(camera.position.x, camera.position.z);
        anchored = false; releaseControls(); onTransition(false);
      }
      if (!anchored || (!moving && nextViewport !== viewport)) {
        referenceDistance = camera.position.distanceTo(controls.target) * zoomRatio; anchor(); viewport = nextViewport;
      }
      let retreat = 1;
      if (moving) {
        elapsed += delta; const state = handoff.sample(elapsed, reducedMotion);
        tree.root.position.copy(state.incoming); tree.root.rotation.y = state.incomingAngle;
        root.position.copy(state.outgoing); root.rotation.y = state.outgoingAngle;
        retreat = THREE.MathUtils.smoothstep(elapsed, 0, 1.2);
        if (state.done) { moving = false; releaseControls(); tree.root.position.set(0, 0, 0); onTransition(false); }
      } else { root.position.copy(far); }
      root.scale.setScalar(1); tree.root.scale.setScalar(1);
      // Atmospheric perspective affects only the distant tree, preserving the
      // foreground's original foliage, lights and invitation colors.
      root.traverse(o => { if (o.material?.userData.baseColor) {
        o.material.color.copy(o.material.userData.baseColor).lerp(mist, .68 * retreat).multiplyScalar(1 - .20 * retreat);
        if (o.material.emissive) o.material.emissiveIntensity = o.material.userData.baseEmissiveIntensity * (1 - .94 * retreat);
      } });
      if (!moving) root.visible = inBackground(far);
      enabled = !moving && root.visible && zoomRatio < 1.6;
      ground.update(true, tree.root.position, root.position, root.visible);
    },
    dispose() { canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointermove', move); ground.dispose(); if (moving) releaseControls(); if (root) { scene.remove(root); dispose(root); } onTransition(false); },
  };
}
