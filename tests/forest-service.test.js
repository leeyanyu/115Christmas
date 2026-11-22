import test from 'node:test';
import assert from 'node:assert/strict';
import { createForestService, validForestEndpoint, validForestImage } from '../src/forest/service.js';
import { forestPlacement } from '../src/forest/view.js';

const endpoint = 'https://script.google.com/macros/s/forest-test/exec';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const design = { title: '冬夜的一束光', engraving: 'Amy', blessing: '平安喜樂' };
function storage() { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; }

test('an unconnected forest is an honest local preview and never posts a shared work', async () => {
  let posted = 0; const client = createForestService({ storage: storage(), post: () => { posted++; } });
  assert.equal(client.configured, false); assert.equal((await client.list()).total, 0);
  client.previewDesign(design, image); const page = await client.list();
  assert.equal(page.local, true); assert.equal(page.total, 1); assert.equal(page.items[0].title, design.title);
  await assert.rejects(client.submit(design, image), /尚未連接/); assert.equal(posted, 0);
  const volatile = createForestService(); volatile.previewDesign(design, image); assert.equal((await volatile.list()).total, 1);
});

test('an opaque upload is confirmed only by its matching server receipt', async () => {
  let payload, receipts = 0, posts = 0;
  const client = createForestService({ endpoint, storage: storage(), wait: async () => {},
    post: async (url, options) => { posts++; payload = Object.fromEntries(options.body); assert.equal(options.mode, 'no-cors'); assert.equal(options.credentials, 'omit'); return { type: 'opaque' }; },
    request: async (url, parameters) => {
      receipts++;
      if (receipts < 3) return { ok: false, pending: true };
      return { ok: true, id: payload.id, requestId: parameters.requestId, updatedAt: '2026-11-22T08:00:00.000Z', visible: true };
    } });
  const [a, b] = await Promise.all([client.submit(design, image), client.submit(design, image)]);
  assert.equal(posts, 1); assert.equal(receipts, 3); assert.equal(a.id, client.ownId); assert.deepEqual(a, b);
  assert.equal(a.item.imageData, image); assert.ok(payload.token);
});

test('server rejection, mismatched receipts and aborts never claim successful submission', async () => {
  const rejected = createForestService({ endpoint, storage: storage(), post: async () => ({}), request: async () => ({ ok: false, message: '寫入失敗' }) });
  await assert.rejects(rejected.submit(design, image), /寫入失敗/);
  assert.equal(rejected.preview, null);
  const mismatched = createForestService({ endpoint, storage: storage(), wait: async () => {}, post: async () => ({}), request: async () => ({ ok: true, id: 'another-tree', requestId: 'another-request' }) });
  await assert.rejects(mismatched.submit(design, image), /還沒收到/);
  const controller = new AbortController();
  const aborted = createForestService({ endpoint, storage: storage(), post: async () => { controller.abort(); return {}; }, request: async () => { throw Error('must not query'); } });
  await assert.rejects(aborted.submit(design, image, controller.signal), error => error.name === 'AbortError');
});

test('a redirect failure after upload can still be resolved by a durable receipt', async () => {
  const client = createForestService({ endpoint, storage: storage(), post: async () => { throw Error('redirect failed'); },
    request: async (url, p) => ({ ok: true, id: client.ownId, requestId: p.requestId, updatedAt: 'v1', visible: true }) });
  assert.equal((await client.submit(design, image)).ok, true);
});

test('owners persist per browser and thumbnails are fetched in small cached batches', async () => {
  const local = storage(), a = createForestService({ endpoint, storage: local });
  let requests = 0;
  const b = createForestService({ endpoint, storage: local, request: async (url, p) => {
    requests++; const ids = p.ids.split(','); assert.ok(ids.length <= 6);
    return { ok: true, images: Object.fromEntries(ids.map(id => [id, image])) };
  } });
  assert.equal(a.ownId, b.ownId);
  const items = Array.from({ length: 14 }, (_, i) => ({ id: 'tree-' + i, updatedAt: 'v1' }));
  assert.equal((await b.loadImages(items)).size, 14); assert.equal(requests, 3);
  await b.loadImages(items); assert.equal(requests, 3);
  await b.loadImages([{ ...items[0], updatedAt: 'v2' }]); assert.equal(requests, 4);
  assert.ok(validForestEndpoint(endpoint)); assert.equal(validForestEndpoint('https://evil.example/exec'), false);
  assert.equal(validForestEndpoint(endpoint + '?extra=1'), false); assert.equal(validForestImage('data:image/svg+xml;base64,abcd'), false);
});

test('forest positions are stable, finite, and spread across three depth rows', () => {
  const entries = Array.from({ length: 24 }, (_, i) => forestPlacement(i, 'id-' + i));
  assert.deepEqual(entries[3], forestPlacement(3, 'id-3'));
  assert.equal(new Set(entries.map(item => item.row)).size, 3);
  assert.ok(entries.every(item => Object.values(item).every(Number.isFinite)));
  assert.ok(entries[23].x > entries[0].x + 1000);
});
