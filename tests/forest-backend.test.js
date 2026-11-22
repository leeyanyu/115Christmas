import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const source = readFileSync(new URL('../backend/google-apps-script/Code.gs', import.meta.url), 'utf8');
const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
function backend() {
  const rows = [['id','editHash','title','author','blessing','imageFileId','createdAt','updatedAt','status','lastRequestId']];
  const props = new Map([['FOREST_SHEET_ID','sheet-1'], ['FOREST_FOLDER_ID','folder-1']]), cache = new Map(), files = new Map();
  const state = { lockFails: false, cacheFails: false, fileFails: false, maxRows: 1000, sheetsCreated: 0, foldersCreated: 0 };
  const range = (r, c, nr, nc) => ({ getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => rows[r + i - 1]?.[c + j - 1] ?? '')),
    setValues(values) { values.forEach((row, i) => { rows[r + i - 1] ||= []; row.forEach((value, j) => { rows[r + i - 1][c + j - 1] = value; }); }); return this; },
    setFontWeight() { return this; }, setBackground() { return this; }, setNumberFormat() { return this; }, setDataValidation() { return this; } });
  const sheet = { getLastRow: () => rows.length, getRange: range, appendRow: row => rows.push(row), setFrozenRows() {},
    getMaxRows: () => state.maxRows, insertRowsAfter: (r, count) => { state.maxRows += count; }, setName() {} };
  const book = { getId: () => 'sheet-1', getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-1/edit', getSheetByName: () => sheet, getSheets: () => [sheet] };
  const folder = { getId: () => 'folder-1', getUrl: () => 'https://drive.google.com/drive/folders/folder-1', createFile(blob) {
    if (state.fileFails) throw Error('Drive 寫入失敗');
    const id = 'file-' + (files.size + 1), file = { blob, trashed: false, getId: () => id, getBlob: () => blob, setTrashed(value) { this.trashed = value; } }; files.set(id, file); return file;
  } };
  const cacheAPI = { get(key) { if (state.cacheFails) throw Error('quota'); return cache.get(key) || null; }, put(key, value) { if (state.cacheFails) throw Error('quota'); cache.set(key, value); } };
  const context = vm.createContext({ console: { log() {}, warn() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
    SpreadsheetApp: { create() { state.sheetsCreated++; return book; }, openById: () => book, flush() {}, newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build: () => ({}) }) },
    DriveApp: { createFolder() { state.foldersCreated++; return folder; }, getFolderById: () => folder, getFileById: id => { const file = files.get(id); if (!file || file.trashed) throw Error('missing'); return file; } },
    CacheService: { getScriptCache: () => cacheAPI }, LockService: { getScriptLock: () => { let held = false; return { tryLock: () => (held = !state.lockFails), hasLock: () => held, releaseLock: () => { held = false; } }; } },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => [...createHash('sha256').update(value).digest()], base64Decode: value => [...Buffer.from(value, 'base64')], base64Encode: bytes => Buffer.from(bytes).toString('base64'), newBlob: (bytes, mime, name) => ({ getBytes: () => bytes, getContentType: () => mime, name }) },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: text => ({ text, setMimeType(type) { this.type = type; return this; } }) } });
  vm.runInContext(source, context);
  return { rows, props, cache, files, state, setup: () => context.setupForest(), get: p => JSON.parse(context.doGet({ parameter: p }).text), post: p => JSON.parse(context.doPost({ parameter: p }).text), rawGet: p => context.doGet({ parameter: p }) };
}
const request = (extra = {}) => ({ action: 'submit', id: 'tree-abcdefghijklmnop', token: 'secret-abcdefghijklmnop', requestId: 'request-abcdefghijklmnop', imageData, title: '我的聖誕樹', author: 'Amy', blessing: '平安喜樂', ...extra });

test('setup is repeatable, creates private storage once, and expands the sheet before formatting', () => {
  const api = backend(); api.props.clear(); api.setup(); api.setup();
  assert.equal(api.state.sheetsCreated, 1); assert.equal(api.state.foldersCreated, 1); assert.equal(api.state.maxRows, 2001); assert.equal(api.rows.length, 1);
});

