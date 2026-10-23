import test from 'node:test';
import assert from 'node:assert/strict';
import { createXRSession } from '../src/ar/xr-session.js';

class Session extends EventTarget {
  ended = 0;
  async end() { this.ended++; this.dispatchEvent(new Event('end')); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('immersive AR is requested within the original tap, with hit testing and DOM controls', async () => {
  const s = new Session(), overlay = {}, requests = [], errors = []; let starts = 0, ends = 0;
  const c = createXRSession({ xr: { requestSession(...args) { requests.push(args); return Promise.resolve(s); } }, overlay,
    async onStart(incoming, current) { assert.equal(incoming, s); assert.equal(current(), true); starts++; },
    onEnd() { ends++; }, onError: e => errors.push(e) });
  const pending = c.start(); assert.equal(requests.length, 1, 'no async work before requestSession');
  assert.deepEqual(requests[0], ['immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: overlay } }]);
  await pending; await c.start(); assert.equal(starts, 1); assert.equal(c.active, true);
  await s.end(); await flush(); assert.equal(ends, 1); assert.equal(c.active, false);
  await c.dispose(); assert.equal(ends, 1); assert.deepEqual(errors, []);
});

test('a cancelled, late permission result is immediately ended without starting graphics', async () => {
  let allow, starts = 0;
  const s = new Session(), c = createXRSession({ xr: { requestSession: () => new Promise(resolve => { allow = resolve; }) }, overlay: {},
    onStart() { starts++; }, onEnd() {}, onError() { assert.fail('cancellation is not a launch error'); } });
  const pending = c.start(); await c.dispose(); allow(s); await pending;
  assert.equal(s.ended, 1); assert.equal(starts, 0); assert.equal(c.active, false);
});

test('permission errors remain retryable, and graphics setup errors end the session', async () => {
  let tries = 0, ends = 0; const errors = [], s = new Session();
  const c = createXRSession({ xr: { requestSession() {
    if (++tries === 1) throw new DOMException('denied', 'NotAllowedError'); return Promise.resolve(s);
  } }, overlay: {}, async onStart() { throw new Error('hit-test source unavailable'); },
  onEnd() { ends++; }, onError: e => errors.push(e) });
  await c.start(); assert.equal(errors[0].name, 'NotAllowedError'); assert.equal(c.active, false);
  await c.start(); assert.equal(errors[1].message, 'hit-test source unavailable');
  assert.equal(s.ended, 1); assert.equal(ends, 1); assert.equal(c.active, false); await c.dispose();
});

test('ending during setup invalidates pending reference-space work', async () => {
  const s = new Session(); let finish, current, ends = 0;
  const c = createXRSession({ xr: { requestSession: async () => s }, overlay: {},
    onStart(incoming, isCurrent) { current = isCurrent; return new Promise(resolve => { finish = resolve; }); },
    onEnd() { ends++; }, onError() { assert.fail('stale setup cannot become an error'); } });
  const pending = c.start(); await Promise.resolve(); assert.equal(current(), true);
  await c.stop(); assert.equal(current(), false); finish(); await pending;
  assert.equal(ends, 1); assert.equal(c.active, false); await c.dispose();
});
