import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPedestalEngraving } from '../src/diy/pedestal-engraving.js';
import { createDistantModel } from '../src/diy/distant-tree.js';

const drawn = [];
const context = { clearRect() {}, measureText(value) { return { width: value.length * 90 }; }, save() {}, translate() {}, scale() {}, restore() {}, fillText(value) { drawn.push(value); } };
const createCanvas = () => ({ width: 0, height: 0, getContext() { return context; } });
const tree = { root: new THREE.Group() };
const engraving = createPedestalEngraving(tree, { createCanvas });
engraving.set('王小明 Amy');
const root = tree.root.getObjectByName('diy-pedestal-engraving'), mesh = root.children[0];
assert.equal(root.visible, true); assert.ok(root.position.z < 0, 'inscription lies behind the front GJ');
assert.equal(mesh.material.map.colorSpace, THREE.SRGBColorSpace);
assert.deepEqual(drawn, ['王小明 Amy', '王小明 Amy', '王小明 Amy']);
const texture = mesh.material.map, version = texture.version;
engraving.set('王小明 Amy'); assert.equal(texture.version, version, 'unchanged names do not redraw');
engraving.set('Grace'); assert.equal(mesh.material.map, texture, 'editing reuses one texture');
engraving.set(''); assert.equal(root.visible, false);
let disposed = 0; texture.addEventListener('dispose', () => disposed++); engraving.dispose();
assert.equal(disposed, 1); assert.equal(tree.root.children.length, 0);
// Distant batching must keep a separate, live texture for the inscription.
globalThis.document = { createElement: createCanvas };
const distant = createDistantModel({ engraving: 'Amy' }, false);
const lettering = distant.children.find(o => o.material?.map);
assert.ok(lettering); assert.ok(Number.isFinite(lettering.material.userData.baseEmissiveIntensity)); assert.ok(lettering.material.map.image); assert.ok(lettering.material.map.version > 0);
assert.ok(distant.children.filter(o => !o.material?.map).length > 1, 'other meshes retain untextured materials');
delete globalThis.document;
console.log('Engraving supports Chinese, reuses textures, cleans up and survives distant-tree baking.');
