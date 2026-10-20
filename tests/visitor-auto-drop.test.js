import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createGingerbread } from '../src/scene/gingerbread.js';
import { createHolidayVisitors } from '../src/scene/holiday-visitors.js';
import { createRotationGlow } from '../src/scene/rotation-glow.js';

function fixture(aspect = 1.5) {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, aspect, .1, 60);
  const view = angle => {
    camera.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10);
    camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  };
  view(Math.PI - .1);
  return { tree, camera, view };
}

function climb(actor, f, rotate = false) {
  actor.arrive();
  for (let frame = 0; frame < 300 && actor.isPerforming; frame++) {
    if (rotate) f.tree.root.rotation.y += .15;
    actor.update(.05, f.camera, true, false);
  }
  assert.equal(actor.isPerforming, false, 'the visitor must finish climbing');
}

test('both visitors wait for a complete tree or camera orbit, then slide without a click', () => {
  for (const kind of ['gingerbread', 'candy-cane']) for (const mode of ['tree', 'orbit-cw', 'orbit-ccw', 'mixed']) {
    const f = fixture(.8), actor = createGingerbread(f.tree, { kind, autoCycle: false, dropAfterTurn: true });
    climb(actor, f, true);
    const home = actor.root.position.clone(), startAngle = f.tree.root.rotation.y;
    actor.update(30, f.camera, true, false);
    assert.equal(actor.isPerforming, false, 'stationary viewing and rotations during climbing cannot trigger a slide');
    assert.equal(actor.root.position.y, home.y);
    for (let step = 1; step <= 64; step++) {
      const amount = step / 64 * Math.PI * 2;
      if (mode === 'tree') f.tree.root.rotation.y = startAngle + amount;
      else if (mode === 'mixed') {
        f.tree.root.rotation.y = startAngle - amount / 2;
        f.view(Math.PI - .1 + amount / 2);
      } else f.view(Math.PI - .1 + amount * (mode === 'orbit-cw' ? 1 : -1));
      actor.update(.05, f.camera, true, false);
      assert.equal(actor.isPerforming, false, 'the full lap and landing delay must complete before sliding');
    }
    actor.update(.59, f.camera, true, false); assert.equal(actor.isPerforming, false);
    actor.update(.02, f.camera, true, false); assert.equal(actor.isPerforming, true);
    actor.update(.2, f.camera, true, false); assert.ok(actor.root.position.y < home.y);
    actor.dispose();
  }
});

test('reversals, opening motion, reduced motion and replay cannot create a stale automatic slide', () => {
  const f = fixture(), actor = createGingerbread(f.tree, { autoCycle: false, dropAfterTurn: true });
  actor.update(.1, f.camera, false, false);
  f.tree.root.rotation.y = Math.PI * 2;
  actor.update(.1, f.camera, true, false);
  const home = actor.root.position.clone();
  for (let round = 0; round < 4; round++) {
    f.tree.root.rotation.y += Math.PI; actor.update(.1, f.camera, true, false);
    f.tree.root.rotation.y -= Math.PI; actor.update(.1, f.camera, true, false);
  }
  actor.update(30, f.camera, true, false); assert.equal(actor.root.position.y, home.y);
  assert.equal(actor.isPerforming, false, 'back-and-forth half turns are not a complete orbit');
  f.tree.root.rotation.y += Math.PI * 2; actor.update(.1, f.camera, true, false);
  actor.update(.3, f.camera, true, true);
  actor.update(30, f.camera, true, true); assert.equal(actor.isPerforming, false);
  actor.update(30, f.camera, true, false); assert.equal(actor.isPerforming, false);
  f.tree.root.rotation.y += Math.PI * 2; actor.update(.1, f.camera, true, false);
  actor.reset(); actor.update(.1, f.camera, true, false);
  actor.update(30, f.camera, true, false); assert.equal(actor.isPerforming, false);
  f.tree.root.rotation.y += Math.PI * 2; actor.update(.1, f.camera, true, false);
  assert.equal(actor.drop(), true, 'a click can still start the slide during the automatic delay');
  actor.update(.2, f.camera, true, false); const falling = actor.root.position.y;
  actor.update(.2, f.camera, true, false); assert.ok(actor.root.position.y < falling);
  assert.equal(actor.drop(), false, 'the pending timer must not restart a manually triggered fall');
  actor.dispose();
});

test('a full orbit still releases a visitor after an earlier partial turn in the opposite direction', () => {
  for (const mode of ['tree', 'camera']) {
    const f = fixture(), actor = createGingerbread(f.tree, { autoCycle: false, dropAfterTurn: true });
    actor.update(.1, f.camera, true, false);
    if (mode === 'tree') f.tree.root.rotation.y = -Math.PI / 3;
    else f.view(Math.PI - .1 + Math.PI / 3);
    actor.update(.1, f.camera, true, false);
    for (let step = 1; step <= 64; step++) {
      const angle = step / 64 * Math.PI * 2;
      if (mode === 'tree') f.tree.root.rotation.y = -Math.PI / 3 + angle;
      else f.view(Math.PI - .1 + Math.PI / 3 - angle);
      actor.update(.05, f.camera, true, false);
    }
    actor.update(.61, f.camera, true, false);
    assert.equal(actor.isPerforming, true, 'a preceding opposite partial turn must not require an extra idle orbit');
    actor.dispose();
  }
});

