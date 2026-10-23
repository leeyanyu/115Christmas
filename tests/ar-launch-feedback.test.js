import test from 'node:test';
import assert from 'node:assert/strict';
import { createARLaunchFeedback } from '../src/ar/launch-feedback.js';

function setup() {
  const links = [new EventTarget(), new EventTarget()], doc = new EventTarget(), win = new EventTarget();
  doc.hidden = false;
  const note = {}, help = { hidden: true, open: false }, timers = new Map(); let next = 0;
  const feedback = createARLaunchFeedback({ links, doc, win, note, help,
    schedule: (fn, delay) => { assert.equal(delay, 3000); timers.set(++next, fn); return next; },
    unschedule: id => timers.delete(id) });
  return { links, doc, win, note, help, timers, feedback,
    expire() { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(fn => fn()); } };
}

test('a blocked Android handoff gives usable help instead of silently remaining on the page', () => {
  const s = setup();
  try {
    assert.equal(s.timers.size, 0);
    s.links[0].dispatchEvent(new Event('click'));
    assert.match(s.note.textContent, /正在開啟/);
    s.expire();
    assert.equal(s.help.hidden, false); assert.equal(s.help.open, true);
    assert.match(s.note.textContent, /尚未開啟/);
  } finally { s.feedback.dispose(); }
});

test('returning from the viewer is acknowledged without claiming that AR was successful', () => {
  const s = setup();
  try {
    s.links[0].dispatchEvent(new Event('click'));
    s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(s.timers.size, 0);
    s.expire(); assert.equal(s.help.hidden, true);
    s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange'));
    assert.match(s.note.textContent, /已回到作品頁/);
    assert.match(s.note.textContent, /若剛才沒有/);
    assert.equal(s.help.open, true);
  } finally { s.feedback.dispose(); }
});

test('alternate links retry cleanly; disposal removes timers and listeners', () => {
  const s = setup();
  s.links[0].dispatchEvent(new Event('click'));
  s.links[1].dispatchEvent(new Event('click'));
  assert.equal(s.timers.size, 1);
  s.win.dispatchEvent(new Event('pagehide')); assert.equal(s.timers.size, 0);
  s.win.dispatchEvent(new Event('pageshow')); assert.match(s.note.textContent, /已回到/);
  s.feedback.dispose();
  const previous = s.note.textContent;
  s.links[0].dispatchEvent(new Event('click')); s.links[1].dispatchEvent(new Event('click'));
  assert.equal(s.timers.size, 0); assert.equal(s.note.textContent, previous);
});
