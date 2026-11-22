import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { isTreeOnlyThumbnail, markTreeOnlyThumbnail, withoutPedestal } from '../src/forest/thumbnail.js';
import { validForestImage } from '../src/forest/service.js';

const fixtures = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR4nGM06on6/+3NG0amb2/eMDIwMDAAAFTtB7lAlRmqAAAAAElFTkSuQmCC',
  webp: 'UklGRlQAAABXRUJQVlA4WAoAAAAQAAAAAQAAAQAAQUxQSAUAAAAA/wAAAABWUDggKAAAAHABAJ0BKgIAAgABQCYloAJ0AUAAAP7rjl1xc2RFH/zBP/f7/v95LgA=',
};
function chunks(value, webp) {
  const bytes = Buffer.from(value.split(',')[1], 'base64'), list = [];
  for (let offset = webp ? 12 : 8; offset + 8 <= bytes.length;) {
    const length = webp ? bytes.readUInt32LE(offset + 4) : bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + (webp ? 0 : 4), offset + (webp ? 4 : 8));
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (!webp) assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(bytes.subarray(offset + 4, offset + 8 + length)));
    list.push({ type, payload }); offset += 8 + length + (webp ? length % 2 : 4);
  }
  return list;
}
for (const [format, data] of Object.entries(fixtures)) test(`${format} thumbnails preserve encoded pixels and transparency while recording the forest variant`, () => {
  const old = `data:image/${format};base64,${data}`, marked = markTreeOnlyThumbnail(old), webp = format === 'webp';
  assert.equal(isTreeOnlyThumbnail(old), false); assert.equal(isTreeOnlyThumbnail(marked), true);
  assert.equal(markTreeOnlyThumbnail(marked), marked); assert.ok(validForestImage(marked));
  assert.deepEqual(chunks(marked, webp).filter(chunk => !['GJTR', 'gjTr'].includes(chunk.type)), chunks(old, webp));
  if (webp) { const bytes = Buffer.from(marked.split(',')[1], 'base64'); assert.equal(bytes.readUInt32LE(4), bytes.length - 8); }
  assert.equal(isTreeOnlyThumbnail(marked.slice(0, -20)), false);
});

test('forest capture hides the plinth, rim, signature and personal engraving and restores the editor after failure', () => {
  const tree = createTree(), engraving = new THREE.Group(); engraving.name = 'diy-pedestal-engraving'; tree.root.add(engraving);
  tree.pedestalParts[1].visible = false;
  const parts = [...tree.pedestalParts, engraving], before = parts.map(part => part.visible);
  const capture = () => {
    assert.ok(parts.every(part => !part.visible));
    assert.ok(tree.trunk.visible && tree.layers.every(layer => layer.visible) && tree.animated.at(-1).visible);
    return 'captured';
  };
  assert.equal(withoutPedestal(tree, capture), 'captured'); assert.deepEqual(parts.map(part => part.visible), before);
  assert.throws(() => withoutPedestal(tree, () => { capture(); throw Error('canvas failure'); }), /canvas failure/);
  assert.deepEqual(parts.map(part => part.visible), before);
});

test('invalid image data never acquires a tree-only marker', () => {
  for (const value of ['', null, 'data:image/png;base64,AAAAAA==', 'data:image/webp;base64,AAAAAA==']) {
    assert.equal(isTreeOnlyThumbnail(value), false); assert.equal(markTreeOnlyThumbnail(value), value);
  }
});
