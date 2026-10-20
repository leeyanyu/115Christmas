import { createGingerbread } from './gingerbread.js';
import * as THREE from 'three';

export function createHolidayVisitors(tree, { random = Math.random, onDrop = () => {} } = {}) {
  let autoDropCooldown = 0;
  // Independent climbs can finish at different times. Reserve a shared gap so
  // even fast manual turns cannot make both automatic slides start together.
  const requestAutoDrop = () => {
    if (autoDropCooldown > .000001) return false;
    autoDropCooldown = 2; return true;
  };
  // Exactly two actors are built once; subsequent casts reuse their resources.
  const ginger = createGingerbread(tree, { autoCycle: false, canGreet: true, dropAfterTurn: true, dropDelay: .6, requestAutoDrop });
  const candy = createGingerbread(tree, { kind: 'candy-cane', autoCycle: false, homeAngle: -2.65, homeHeight: 2.35, entrySide: 1, dropAfterTurn: true, dropDelay: 2.6, requestAutoDrop });
  const actors = [ginger, candy], combinations = [[ginger], [candy], [ginger, candy]];
  const localCamera = new THREE.Vector3();
  let active = [ginger], bag = [], previous = 0, wait = -1, secondDelay = -1, pairSide = -1, playable = false, reduced = false, paused = false;
  let greetingWait = 0, greetingStyles = [];
  function startGreeting(camera, side) {
    if (!greetingStyles.length) greetingStyles = ['side', 'close'];
    const index = Math.min(greetingStyles.length - 1, Math.floor(Math.max(0, random()) * greetingStyles.length));
    if (!ginger.greet(camera, side, greetingStyles[index])) return false;
    greetingStyles.splice(index, 1);
    return true;
  }
  function nextCast(camera) {
    if (!bag.length) bag = [0, 1, 2];
    let index = Math.min(bag.length - 1, Math.floor(Math.max(0, random()) * bag.length));
    if (bag.length > 1 && bag[index] === previous) index = (index + 1) % bag.length;
    previous = bag.splice(index, 1)[0]; active = combinations[previous];
    const pair = active.length === 2;
    if (pair) pairSide = ginger.landingScreenX(camera) < candy.landingScreenX(camera) ? -1 : 1;
    const greets = !pair && active[0] === ginger && random() < .6 && startGreeting(camera, random() < .5 ? -1 : 1);
    if (greets) greetingWait = 45 + random() * 35;
    else active[0].arrive(pair ? { sameSide: true, side: pairSide } : {});
    secondDelay = pair ? .55 : -1;
  }
  function reset() {
    autoDropCooldown = 0;
    actors.forEach(actor => actor.reset()); candy.hide();
    active = [ginger]; bag = []; previous = 0; wait = secondDelay = -1; playable = paused = false;
    greetingWait = 12 + random() * 5; greetingStyles = [];
  }
  reset();
  return {
    get targets() { return paused ? [] : actors.filter(actor => actor.root.visible).map(actor => actor.root); },
    get greeting() { return paused ? null : ginger.greeting; },
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
      if (actor.drop()) { if (!reduced) autoDropCooldown = 2; onDrop(object.userData.holidayCharacter, reduced); }
      return true;
    },
    update(delta, camera, ready, reducedMotion, allowGreeting = true) {
      if (paused) { playable = false; actors.forEach(actor => { actor.root.visible = false; }); return; }
      playable = ready; reduced = reducedMotion;
      if (!ready) { actors.forEach(actor => actor.update(delta, camera, false, reducedMotion)); return; }
      autoDropCooldown = reducedMotion ? 0 : Math.max(0, autoDropCooldown - delta);
      if (reducedMotion) {
        // Never hide or exchange characters automatically in reduced motion.
        wait = secondDelay = -1;
        if (active.every(actor => actor.isAway)) { active = [ginger]; ginger.reset(); }
      } else if (secondDelay >= 0) {
        secondDelay -= delta;
        if (secondDelay <= 0) { active[1].arrive({ sameSide: true, side: -pairSide }); secondDelay = -1; }
      }
      actors.forEach(actor => {
        if (actor === ginger && actor.isGreetingVisit && !allowGreeting && !reducedMotion) return;
        actor.update(delta, camera, true, reducedMotion);
      });
      if (allowGreeting && !reducedMotion) {
        greetingWait = Math.max(0, greetingWait - delta);
        // Surprise a waiting visitor even when they never turn to the back.
        // Existing paired arrivals retain their separate, collision-safe lanes.
        if (!greetingWait && wait < 0 && secondDelay < 0 && active.length === 1 && active[0] === ginger && !ginger.isPerforming) {
          const started = startGreeting(camera, random() < .5 ? -1 : 1);
          greetingWait = started ? 45 + random() * 35 : 3;
        }
      }
      if (reducedMotion || secondDelay >= 0 || !active.every(actor => actor.isAway)) return;
      if (wait < 0) wait = 4 + random() * 2;
      else if ((wait -= delta) <= 0) { wait = -1; nextCast(camera); }
    },
    reset,
    dispose() { actors.forEach(actor => actor.dispose()); },
  };
}
