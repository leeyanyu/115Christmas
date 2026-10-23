import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandGestures, readPalm } from '../src/integrations/hand-gestures.js';

const palm = (x = .5, open = true, y = .45) => ({ x, y, open });
function hold(gesture, start, count = 15, sample = palm()) {
  return Array.from({ length: count }, (_, i) => gesture.update(sample, start + i * .1));
}
test('open palm needs one stable second and fires once until the hand is lowered', () => {
  const gesture = createHandGestures();
  const states = hold(gesture, 0, 40);
  assert.equal(states.filter(s => s.trigger).length, 1);
  assert.equal(states.slice(0, 10).some(s => s.trigger), false);
  hold(gesture, 4, 15, palm(.5, false));
  assert.equal(hold(gesture, 5.5, 20).some(s => s.trigger), false, 'closing a fist must not rearm');
  hold(gesture, 7.5, 10, palm(.5, true, .95));
  assert.equal(hold(gesture, 8.5, 20).filter(s => s.trigger).length, 1);
});
test('hand motion takes priority; horizontal travel controls rotation magnitude and direction', () => {
  const gesture = createHandGestures();
  const moving = Array.from({ length: 30 }, (_, i) => gesture.update(palm(.3 + i * .012), i * .1));
  assert.equal(moving.some(s => s.trigger), false);
  assert.ok(moving.reduce((sum, s) => sum + s.turn, 0) > .8);
  assert.equal(hold(gesture, 3, 15, palm(.648)).filter(s => s.trigger).length, 1);
  const travel = amount => { const g = createHandGestures(); return Array.from({ length: 20 }, (_, i) => g.update(palm(.5 + i * amount), i * .1)).reduce((sum, s) => sum + s.turn, 0); };
  assert.ok(travel(.01) > travel(.005) * 1.7);
  assert.ok(travel(-.01) < 0);
  const vertical = createHandGestures();
  const states = Array.from({ length: 25 }, (_, i) => vertical.update(palm(.5, true, .3 + i * .016), i * .1));
  assert.equal(states.some(s => s.trigger), false);
  assert.equal(states.reduce((sum, s) => sum + s.turn, 0), 0);
});
test('brief tracking loss, stalled inference and hand handoffs cannot retrigger or jump the tree', () => {
  const g = createHandGestures(); hold(g, 0, 20);
  g.update(null, 2); g.update(null, 2.2);
  assert.equal(hold(g, 2.3, 20).some(s => s.trigger), false);
  hold(g, 4.3, 10, null);
  assert.equal(hold(g, 5.3, 20).filter(s => s.trigger).length, 1);
  g.reset(); g.update(palm(), 0); g.update(palm(), .8);
  assert.equal(g.update(palm(), 1.6).trigger, false);
  assert.equal(g.update(palm(.9), 1.7).turn, 0);
  g.suspend(); assert.equal(g.update(palm(.1), 1.8).turn, 0);
});
test('holding tolerates small detection jitter, and suspension preserves the once-per-hand latch', () => {
  const g = createHandGestures();
  const states = Array.from({ length: 25 }, (_, i) => g.update(palm(.5 + Math.sin(i) * .002), i * .1));
  assert.equal(states.filter(s => s.trigger).length, 1);
  g.suspend(); assert.equal(hold(g, 3, 20).some(s => s.trigger), false);
});
test('palm geometry recognizes an open tilted hand, rejects a fist, and mirrors camera coordinates', () => {
  const xy = [[.5,.75],[.45,.70],[.4,.64],[.34,.59],[.28,.56],
    [.42,.65],[.40,.57],[.39,.49],[.38,.41], [.5,.62],[.5,.52],[.5,.42],[.5,.30],
    [.57,.64],[.59,.54],[.6,.44],[.61,.35], [.63,.67],[.66,.60],[.68,.52],[.70,.45]];
  const points = xy.map(([x,y]) => ({ x, y }));
  assert.equal(readPalm(points).open, true);
  const tilted = points.map(p => ({ x: .5 + (p.x-.5)*.866 - (p.y-.5)*.5, y: .5 + (p.x-.5)*.5 + (p.y-.5)*.866 }));
  assert.equal(readPalm(tilted, 1).open, true);
  const shifted = points.map(p => ({ x: p.x + .1, y: p.y }));
  assert.ok(readPalm(shifted).x < readPalm(points).x);
  const fist = points.map(p => ({ ...p }));
  for (const [base,tip] of [[5,8],[9,12],[13,16],[17,20]]) fist[tip] = { ...points[base], y: points[base].y + .04 };
  assert.equal(readPalm(fist).open, false);
  assert.equal(readPalm([]), null);
});
