import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLight } from '../src/integrations/voice-light.js';

test('cancelled microphone permission releases a late stream; denied permission remains retryable', async () => {
  const saved = Object.fromEntries(['window', 'document', 'navigator', 'cancelAnimationFrame'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  class Button extends EventTarget { setAttribute() {} }
  const button = new Button(), note = {}, meter = {};
  let resolvePermission, closed = 0, stopped = 0;
  class Context { async resume() {} async close() { closed++; } }
  const win = new EventTarget(); win.AudioContext = Context;
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: new EventTarget(), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolvePermission = resolve; }) } }, configurable: true });
  globalThis.cancelAnimationFrame = () => {};
  try {
    const effect = createVoiceLight({ button, note, meter, onEnergy() {} });
    button.dispatchEvent(new Event('click')); await Promise.resolve();
    effect.stop();
    resolvePermission({ getTracks: () => [{ stop() { stopped++; } }] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopped, 1); assert.equal(closed, 1);
    navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); };
    button.dispatchEvent(new Event('click'));
    await new Promise(resolve => setImmediate(resolve));
    assert.match(note.textContent, /尚未允許/);
    assert.equal(button.textContent, '用歌聲點亮');
    effect.dispose();
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
