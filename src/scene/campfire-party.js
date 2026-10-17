import * as THREE from 'three';
import { createHolidayCharacter } from './holiday-character.js';

const duration = 11;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

export function createCampfireParty({ tree, canvas, controls, capacity = 4, random = Math.random,
  canStart = () => true, onStart = () => {}, onEnd = () => {}, onSpark = () => {},
  activityTarget = window, visibilityTarget = document }) {
  const root = new THREE.Group(); root.name = 'campfire-party'; root.visible = false;
  tree.root.add(root);
  const warmth = new THREE.PointLight(0xffcb8b, 0, 5, 2); warmth.name = 'campfire-warmth'; warmth.position.y = .7; root.add(warmth);
  const point = new THREE.Vector3(), localCamera = new THREE.Vector3(), rotation = new THREE.Matrix4();
  const count = capacity >= 4 ? 4 : 2;
  const guests = Array.from({ length: count }, (_, index) => {
    const model = createHolidayCharacter(index % 2 ? 'candy-cane' : 'gingerbread'); model.dress(index);
    model.root.name = `campfire-guest-${index + 1}`; model.root.userData.campfireGuest = true; root.add(model.root);
    const materials = new Set(); model.root.traverse(mesh => {
      if (mesh.material) { materials.add(mesh.material); mesh.material.transparent = true; mesh.material.depthWrite = false; mesh.material.opacity = 0; }
    });
    model.body.computeBoundingBox(); const bounds = model.body.boundingBox.clone(); bounds.min.y = Math.min(bounds.min.y, -.43);
    const support = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) support.push(new THREE.Vector3(x, y, z));
    return { model, materials, support, offset: (index % 2 ? .72 : -.72) + (index >= 2 ? Math.PI : 0), cheer: 0 };
  });
  let active = false, stopping = false, elapsed = 0, stopTime = 0, held = false, suspended = 0;
  let heading = 0, startAngle = 0, nextSpark = 1, sparkCooldown = 0, wait = 18 + random() * 14;
  const hold = () => { held = true; };
  const release = () => { held = false; suspended = .65; };
  const wheel = () => { suspended = .8; };
  function finish() {
    const wasActive = active;
    active = stopping = false; root.visible = false; warmth.intensity = 0;
    wait = 70 + random() * 50;
    if (wasActive) onEnd();
  }
  function stop() { if (active && !stopping) { stopping = true; stopTime = 0; } }
  const visibility = () => { if (visibilityTarget.hidden) finish(); held = false; };
  const blur = () => { finish(); held = false; };
  canvas.addEventListener('pointerdown', hold);
  canvas.addEventListener('wheel', wheel, { passive: true });
  controls.addEventListener('start', hold); controls.addEventListener('end', release);
  activityTarget.addEventListener('pointerup', release); activityTarget.addEventListener('pointercancel', release);
  activityTarget.addEventListener('blur', blur); visibilityTarget.addEventListener('visibilitychange', visibility);

  function fits(camera) {
    // Wait when zoomed in; the surprise must never pull the camera away.
    const radius = camera.aspect < 1.1 ? 2.35 : 2.45;
    tree.root.updateWorldMatrix(true, false); camera.updateMatrixWorld();
    for (let i = 0; i < 8; i++) {
      point.set(Math.sin(i * Math.PI / 4) * radius, .4, Math.cos(i * Math.PI / 4) * radius);
      tree.root.localToWorld(point); point.project(camera);
      if (Math.abs(point.x) > 1.08 || Math.abs(point.y) > 1.08 || Math.abs(point.z) > 1) return false;
    }
    return true;
  }
  function begin(camera) {
    active = root.visible = true; stopping = false; elapsed = stopTime = sparkCooldown = 0; nextSpark = 1;
    startAngle = tree.root.rotation.y;
    localCamera.copy(camera.position); tree.root.worldToLocal(localCamera); heading = Math.atan2(localCamera.x, localCamera.z);
    guests.forEach(guest => { guest.cheer = 0; guest.materials.forEach(material => { material.opacity = 0; }); });
    onStart();
  }
  return {
    get isActive() { return active; },
    get targets() { return active ? guests.filter(guest => guest.model.root.visible).map(guest => guest.model.root) : []; },
    tap(object) {
      while (object && !object.userData.campfireGuest) object = object.parent;
      const guest = guests.find(item => item.model.root === object);
      if (!active || stopping || !guest) return false;
      guest.cheer = .65;
      if (sparkCooldown <= 0) { onSpark(); sparkCooldown = 1.2; }
      return true;
    },
    update(delta, camera, ready, reducedMotion, blocked = false) {
      suspended = Math.max(0, suspended - delta);
      if (!ready || reducedMotion || visibilityTarget.hidden) { if (active) finish(); return; }
      if (!active) {
        if (blocked || held || suspended > 0) return;
        wait = Math.max(0, wait - delta);
        if (wait > 0 || !canStart(camera) || !fits(camera)) return;
        begin(camera);
      }
      if (blocked) stop();
      const previous = elapsed; elapsed = Math.min(duration, elapsed + delta);
      if (stopping) stopTime += delta;
      if (!stopping && !held && suspended <= 0) tree.root.rotation.y += (ease(elapsed / duration) - ease(previous / duration)) * Math.PI * 2;
      const envelope = Math.min(1, elapsed / 1.1, (duration - elapsed) / 1.1, stopping ? 1 - stopTime : 1);
      const strength = Math.max(0, envelope);
      warmth.intensity = strength * (1.15 + .12 * Math.sin(elapsed * 2));
      tree.root.updateWorldMatrix(true, false); localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
      const size = (camera.aspect < 1.1 ? .55 : .58) * (.92 + .08 * strength);
      const radius = camera.aspect < 1.1 ? 2.08 : 2.12;
      const turn = tree.root.rotation.y - startAngle;
      for (let index = 0; index < guests.length; index++) {
        const guest = guests[index], dancer = guest.model.root;
        const angle = heading + guest.offset + ease(elapsed / duration) * Math.PI * 1.8 - turn;
        const beat = elapsed * Math.PI * 2 / .7 + index * 1.1;
        const hop = (1 - Math.cos(beat)) * .5;
        guest.cheer = Math.max(0, guest.cheer - delta);
        const cheer = Math.sin(guest.cheer / .65 * Math.PI) * .13;
        const distance = radius + Math.sin(beat) * .012;
        dancer.position.set(Math.sin(angle) * distance, 0, Math.cos(angle) * distance);
        dancer.rotation.set(0, Math.atan2(localCamera.x - dancer.position.x, localCamera.z - dancer.position.z) + Math.sin(beat) * .13, Math.sin(beat) * .11);
        dancer.scale.set(size * (1 - hop * .025), size * (1 + hop * .035), size);
        rotation.makeRotationFromEuler(dancer.rotation);
        let bottom = Infinity;
        for (const sample of guest.support) bottom = Math.min(bottom, point.copy(sample).multiply(dancer.scale).applyMatrix4(rotation).y);
        dancer.position.y = .02 - bottom + hop * .075 + cheer;
        guest.materials.forEach(material => { material.opacity = strength; });
      }
      sparkCooldown = Math.max(0, sparkCooldown - delta);
      if (!stopping && elapsed >= nextSpark && elapsed < duration - .5) { onSpark(); nextSpark += 3; }
      if (elapsed >= duration || (stopping && stopTime >= 1)) finish();
    },
    stop,
    reset() { finish(); held = false; suspended = 0; wait = 18 + random() * 14; },
    dispose() {
      finish();
      canvas.removeEventListener('pointerdown', hold); canvas.removeEventListener('wheel', wheel);
      controls.removeEventListener('start', hold); controls.removeEventListener('end', release);
      activityTarget.removeEventListener('pointerup', release); activityTarget.removeEventListener('pointercancel', release);
      activityTarget.removeEventListener('blur', blur); visibilityTarget.removeEventListener('visibilitychange', visibility);
      root.removeFromParent(); guests.forEach(guest => guest.model.dispose()); warmth.dispose();
    },
  };
}
