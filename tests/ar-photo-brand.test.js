import test from 'node:test';
import assert from 'node:assert/strict';
import { CHRISTMAS_BRAND, photoDimensions, drawPhotoBrand, renderBrandedPhoto } from '../src/ar/photo-brand.js';

function context() {
  const calls = [], state = [];
  return { calls, font: '',
    save() { state.push(this.font); }, restore() { this.font = state.pop(); },
    measureText(text) { return { width: text.length * parseFloat(this.font.match(/[\d.]+px/)[0]) * .55 }; },
    createLinearGradient(...args) { calls.push(['gradient', ...args]); return { addColorStop() {} }; },
    fillRect(...args) { calls.push(['shade', ...args]); }, strokeText(...args) { calls.push(['outline', ...args]); },
    fillText(...args) { calls.push(['text', this.font, ...args]); }, drawImage(...args) { calls.push(['image', ...args]); },
  };
}

test('photo exports retain the entire portrait or landscape frame and never upscale a small image', () => {
  assert.deepEqual(photoDimensions(4032, 3024), { width: 2560, height: 1920 });
  assert.deepEqual(photoDimensions(3024, 4032), { width: 1920, height: 2560 });
  assert.deepEqual(photoDimensions(640, 480), { width: 640, height: 480 });
  for (const dimensions of [[0, 10], [10, Infinity], [-1, 10], [NaN, 12]]) assert.throws(() => photoDimensions(...dimensions), /尺寸/);
});

test('both positions bake the exact event title and smaller school name inside the photograph', () => {
  for (const [width, height] of [[1080, 1920], [1920, 1080], [320, 568]]) for (const position of ['top', 'bottom']) {
    const ctx = context(); drawPhotoBrand(ctx, width, height, position);
    const text = ctx.calls.filter(call => call[0] === 'text'), title = text[0], school = text.slice(1);
    assert.equal(title[2], 'Light up Christmas'); assert.equal(school.map(call => call[2]).join(''), 'Ger-Jyh');
    assert.ok(parseFloat(title[1].match(/[\d.]+px/)[0]) > parseFloat(school[0][1].match(/[\d.]+px/)[0]) * 2);
    assert.ok(title[4] > 0 && school.every(call => call[4] > title[4] && call[4] < height));
    assert.ok(position === 'top' ? title[4] < height / 2 : title[4] > height / 2);
    assert.ok(school.every(call => call[3] > 0 && call[3] < width));
  }
  assert.deepEqual(CHRISTMAS_BRAND, { title: 'Light up Christmas', school: 'Ger-Jyh' });
});

test('the downloadable JPEG is encoded after the photograph and event lettering are drawn', async () => {
  const ctx = context(), source = { naturalWidth: 4000, naturalHeight: 3000 }, expected = new Blob(['photo'], { type: 'image/jpeg' });
  const canvas = { getContext: () => ctx, toBlob(callback, format, quality) {
    assert.equal(format, 'image/jpeg'); assert.equal(quality, .94);
    assert.equal(ctx.calls[0][0], 'image'); assert.equal(ctx.calls.filter(call => call[0] === 'text').length, 8);
    callback(expected);
  } };
  assert.equal(await renderBrandedPhoto(source, canvas), expected);
  assert.deepEqual(ctx.calls[0], ['image', source, 0, 0, 2560, 1920]);
  await assert.rejects(renderBrandedPhoto(source, { getContext: () => null }), /無法製作/);
  await assert.rejects(renderBrandedPhoto(source, { getContext: () => context(), toBlob(callback) { callback(null); } }), /未能產生/);
});
