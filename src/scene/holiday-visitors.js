import { createGingerbread } from './gingerbread.js';
import * as THREE from 'three';

export function createHolidayVisitors(tree, { random = Math.random, onDrop = () => {} } = {}) {
  // Exactly two actors are built once; subsequent casts reuse their resources.
  const ginger = createGingerbread(tree, { autoCycle: false, linger: 6.5 });
  const candy = createGingerbread(tree, { kind: 'candy-cane', autoCycle: false, homeAngle: -2.65, homeHeight: 2.35, entrySide: 1, linger: 8 });
  const actors = [ginger, candy], combinations = [[ginger], [candy], [ginger, candy]];
  const localCamera = new THREE.Vector3();
  let active = [ginger], bag = [], previous = 0, wait = -1, secondDelay = -1, pairSide = -1, playable = false, reduced = false, paused = false;
  function nextCast(camera) {
    if (!bag.length) bag = [0, 1, 2];
    let index = Math.min(bag.length - 1, Math.floor(Math.max(0, random()) * bag.length));
    if (bag.length > 1 && bag[index] === previous) index = (index + 1) % bag.length;
    previous = bag.splice(index, 1)[0]; active = combinations[previous];
    const pair = active.length === 2;
    if (pair) pairSide = ginger.landingScreenX(camera) < candy.landingScreenX(camera) ? -1 : 1;
    active[0].arrive(pair ? { sameSide: true, side: pairSide } : {}); secondDelay = pair ? .55 : -1;
  }
  function reset() {
    actors.forEach(actor => actor.reset()); candy.hide();
    active = [ginger]; bag = []; previous = 0; wait = secondDelay = -1; playable = paused = false;
  }
  reset();
  return {
    get targets() { return paused ? [] : actors.filter(actor => actor.root.visible).map(actor => actor.root); },
    get isPerforming() { return paused || wait >= 0 || secondDelay >= 0 || active.some(actor => !actor.isAway && actor.isPerforming); },
    canGather(camera) {
      if (paused || secondDelay >= 0) return false;
      if (active.every(actor => actor.isAway)) return true;
      if (active.some(actor => actor.isPerforming)) return false;
      tree.root.updateWorldMatrix(true, false); localCamera.copy(camera.position); tree.root.worldToLocal(localCamera);
      return active.every(actor => {
        const p = actor.root.position;
        return (p.x * localCamera.x + p.z * localCamera.z) / Math.max(.01, Math.hypot(p.x, p.z) * Math.hypot(localCamera.x, localCamera.z)) < .15;
      });
    },
    beginParty() { paused = true; playable = false; actors.forEach(actor => { actor.root.visible = false; }); },
    endParty() { paused = false; playable = false; actors.forEach(actor => actor.hide()); active = actors; wait = 4; secondDelay = -1; },
    tap(object) {
      while (object && !object.userData.holidayCharacter) object = object.parent;
      const actor = actors.find(item => item.root === object);
      if (!actor || !actor.root.visible || !playable) return false;
      if (actor.drop()) onDrop(object.userData.holidayCharacter, reduced);
      return true;
    },
    update(delta, camera, ready, reducedMotion) {
      if (paused) { playable = false; actors.forEach(actor => { actor.root.visible = false; }); return; }
      playable = ready; reduced = reducedMotion;
      if (!ready) { actors.forEach(actor => actor.update(delta, camera, false, reducedMotion)); return; }
      if (reducedMotion) {
        // Never hide or exchange characters automatically in reduced motion.
        wait = secondDelay = -1;
        if (active.every(actor => actor.isAway)) { active = [ginger]; ginger.reset(); }
      } else if (secondDelay >= 0) {
        secondDelay -= delta;
        if (secondDelay <= 0) { active[1].arrive({ sameSide: true, side: -pairSide }); secondDelay = -1; }
      }
      actors.forEach(actor => actor.update(delta, camera, true, reducedMotion));
      if (reducedMotion || secondDelay >= 0 || !active.every(actor => actor.isAway)) return;
      if (wait < 0) wait = 4 + random() * 2;
      else if ((wait -= delta) <= 0) { wait = -1; nextCast(camera); }
    },
    reset,
    dispose() { actors.forEach(actor => actor.dispose()); },
  };
}