test('different climb times during continuous fast turns cannot synchronize the two automatic slides', () => {
  for (const aspect of [1.5, .5]) for (const mode of ['tree', 'camera']) {
    const f = fixture(aspect); f.view(0);
    const visitors = createHolidayVisitors(f.tree, { random: () => .9 });
    visitors.update(.1, f.camera, true, false); visitors.endParty(); visitors.update(6, f.camera, true, false);
    const roots = ['hidden-gingerbread', 'hidden-candy-cane'].map(name => f.tree.root.getObjectByName(name));
    const previous = roots.map(root => root.position.y), slides = [];
    for (let frame = 0; frame < 2400; frame++) {
      const time = frame * .05;
      if (mode === 'tree') f.tree.root.rotation.y = time * 3;
      else f.view(time * 3);
      visitors.update(.05, f.camera, true, false);
      roots.forEach((root, i) => {
        const height = i ? 2.35 : 1.95;
        if (root.visible && Math.abs(previous[i] - height) < .000001 && previous[i] - root.position.y > .0001 && previous[i] - root.position.y < .1) slides.push({ kind: i, time });
        previous[i] = root.position.y;
      });
    }
    assert.ok(slides.filter(s => s.kind === 0).length >= 2 && slides.filter(s => s.kind === 1).length >= 2);
    for (let i = 1; i < slides.length; i++) {
      if (slides[i].kind !== slides[i - 1].kind) assert.ok(slides[i].time - slides[i - 1].time >= 1.95,
        `automatic slides overlap during ${mode} rotation at aspect ${aspect}`);
    }
    visitors.dispose();
  }
});

test('idle rotation keeps renewing solo and paired visitors with staggered automatic slides and reusable resources', () => {
  for (const aspect of [1.5, .5]) {
    const f = fixture(aspect); f.view(0);
    const visitors = createHolidayVisitors(f.tree, { random: () => .9 });
    const controls = new THREE.EventDispatcher();
    controls.getAzimuthalAngle = () => 0; controls.getPolarAngle = () => 1.3;
    const visibility = new EventTarget(); visibility.hidden = false;
    const rotation = createRotationGlow({ tree: f.tree, controls, canvas: new EventTarget(), activityTarget: new EventTarget(), visibilityTarget: visibility });
    const roots = ['hidden-gingerbread', 'hidden-candy-cane'].map(name => f.tree.root.getObjectByName(name));
    const geometry = roots.map(root => root.children[0].geometry), materials = roots.map(root => root.children[0].material);
    const count = f.tree.root.children.length, previous = roots.map(root => root.position.y);
    const falls = [0, 0], casts = new Set(), gaps = [];
    let pair = null;
    for (let frame = 0; frame < 2400; frame++) {
      const time = frame * .1;
      rotation.beforeUpdate(.1, !visitors.isPerforming, false);
      visitors.update(.1, f.camera, true, false);
      if (visitors.targets.length && !visitors.isPerforming) {
        casts.add(visitors.targets.map(root => root.userData.holidayCharacter).sort().join('+'));
        if (visitors.targets.length === 2 && !pair) pair = [];
      }
      roots.forEach((root, i) => {
        const height = i ? 2.35 : 1.95;
        if (root.visible && Math.abs(previous[i] - height) < .000001 && previous[i] - root.position.y > .0001 && previous[i] - root.position.y < .1) {
          falls[i]++;
          if (pair) pair[i] = time;
        }
        previous[i] = root.position.y;
      });
      if (pair?.length === 2 && pair[0] !== undefined && pair[1] !== undefined) {
        gaps.push(pair[1] - pair[0]); pair = null;
      }
    }
    assert.equal(casts.size, 3, 'idle viewing must reach gingerbread, candy-cane and paired tree visits');
    assert.ok(falls[0] >= 2 && falls[1] >= 2, `both visitors must repeatedly slide without a click: ${falls}`);
    assert.ok(gaps.length >= 2, 'paired visits must keep recurring');
    gaps.forEach(gap => assert.ok(gap >= 1.8 && gap <= 2.2, `paired slides must be about two seconds apart: ${gap}`));
    assert.equal(f.tree.root.children.length, count);
    roots.forEach((root, i) => { assert.equal(root.children[0].geometry, geometry[i]); assert.equal(root.children[0].material, materials[i]); });
    rotation.dispose(); visitors.dispose();
  }
});