test('submission produces a confirmed receipt and public metadata excludes ownership and Drive ids', () => {
  const api = backend(), response = api.post(request()); assert.equal(response.ok, true); assert.equal(api.rows.length, 2);
  assert.deepEqual(api.get({ action: 'receipt', id: response.id, requestId: response.requestId }), response);
  const page = api.get({ action: 'list' }); assert.equal(page.total, 1); assert.equal(page.items[0].title, '我的聖誕樹');
  assert.equal(page.items[0].editHash, undefined); assert.equal(page.items[0].imageFileId, undefined);
  assert.equal(api.get({ action: 'images', ids: response.id }).images[response.id], imageData);
});

test('retry and editing preserve one row, release the replaced image and reject another owner', () => {
  const api = backend(); api.post(request()); api.post(request()); assert.equal(api.rows.length, 2); assert.equal(api.files.size, 1);
  const changed = api.post(request({ requestId: 'request-new-abcdefghijkl', title: '更新的樹' }));
  assert.equal(changed.ok, true); assert.equal(api.rows.length, 2); assert.equal(api.files.get('file-1').trashed, true);
  const attacked = api.post(request({ requestId: 'request-attack-abcdefghij', token: 'different-owner-abcdefghijkl' }));
  assert.equal(attacked.ok, false); assert.equal(api.rows[1][2], '更新的樹'); assert.equal(api.files.size, 2);
});

test('hidden works are absent from listing and images and remain hidden after a legitimate update', () => {
  const api = backend(); api.post(request()); api.get({ action: 'images', ids: request().id }); api.rows[1][8] = 'hidden';
  assert.equal(api.get({ action: 'list' }).total, 0); assert.deepEqual(api.get({ action: 'images', ids: request().id }).images, {});
  assert.equal(api.post(request({ requestId: 'request-hidden-abcdefghij' })).visible, false); assert.equal(api.rows[1][8], 'hidden');
});

test('bad image contents, failed locks and failed Drive writes never create public records', () => {
  for (const kind of ['image', 'lock', 'drive']) {
    const api = backend(); if (kind === 'lock') api.state.lockFails = true; if (kind === 'drive') api.state.fileFails = true;
    const response = api.post(request(kind === 'image' ? { imageData: 'data:image/png;base64,PGh0bWw+ZXZpbDwvaHRtbD4=' } : {}));
    assert.equal(response.ok, false); assert.equal(api.rows.length, 1); assert.equal(api.get({ action: 'list' }).total, 0);
  }
});

test('cache failures still allow durable storage and receipt lookup in the spreadsheet', () => {
  const api = backend(); api.state.cacheFails = true;
  const response = api.post(request()); assert.equal(response.ok, true);
  assert.equal(api.get({ action: 'receipt', id: response.id, requestId: response.requestId }).ok, true);
});

test('GET cannot write, JSONP callbacks are bounded and spreadsheet formula input is stored as text', () => {
  const api = backend(); api.get({ action: 'submit', ...request() }); assert.equal(api.rows.length, 1);
  api.post(request({ title: '=IMPORTXML("evil")' })); assert.ok(api.rows[1][2].startsWith("'="));
  const safe = api.rawGet({ action: 'list', callback: '__gjForest_abcdefghijkl' }); assert.ok(safe.text.startsWith('__gjForest_abcdefghijkl('));
  const bad = api.rawGet({ action: 'list', callback: 'alert(1)//' }); assert.equal(bad.type, 'json'); assert.equal(JSON.parse(bad.text).ok, false);
});

test('pagination is bounded and an updated old tree can be found without loading every image', () => {
  const api = backend();
  for (let i = 0; i < 30; i++) api.post(request({ id: 'tree-abcdefghijklmnop-' + i, requestId: 'request-abcdefghijklmnop-' + i }));
  const first = api.get({ action: 'list', limit: '100' }); assert.equal(first.items.length, 24); assert.equal(first.total, 30); assert.equal(first.nextCursor, 24);
  const last = api.get({ action: 'list', cursor: '24' }); assert.equal(last.items.length, 6); assert.equal(last.previousCursor, 0); assert.equal(last.nextCursor, null);
  const focused = api.get({ action: 'list', focusId: last.items[0].id }); assert.equal(focused.cursor, 24);
  assert.equal(api.get({ action: 'images', ids: first.items.slice(0, 7).map(item => item.id).join(',') }).ok, false);
});
