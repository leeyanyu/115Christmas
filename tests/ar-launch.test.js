import test from 'node:test';
import assert from 'node:assert/strict';
import { arTrees, findARTree } from '../src/ar/catalog.js';
import { arPlatform, arLaunchURL, arShareURL } from '../src/ar/launch.js';

const page = 'https://leeyanyu.github.io/115Christmas/ar.html?tree=gj-2026';
test('AR uses native placement on supported iOS and Android, with honest browser fallback', () => {
  assert.equal(arPlatform({ userAgent: 'iPhone' }, true), 'quick-look');
  assert.equal(arPlatform({ platform: 'MacIntel', maxTouchPoints: 5 }, true), 'quick-look');
  assert.equal(arPlatform({ userAgent: 'iPhone' }), 'ios-browser');
  assert.equal(arPlatform({ userAgent: 'Linux; Android 15' }), 'scene-viewer');
  assert.equal(arPlatform({ userAgent: 'Windows NT 10.0', maxTouchPoints: 10 }), 'desktop');
  const tree = findARTree();
  assert.equal(arLaunchURL(tree, 'quick-look', page, '/115Christmas/'), 'https://leeyanyu.github.io/115Christmas/ar/models/gj-2026.usdz');
  assert.equal(arLaunchURL(tree, 'desktop', page, '/115Christmas/'), null);
  assert.equal(arLaunchURL(tree, 'ios-browser', page, '/115Christmas/'), null);
  const intent = arLaunchURL(tree, 'scene-viewer', page, '/115Christmas/');
  assert.match(intent, /package=com.google.ar.core;/);
  const params = new URLSearchParams(intent.split('?')[1].split('#Intent')[0]);
  assert.equal(params.get('mode'), 'ar_only', 'do not present a floating 3D viewer as anchored AR');
  assert.equal(params.get('resizable'), 'true');
  assert.equal(params.get('file'), 'https://leeyanyu.github.io/115Christmas/ar/models/gj-2026.glb');
  const fallback = new URL(decodeURIComponent(intent.match(/S.browser_fallback_url=([^;]+)/)[1]));
  assert.equal(fallback.searchParams.get('tree'), tree.id);
  assert.equal(fallback.searchParams.get('ar-fallback'), '1');
});

test('each work has a stable share link; unknown ids never silently show another student work', () => {
  assert.equal(findARTree('missing-student'), null);
  assert.equal(findARTree('<script>'), null);
  assert.equal(new Set(arTrees.map(t => t.id)).size, arTrees.length);
  assert.equal(arShareURL(findARTree(), page + '&ar-fallback=1#test'), page);
  const future = { id: 'bilingual-A-01', title: '小安的樹 & 祝福', glb: 'ar/models/student.glb', usdz: 'ar/models/student.usdz' };
  const intent = arLaunchURL(future, 'scene-viewer', page, '/115Christmas/');
  const params = new URLSearchParams(intent.split('?')[1].split('#Intent')[0]);
  assert.equal(params.get('title'), future.title);
  assert.equal(new URL(arShareURL(future, page)).searchParams.get('tree'), future.id);
});
