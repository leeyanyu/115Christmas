import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTreePaint } from '../src/diy/tree-paint.js';
import { createDisplayTree } from '../src/diy/design-layer.js';
import { createDistantModel } from '../src/diy/distant-tree.js';
import { createARTree, disposeARTree } from '../src/ar/model.js';
import { normalizeDesign, createDesignHistory, saveDesign, loadDesign, MAX_PAINT_DABS } from '../src/diy/design.js';
import { encodeDesign, decodeDesign } from '../src/diy/design-link.js';

const dab = { color: '#eacb94', radius: .23, position: [0, 2, .8], normal: [0, 0, 1] };

test('a front stroke remains attached to the mesh and never paints its nearby back face', () => {
  const root = new THREE.Group(), layer = new THREE.Group(); root.add(layer); layer.position.y = 1.5;
  const material = new THREE.MeshStandardMaterial({ color: '#164d3c' });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material), back = front.clone();
  front.position.z = .01; back.position.z = -.01; back.rotation.y = Math.PI; layer.add(front, back);
  const original = front.geometry, bounds = new THREE.Box3().setFromBufferAttribute(original.attributes.position);
  const paint = createTreePaint({ root, layers: [layer] });
  const stroke = [{ color: '#eacb94', radius: .4, position: [0, 1.5, .01], normal: [0, 0, 1] }];
  paint.apply(stroke, '#164d3c');
  const base = new THREE.Color('#164d3c'), frontColors = front.geometry.attributes.color.array;
  assert.ok(Array.from(frontColors).some((v, i) => i % 3 === 0 && v > base.r + .1));
  const backColors = back.geometry.attributes.color.array;
  for (let i = 0; i < backColors.length; i += 3) assert.ok(Math.abs(backColors[i] - base.r) < 1e-6);
  const paintedBounds = new THREE.Box3().setFromBufferAttribute(front.geometry.attributes.position);
  assert.ok(paintedBounds.min.distanceTo(bounds.min) < 1e-6 && paintedBounds.max.distanceTo(bounds.max) < 1e-6);
  const savedColors = frontColors.slice(); root.rotation.y = 2; root.scale.setScalar(.2); paint.apply(stroke, '#164d3c');
  assert.deepEqual(front.geometry.attributes.color.array, savedColors);
  material.emissive.set('#eacb94'); material.emissiveIntensity = .3; paint.syncLighting();
  assert.equal(front.material.emissiveIntensity, .3); assert.equal(front.material.emissive.getHexString(), 'eacb94');
  paint.apply([]); assert.equal(front.geometry, original); assert.equal(front.material, material);
  paint.dispose(); original.dispose(); material.dispose();
});

test('painting the real foliage preserves its silhouette, ornaments and a bounded vertex budget', () => {
  const { tree, layer } = createDisplayTree(normalizeDesign()); tree.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 8), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObjects(tree.layers, true)[0]; assert.ok(hit);
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const design = normalizeDesign({ paint: [{ ...dab, position: hit.point.toArray(), normal: normal.toArray() }] });
  layer.apply(design);
  let vertices = 0, changed = 0; const base = new THREE.Color(design.foliageColor);
  tree.layers.forEach(group => group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const colors = mesh.geometry.attributes.color; vertices += colors.count;
    for (let i = 0; i < colors.count; i++) if (colors.getX(i) > base.r + .02) changed++;
  }));
  assert.ok(changed > 0); assert.ok(vertices < 150000, `vertex count: ${vertices}`);
  assert.equal(layer.targets.length, 0);
  layer.apply(null); assert.ok(tree.layers[0].children.every(mesh => !mesh.geometry.attributes.color)); layer.dispose();
});

test('paint participates in whole-stroke undo, redo, deep-copying and browser persistence', () => {
  const history = createDesignHistory();
  history.commit({ ...history.value, paint: [dab, { ...dab, position: [.1, 2, .8] }] });
  assert.equal(history.undo().paint.length, 0); assert.equal(history.redo().paint.length, 2);
  const copy = history.value; copy.paint[0].position[0] = 100; assert.equal(history.value.paint[0].position[0], 0);
  let saved; const storage = { setItem(key, value) { saved = value; }, getItem() { return saved; } };
  assert.ok(saveDesign(storage, history.value, true)); assert.deepEqual(loadDesign(storage).design, history.value);
  const restored = normalizeDesign({ ornaments: [], foliageColor: '#9382a6' }); assert.deepEqual(restored.paint, []);
  assert.equal(normalizeDesign({ paint: Array(1000).fill(dab) }).paint.length, MAX_PAINT_DABS);
  assert.deepEqual(normalizeDesign({ paint: [{ ...dab, position: [NaN, 1, 0] }, { ...dab, normal: [0, 0, 0] }] }).paint, []);
});

test('portable links preserve painted and legacy designs and reject malformed paint payloads', () => {
  const design = normalizeDesign({ title: '冬夜的光', paint: Array.from({ length: MAX_PAINT_DABS }, (_, i) => ({ ...dab, position: [i / 200, 2, .8] })) });
  const encoded = encodeDesign(design); assert.ok(encoded.length < 48000); assert.deepEqual(decodeDesign(encoded), design);
  const legacy = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify([1, '舊作品', '', '', '#164d3c', '#eacb94', []])))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  assert.equal(decodeDesign(legacy).title, '舊作品'); assert.deepEqual(decodeDesign(legacy).paint, []);
  const invalid = btoa(JSON.stringify([1, 'A', '', '', '#164d3c', '#eacb94', [], [['#ffffff', .23, 0, 1, 'bad', 0, 0, 1]]]));
  assert.equal(decodeDesign(invalid), null);
});

test('distant batching and the AR model retain the saved foliage colors', () => {
  const design = normalizeDesign({ paint: [dab] });
  const distant = createDistantModel(design, false);
  const painted = distant.children.filter(o => o.material?.vertexColors);
  assert.ok(painted.length > 0); assert.ok(painted.every(o => o.geometry.attributes.color));
  assert.ok(distant.children.length <= 10);
  const ar = createARTree(1.65, design); let colored = 0;
  ar.traverse(o => { if (o.isMesh && o.material.vertexColors && o.geometry.attributes.color) colored++; });
  assert.equal(colored, 108); disposeARTree(ar);
});
