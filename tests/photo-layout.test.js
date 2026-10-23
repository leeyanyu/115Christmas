import test from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop, photoDimensions, createPhotoPlacement } from '../src/ar/photo-layout.js';

test('saved photo matches the visible cover crop in portrait and landscape without stretching', () => {
  assert.deepEqual(coverCrop(1920, 1080, 300, 600), { sx: 690, sy: 0, sw: 540, sh: 1080 });
  assert.deepEqual(coverCrop(1080, 1920, 600, 300), { sx: 0, sy: 690, sw: 1080, sh: 540 });
  assert.deepEqual(photoDimensions(2160, 3840, 300, 600), { width: 960, height: 1920 });
  assert.deepEqual(photoDimensions(640, 480, 300, 600), { width: 240, height: 480 });
  assert.throws(() => coverCrop(0, 1080, 300, 600), /尚未就緒/);
});

test('single-finger placement and pinch scale keep the whole tree in view; lifting a finger does not jump', () => {
  const p = createPhotoPlacement(); p.resize(400, 600);
  const initial = p.value;
  p.begin(1, 150, 250); const moved = p.move(1, 100, 220);
  assert.ok(moved.x < initial.x); assert.ok(moved.y < initial.y); assert.equal(moved.height, initial.height);
  p.begin(2, 200, 220); const larger = p.move(2, 240, 220);
  assert.ok(larger.height > initial.height);
  assert.deepEqual(Object.keys(larger).sort(), ['height', 'x', 'y'], 'gestures never create a rotation value');
  p.end(2); const before = p.value; assert.deepEqual(p.move(1, 100, 220), before);
  const small = p.scale(.01); assert.equal(small.height, .14);
  const big = p.scale(100); assert.ok(big.height <= .88); assert.ok(big.y - big.height >= .019);
  const halfWidth = .82 * big.height * 600 / 400 / 2;
  assert.ok(big.x - halfWidth >= .019); assert.ok(big.x + halfWidth <= .981);
  p.cancel(); assert.deepEqual(p.move(1, 300, 500), big);
  const landscape = p.resize(800, 300);
  assert.ok(landscape.y - landscape.height >= .019);
});
