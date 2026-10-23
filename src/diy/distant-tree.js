import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDisplayTree } from './design-layer.js';
import { createTreeHandoff } from './tree-handoff.js';
import { createDepthStage } from './depth-stage.js';
import { createForestBackdrop } from './forest-backdrop.js';

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

export function createDistantTree({ scene, tree, camera, controls, canvas, onActivate, onTransition = () => {}, foregroundTargets = () => [], entrance }) {
  const backdrop = new THREE.Scene(), backdropCamera = camera.clone();
  scene.children.filter(o => o.isLight).forEach(light => backdrop.add(light.clone()));
  let root, moving = false, elapsed = 0, handoff, anchored = false, viewport = '', referenceDistance = 10, damping = controls.enableDamping;
  const far = new THREE.Vector3(), source = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
  const baseDirection = new THREE.Vector3(), backdropTarget = new THREE.Vector3(), mapping = new THREE.Matrix4();
  const sourceQuaternion = new THREE.Quaternion(), frontQuaternion = new THREE.Quaternion(), departingQuaternion = new THREE.Quaternion(), spin = new THREE.Quaternion(), axis = new THREE.Vector3(0, 1, 0);
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), mist = new THREE.Color(0x233d4a);
  const ground = createDepthStage(scene, backdrop);
  const forest = createForestBackdrop(backdrop);
  let enabled = false, down;
  function releaseControls() { controls.enabled = true; controls.enableDamping = damping; }
  function appearance(design, bare) {
    if (root) { root.removeFromParent(); dispose(root); }
    root = createDistantModel(design, bare); backdrop.add(root);
  }
  function anchor() {
    backdropCamera.aspect = camera.aspect; backdropCamera.updateProjectionMatrix();
    if (!anchored) { backdropTarget.copy(controls.target); baseDirection.copy(camera.position).sub(controls.target).normalize(); }
    backdropCamera.position.copy(backdropTarget).addScaledVector(baseDirection, referenceDistance);
    backdropCamera.lookAt(backdropTarget); backdropCamera.updateMatrixWorld();
    forward.copy(backdropTarget).sub(backdropCamera.position); forward.y = 0; forward.normalize();
    right.setFromMatrixColumn(backdropCamera.matrixWorld, 0); right.y = 0; right.normalize();
    const depth = Math.min(referenceDistance * 4.4, backdropCamera.far - 10);
    const side = depth * Math.tan(THREE.MathUtils.degToRad(backdropCamera.fov / 2)) * backdropCamera.aspect * (innerWidth <= 700 ? .56 : .64);
    far.set(backdropCamera.position.x, 0, backdropCamera.position.z).addScaledVector(forward, depth).addScaledVector(right, side);
    forest.place(far, right);
    anchored = true;
  }
  function finish() {
    moving = false; tree.root.position.set(0, 0, 0); tree.root.quaternion.copy(frontQuaternion);
    backdrop.add(root); root.position.copy(far); root.quaternion.identity(); releaseControls(); onTransition(false);
  }
  function start(event) { if (event.isPrimary === false) { down = null; return; } if (event.button === 0) down = { id: event.pointerId, x: event.clientX, y: event.clientY }; }
  function move(event) { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down = null; }
  function end(event) {
    const tap = down; down = null;
    if (!enabled || moving || !tap || tap.id !== event.pointerId || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 7) return;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true); root.updateWorldMatrix(true, true); ray.setFromCamera(pointer, camera);
    const near = [...tree.layers, ...tree.root.children.filter(o => o.isMesh && o.visible), ...foregroundTargets()];
    if (ray.intersectObjects(near, true).length) return;
    ray.setFromCamera(pointer, backdropCamera);
    if (ray.intersectObject(root, true).length) onActivate();
  }
  const cancel = () => { down = null; };
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointermove', move);
  return {
    get isMoving() { return moving; },
    appearance,
    renderBackdrop(renderer) { renderer.render(backdrop, backdropCamera); },
    swap(design, bare) {
      if (moving) return;
      const position = camera.position.clone(); damping = controls.enableDamping;
      controls.enableDamping = false; controls.enabled = false; controls.update?.();
      camera.position.copy(position); controls.update?.(); camera.updateMatrixWorld();
      // Camera-space conversion makes the first/last frames identical across
      // the fixed scenery camera and the independently controlled main camera.
      mapping.multiplyMatrices(camera.matrixWorld, backdropCamera.matrixWorldInverse);
      source.copy(far).applyMatrix4(mapping); sourceQuaternion.setFromRotationMatrix(mapping);
      departingQuaternion.copy(tree.root.quaternion);
      frontQuaternion.setFromAxisAngle(axis, Math.atan2(camera.position.x, camera.position.z));
      handoff = createTreeHandoff(camera, source);
      appearance(design, bare); scene.add(root); elapsed = 0; moving = true;
      tree.root.position.copy(source); tree.root.quaternion.copy(sourceQuaternion);
      if (entrance) entrance.hidden = true; onTransition(true);
    },
    reset() { moving = false; anchored = false; tree.root.position.set(0, 0, 0); tree.root.scale.setScalar(1); if (root) backdrop.add(root); releaseControls(); onTransition(false); },
    update(delta, ready, reducedMotion, zoomRatio = 1) {
      if (!root) return;
      root.visible = ready; enabled = false; if (entrance) entrance.hidden = !ready || moving;
      forest.setVisible(ready);
      if (!ready) { ground.update(false, tree.root.position, far, false); return; }
      const nextViewport = `${innerWidth}:${innerHeight}`;
      if (moving && nextViewport !== viewport) finish();
      if (!anchored || nextViewport !== viewport) { referenceDistance = camera.position.distanceTo(controls.target) * zoomRatio; anchor(); viewport = nextViewport; }
      let retreat = 1;
      if (moving) {
        elapsed += delta; const state = handoff.sample(elapsed, reducedMotion);
        tree.root.position.copy(state.incoming);
        tree.root.quaternion.slerpQuaternions(sourceQuaternion, frontQuaternion, state.enter).multiply(spin.setFromAxisAngle(axis, reducedMotion ? 0 : Math.PI * 2 * state.enter));
        root.position.copy(state.outgoing);
        const t = state.enter;
        root.quaternion.slerpQuaternions(departingQuaternion, sourceQuaternion, t).multiply(spin.setFromAxisAngle(axis, reducedMotion ? 0 : Math.PI * 2 * t));
        retreat = THREE.MathUtils.smoothstep(elapsed, 0, 1.2);
        if (state.done) finish();
      } else { root.position.copy(far); root.quaternion.identity(); }
      root.scale.setScalar(1); tree.root.scale.setScalar(1);
      root.traverse(o => { if (o.material?.userData.baseColor) {
        o.material.color.copy(o.material.userData.baseColor).lerp(mist, .38 * retreat).multiplyScalar(1 - .08 * retreat);
        if (o.material.emissive) o.material.emissiveIntensity = o.material.userData.baseEmissiveIntensity * (1 - .94 * retreat);
      } });
      enabled = !moving; ground.update(true, tree.root.position, far, !moving, moving ? root.position : null);
    },
    dispose() { canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointermove', move); ground.dispose(); forest.dispose(); if (moving) releaseControls(); if (root) { root.removeFromParent(); dispose(root); } backdrop.clear(); if (entrance) entrance.hidden = true; onTransition(false); },
  };
}
