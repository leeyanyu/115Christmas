import test from 'node:test';
import assert from 'node:assert/strict';
import { openRearCamera } from '../src/ar/rear-camera.js';

function setup() {
  const video = new EventTarget(); let stopped = 0, paused = 0, constraints;
  Object.assign(video, { readyState: 4, videoWidth: 1920, videoHeight: 1080,
    async play() {}, pause() { paused++; } });
  const stream = { getTracks: () => [{ stop() { stopped++; } }] };
  const mediaDevices = { async getUserMedia(value) { constraints = value; return stream; } };
  return { video, stream, mediaDevices, get stopped() { return stopped; }, get paused() { return paused; }, get constraints() { return constraints; } };
}

test('photo camera requests rear-facing video without audio; stop releases tracks and the video source once', async () => {
  const s = setup(), abort = new AbortController();
  const camera = await openRearCamera(s.video, { mediaDevices: s.mediaDevices, signal: abort.signal });
  assert.equal(s.constraints.audio, false); assert.equal(s.constraints.video.facingMode.ideal, 'environment');
  assert.equal(s.video.srcObject, s.stream);
  camera.stop(); camera.stop(); abort.abort();
  assert.equal(s.stopped, 1); assert.equal(s.paused, 1); assert.equal(s.video.srcObject, null);
});

test('closing while permission is pending stops a late camera stream immediately', async () => {
  const s = setup(), abort = new AbortController(); let allow;
  s.mediaDevices.getUserMedia = () => new Promise(resolve => { allow = resolve; });
  const pending = openRearCamera(s.video, { mediaDevices: s.mediaDevices, signal: abort.signal });
  abort.abort(); allow(s.stream);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(s.stopped, 1); assert.equal(s.video.srcObject, undefined);
});

test('permission denial, failed playback and no video frames are retryable failures', async () => {
  const s = setup();
  await assert.rejects(openRearCamera(s.video, { mediaDevices: { async getUserMedia() { throw new DOMException('denied', 'NotAllowedError'); } } }), { name: 'NotAllowedError' });
  s.video.play = async () => { throw new Error('play failed'); };
  await assert.rejects(openRearCamera(s.video, { mediaDevices: s.mediaDevices }), /play failed/);
  assert.equal(s.stopped, 1);
  s.video.play = async () => {}; s.video.readyState = 0;
  await assert.rejects(openRearCamera(s.video, { mediaDevices: s.mediaDevices, timeoutMs: 10 }), /尚未提供畫面/);
  assert.equal(s.stopped, 2);
});

test('abort while waiting for playback releases the camera instead of leaving it open', async () => {
  const s = setup(), abort = new AbortController(); s.video.play = () => new Promise(() => {});
  const pending = openRearCamera(s.video, { mediaDevices: s.mediaDevices, signal: abort.signal });
  await Promise.resolve(); abort.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(s.stopped, 1);
});
