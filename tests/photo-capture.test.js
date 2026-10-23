import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePhoto } from '../src/ar/photo-capture.js';

test('photo combines the cropped video and tree, in order, and frees the temporary canvas', async () => {
  const video = { videoWidth: 1920, videoHeight: 1080 }, calls = [];
  const context = { drawImage(...args) { calls.push(args); } };
  const canvas = { getContext() { return context; }, toBlob(fn, type, quality) { calls.push([type, quality]); fn(new Blob(['photo'], { type })); } };
  const overlay = { drawOn(ctx, w, h) { assert.equal(ctx, context); calls.push(['tree', w, h]); } };
  const photo = await capturePhoto(video, overlay, { width: 300, height: 600 }, () => canvas);
  assert.deepEqual(calls[0], [video, 690, 0, 540, 1080, 0, 0, 540, 1080]);
  assert.deepEqual(calls[1], ['tree', 540, 1080]);
  assert.equal(photo.type, 'image/jpeg'); assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
});

test('encoding failure produces a retryable error and still releases the canvas', async () => {
  const canvas = { getContext: () => ({ drawImage() {} }), toBlob(fn) { fn(null); } };
  await assert.rejects(capturePhoto({ videoWidth: 640, videoHeight: 480 }, { drawOn() {} }, { width: 300, height: 400 }, () => canvas), /未能儲存/);
  assert.equal(canvas.width, 1); assert.equal(canvas.height, 1);
});
