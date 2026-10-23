import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandCamera } from '../src/integrations/hand-camera.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const keys = ['window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map(); let frameId = 0;
  class Button extends EventTarget {
    dataset = {}; attributes = {}; querySelector() { return { style: {} }; }
    setAttribute(key, value) { this.attributes[key] = value; }
  }
  const button = new Button(), note = {}, doc = new EventTarget(), win = new EventTarget();
  const preview = { currentTime: 0, readyState: 4, videoWidth: 640, videoHeight: 480, async play() {}, pause() {} };
  let stopped = 0;
  const track = { stop() { stopped++; } };
  const stream = { getTracks: () => [track] };
  for (const [key, value] of Object.entries({ window: win, document: doc, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: id => frames.delete(id) })) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return { button, note, preview, doc, win, stream, get stopped() { return stopped; },
    frame(now) { const next = frames.entries().next().value; if (next) { frames.delete(next[0]); preview.currentTime += .1; next[1](now); } },
    restore() { for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } } };
}
test('camera permission is opt-in; late permission, model initialization, and denied access are cleaned up', async () => {
  const s = setup(); let effect;
  try {
    let resolvePermission, resolveModel, closed = 0, requested = 0;
    navigator.mediaDevices.getUserMedia = () => { requested++; return new Promise(resolve => { resolvePermission = resolve; }); };
    effect = createHandCamera({ ...s, onInput() {}, onLight() {}, createDetector: () => new Promise(resolve => { resolveModel = resolve; }) });
    assert.equal(requested, 0);
    s.button.dispatchEvent(new Event('click')); effect.stop(); resolvePermission(s.stream); await flush();
    assert.equal(s.stopped, 1);
    s.button.dispatchEvent(new Event('click')); resolvePermission(s.stream); await flush();
    effect.stop(); resolveModel({ close() { closed++; } }); await flush();
    assert.equal(closed, 1); assert.equal(s.stopped, 2);
    navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); };
    s.button.dispatchEvent(new Event('click')); await flush();
    assert.match(s.note.textContent, /尚未允許/);
    assert.equal(s.button.attributes['aria-pressed'], 'false');
  } finally { effect?.dispose(); s.restore(); }
});
test('only one inference runs at a time; stale results do not relight after cancellation, and hide stops capture', async () => {
  const s = setup(); let effect;
  try {
    let resolveInference, calls = 0, closed = 0, light = 0;
    effect = createHandCamera({ ...s, onInput() {}, onLight() { light++; },
      createDetector: async () => ({ detect() { calls++; return new Promise(resolve => { resolveInference = resolve; }); }, close() { closed++; } }) });
    s.button.dispatchEvent(new Event('click')); await flush();
    s.frame(100); await flush(); s.frame(200); s.frame(300);
    assert.equal(calls, 1);
    effect.stop(); assert.equal(s.stopped, 1); assert.equal(closed, 0, 'do not destroy an in-flight graph');
    resolveInference(null); await flush(); await flush(); assert.equal(closed, 1); assert.equal(light, 0);
    s.button.dispatchEvent(new Event('click')); await flush();
    s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange')); await flush();
    assert.equal(s.stopped, 2); assert.equal(s.preview.srcObject, null);
    assert.equal(s.button.attributes['aria-pressed'], 'false');
  } finally { effect?.dispose(); s.restore(); }
});
test('a detector error stops the camera and remains retryable', async () => {
  const s = setup(); let effect;
  try {
    let closed = 0;
    effect = createHandCamera({ ...s, onInput() {}, onLight() {}, createDetector: async () => ({ detect() { throw new Error('device lost'); }, close() { closed++; } }) });
    s.button.dispatchEvent(new Event('click')); await flush(); s.frame(100); await flush(); await flush();
    assert.match(s.note.textContent, /辨識暫時中斷/); assert.equal(s.stopped, 1); assert.equal(closed, 1);
    s.button.dispatchEvent(new Event('click')); await flush(); assert.equal(s.button.attributes['aria-pressed'], 'true');
  } finally { effect?.dispose(); await flush(); s.restore(); }
});
