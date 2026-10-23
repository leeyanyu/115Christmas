import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandDetector } from '../src/integrations/hand-detector.js';

class Worker {
  messages = []; terminated = 0;
  postMessage(message, transfer) { this.messages.push({ message, transfer }); }
  terminate() { this.terminated++; }
  reply(data) { this.onmessage?.({ data }); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
async function ready(options = {}) {
  const worker = new Worker();
  const loading = createHandDetector({ workerFactory: () => worker, ...options });
  worker.reply({ type: 'ready', id: 1 });
  return { worker, detector: await loading };
}
test('background inference transfers one downscaled fresh bitmap and cannot build a frame backlog', async () => {
  let released = 0;
  const bitmap = { close() { released++; } };
  const { worker, detector } = await ready({ bitmapFactory: async (video, options) => {
    assert.equal(options.resizeWidth, 320); assert.equal(options.resizeHeight, 180); return bitmap;
  } });
  const frame = detector.detect({ videoWidth: 1280, videoHeight: 720 }); await flush();
  assert.equal(worker.messages[1].message.type, 'frame');
  assert.deepEqual(worker.messages[1].transfer, [bitmap]);
  await assert.rejects(detector.detect({}), /仍在處理/);
  worker.reply({ type: 'result', id: 999, landmarks: ['stale'] });
  worker.reply({ type: 'result', id: 2, landmarks: ['current'] });
  assert.deepEqual(await frame, ['current']); assert.equal(released, 1);
  detector.close(); detector.close(); assert.equal(worker.terminated, 1);
});
test('cancel and timeout terminate loading workers rather than leaving an indefinitely pending model', async () => {
  const worker = new Worker(), controller = new AbortController();
  const loading = createHandDetector({ workerFactory: () => worker, signal: controller.signal });
  controller.abort(); await assert.rejects(loading, { name: 'AbortError' }); assert.equal(worker.terminated, 1);
  const stuck = new Worker();
  await assert.rejects(createHandDetector({ workerFactory: () => stuck, timeoutMs: 5 }), /逾時/);
  assert.equal(stuck.terminated, 1);
});
test('stopping during bitmap creation releases the late bitmap without posting to a dead worker', async () => {
  let resolveBitmap, released = 0;
  const { worker, detector } = await ready({ bitmapFactory: () => new Promise(resolve => { resolveBitmap = resolve; }) });
  const detection = detector.detect({ videoWidth: 640, videoHeight: 480 });
  detector.close(); resolveBitmap({ close() { released++; } });
  await assert.rejects(detection, /已關閉/);
  assert.equal(released, 1); assert.equal(worker.messages.length, 1);
});
test('download progress and useful worker errors reach the caller and allow a new worker on retry', async () => {
  const worker = new Worker(), seen = [];
  const loading = createHandDetector({ workerFactory: () => worker, onProgress: value => seen.push(value) });
  worker.reply({ type: 'progress', phase: 'download', loaded: 2048 });
  assert.equal(seen[0].loaded, 2048);
  worker.reply({ type: 'error', id: 1, message: '手部模型下載失敗' });
  await assert.rejects(loading, /模型下載失敗/); assert.equal(worker.terminated, 1);
  const retry = await ready(); retry.detector.close();
});
test('continued download progress renews the stall deadline on slower networks', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const worker = new Worker();
  const loading = createHandDetector({ workerFactory: () => worker, timeoutMs: 20 });
  t.mock.timers.tick(15);
  worker.reply({ type: 'progress', phase: 'download', loaded: 1024 });
  t.mock.timers.tick(15); assert.equal(worker.terminated, 0);
  worker.reply({ type: 'ready', id: 1 });
  const detector = await loading; detector.close();
});
