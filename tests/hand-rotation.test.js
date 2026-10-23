import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandRotation } from '../src/scene/hand-rotation.js';

const motion = (turn = 0) => ({ present: true, turn });
function finish(rotation, reduced = false) {
  let distance = 0;
  for (let i = 0; i < 100; i++) {
    if (i % 6 === 0) rotation.input(motion(), true);
    distance += rotation.update(1 / 60, reduced, true);
  }
  return distance;
}
test('a quick swipe accelerates into a finite tail and then stops once', () => {
  const r = createHandRotation();
  for (let i = 0; i < 3; i++) { r.input(motion(.24), true); r.update(.06, false, true); }
  const speeds = []; let distance = 0;
  for (let i = 0; i < 100; i++) {
    if (i % 6 === 0) r.input(motion(), true);
    const step = r.update(1 / 60, false, true); speeds.push(step * 60); distance += step;
  }
  assert.ok(Math.max(...speeds) > 1.8, 'tail briefly moves faster than normal hand-follow speed');
  assert.ok(Math.max(...speeds) <= 2.6 + 1e-9);
  assert.ok(distance > .6 && distance < 1.5);
  assert.equal(r.isActive, false);
  assert.equal(finish(r), 0, 'a still hand cannot keep relaunching the tail');
});
test('reversing a swipe, manual control and camera stop immediately take priority', () => {
  const r = createHandRotation(); r.input(motion(.5), true); r.update(.2, false, true);
  r.input(motion(-.2), true);
  assert.ok(r.update(.02, false, true) < 0, 'old momentum does not fight the new direction');
  r.input({ present: false, reset: true }, true);
  assert.equal(r.update(.02, false, true), 0);
  r.input(motion(.4), true); assert.equal(r.update(.02, false, false), 0);
  assert.equal(r.isActive, false);
});
test('losing sight of the hand can finish the tail, but stale input cannot spin forever', () => {
  const r = createHandRotation(); r.input(motion(.5), true); r.update(.1, false, true);
  r.input({ present: false, turn: 0 }, true);
  assert.ok(r.update(.1, false, true) > 0);
  for (let i = 0; i < 60; i++) r.update(1 / 60, false, true);
  assert.equal(r.isActive, false); assert.equal(r.update(.1, false, true), 0);
});
test('a slower camera cadence does not launch a fling between ongoing swipe samples', () => {
  const r = createHandRotation();
  let angle = 0;
  for (let sample = 0; sample < 4; sample++) {
    r.input(motion(.1), true);
    for (let i = 0; i < 18; i++) angle += r.update(1 / 60, false, true);
  }
  assert.ok(angle < .4, 'ongoing hand motion has not received a premature extra arc');
  const remaining = finish(r);
  assert.ok(angle + remaining > .6, 'the finite fling happens after the swipe ends');
});
test('reduced motion follows only the hand displacement without an extra fling', () => {
  const normal = createHandRotation(), reduced = createHandRotation();
  normal.input(motion(.5), true); reduced.input(motion(.5), true);
  const normalDistance = finish(normal), reducedDistance = finish(reduced, true);
  assert.ok(normalDistance > .7);
  assert.ok(Math.abs(reducedDistance - .2) < .001);
});
