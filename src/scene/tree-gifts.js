import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { characterMaterial } from './holiday-character.js';

export function createTreeGifts(tree) {
  const root = new THREE.Group(); root.name = 'tree-gifts'; root.visible = false;
  tree.root.add(root);
  const box = new RoundedBoxGeometry(1, 1, 1, 2, .07);
  const bow = new THREE.TorusGeometry(.13, .025, 6, 16);
  const gold = characterMaterial({ color: 0xe0c28a, metalness: .45, roughness: .42 });
  const materials = [0xb98294, 0x91a897, 0xb9a1bd].map(color => characterMaterial({ color, roughness: .62, metalness: .08 }));
  const point = new THREE.Vector3(), roll = new THREE.Quaternion();
  const gifts = [
    { angle: -.58, size: .24, delay: .5 },
    { angle: .72, size: .22, delay: 1.25 },
    { angle: -1.02, size: .20, delay: 2 },
  ].map((settings, index) => {
    const group = new THREE.Group(); group.name = `small-gift-${index + 1}`; root.add(group);
    group.userData.holidayGift = true;
    function piece(geometry, material, x, y, z, sx, sy, sz) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
    }
    piece(box, materials[index], 0, -.08, 0, 1, .84, 1);
    piece(box, materials[index], 0, .395, 0, 1.06, .17, 1.06);
    piece(box, gold, 0, 0, 0, .095, 1.015, 1.085);
    piece(box, gold, 0, 0, 0, 1.085, 1.015, .095);
    for (const side of [-1, 1]) {
      const loop = piece(bow, gold, side * .105, .58, 0, 1, .8, 1); loop.rotation.z = side * -.5;
    }
    // Precompute support points so tumbling boxes and bows cannot sink into
    // the pedestal. This storage, geometry, and materials are reused on replay.
    const support = []; group.updateMatrixWorld(true);
    group.children.forEach(mesh => {
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) support.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrix));
    });
    return { ...settings, group, support, phase: 'entering', exitTime: 0, exitSteps: 0, exitCamera: null,
      exitFrom: new THREE.Vector3(), exitTo: new THREE.Vector3(), exitAxis: new THREE.Vector3(), exitRotation: new THREE.Quaternion(),
      axis: new THREE.Vector3(Math.cos(settings.angle), 0, -Math.sin(settings.angle)),
      resting: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index % 2 ? -.22 : .18),
    };
  });
  let elapsed = 0, reduced = false;
  function ground(gift) {
    let bottom = Infinity;
    for (const sample of gift.support) bottom = Math.min(bottom, point.copy(sample).applyQuaternion(gift.group.quaternion).y * gift.size);
    gift.group.scale.setScalar(gift.size);
    gift.group.position.y = .08 - bottom;
  }
  function place(gift, progress) {
    // Travel from the far side through the lower foliage, then emerge beneath
    // the tree. The foliage itself supplies the occlusion during this surprise.
    const t = 1 - (1 - progress) ** 3, radius = THREE.MathUtils.lerp(-2.6, 1.50, t);
    roll.setFromAxisAngle(gift.axis, -(radius - 1.50) / (gift.size * .55));
    gift.group.quaternion.copy(roll).multiply(gift.resting);
    gift.group.position.set(Math.sin(gift.angle) * radius, 0, Math.cos(gift.angle) * radius);
    ground(gift);
  }
  function planExit(gift, camera) {
    gift.exitFrom.copy(gift.group.position); gift.exitRotation.copy(gift.group.quaternion);
    if (camera) {
      camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true);
      point.copy(gift.group.position); tree.root.localToWorld(point); point.project(camera);
      // Preserve depth, so every short roll stays clear of a rush toward the lens.
      point.x = point.x < 0 ? -1.2 : 1.2; point.unproject(camera); tree.root.worldToLocal(point);
      gift.exitTo.copy(point);
    } else gift.exitTo.copy(gift.exitFrom).multiplyScalar(4);
    gift.exitTo.y = gift.exitFrom.y;
    gift.exitAxis.subVectors(gift.exitTo, gift.exitFrom); gift.exitAxis.y = 0;
    gift.exitAxis.set(-gift.exitAxis.z, 0, gift.exitAxis.x).normalize();
    gift.exitSteps = Math.max(1, Math.ceil(gift.exitFrom.distanceTo(gift.exitTo) / (gift.size * 1.3)));
    gift.exitTime = 0; gift.exitCamera = camera;
  }
  return {
    get isMoving() { return root.visible && gifts.some(gift => gift.phase === 'entering' || gift.phase === 'exiting'); },
    get targets() { return root.visible ? gifts.filter(gift => gift.phase === 'resting' && gift.group.visible).map(gift => gift.group) : []; },
    // Moving gifts still block rays, so a second tap cannot click the tree
    // through a present that is already on its way out.
    get hitTargets() { return root.visible ? gifts.filter(gift => gift.group.visible).map(gift => gift.group) : []; },
    tap(object, camera) {
      while (object && !object.userData.holidayGift) object = object.parent;
      const gift = gifts.find(item => item.group === object);
      if (!root.visible || !gift || gift.phase !== 'resting') return false;
      if (reduced) { gift.phase = 'gone'; gift.group.visible = false; return true; }
      planExit(gift, camera); gift.phase = 'exiting'; return true;
    },
    update(delta, ready, reducedMotion) {
      root.visible = ready; if (!ready) return;
      reduced = reducedMotion;
      elapsed = reducedMotion ? 5.2 : elapsed + delta;
      for (const gift of gifts) {
        if (gift.phase === 'gone') { gift.group.visible = false; continue; }
        if (gift.phase === 'exiting') {
          gift.exitTime += delta;
          // Each beat is one gentle quarter-turn, then a short grounded pause.
          // Wider screens add more beats instead of increasing launch speed.
          const beat = reducedMotion ? gift.exitSteps : Math.min(gift.exitSteps, gift.exitTime / .52);
          const step = Math.floor(beat), part = Math.min(1, (beat - step) / .65);
          const eased = part * part * part * (part * (part * 6 - 15) + 10);
          const advance = Math.min(1, (step + eased) / gift.exitSteps);
          gift.group.position.lerpVectors(gift.exitFrom, gift.exitTo, advance);
          roll.setFromAxisAngle(gift.exitAxis, gift.exitSteps * Math.PI / 2 * advance);
          gift.group.quaternion.copy(roll).multiply(gift.exitRotation); ground(gift);
          if (beat >= gift.exitSteps) {
            const camera = gift.exitCamera;
            if (camera && !reducedMotion) {
              camera.updateMatrixWorld(); tree.root.updateWorldMatrix(true, true);
              point.copy(gift.group.position); tree.root.localToWorld(point); point.project(camera);
              if (Math.abs(point.x) < 1.1 && Math.abs(point.y) < 1.1 && Math.abs(point.z) < 1) { planExit(gift, camera); continue; }
            }
            gift.phase = 'gone'; gift.group.visible = false;
          }
          continue;
        }
        gift.group.visible = reducedMotion || elapsed >= gift.delay;
        const progress = reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed - gift.delay) / 3.2, 0, 1);
        place(gift, progress);
        if (progress === 1) gift.phase = 'resting';
      }
    },
    reset() { elapsed = 0; root.visible = false; gifts.forEach(gift => { gift.phase = 'entering'; gift.exitTime = 0; gift.exitCamera = null; gift.group.visible = false; }); },
    dispose() { root.removeFromParent(); box.dispose(); bow.dispose(); gold.dispose(); materials.forEach(material => material.dispose()); },
  };
}
