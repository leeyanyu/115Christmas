import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createARTree, disposeARTree } from '../src/ar/model.js';

test('AR reuses the original tree as a floor-aligned, human-sized static PBR model', () => {
  const root = createARTree();
  try {
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(Math.abs(bounds.min.y) < .000001, 'pedestal rests on the detected surface');
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 1.65) < .000001, 'model units are meters');
    assert.ok(root.getObjectByName('GJ-gold-inlay'), 'keep the fine GJ lettering');
    assert.ok(root.getObjectByName('light-wire'));
    let meshes = 0;
    root.traverse(o => {
      assert.equal(!!o.isLight || !!o.isPoints || !!o.isLine, false, 'no scene lights, particles or unsupported line materials');
      assert.equal(o.animations.length, 0);
      assert.equal(!!o.userData.holidayCharacter || !!o.userData.holidayGift, false);
      if (o.isMesh) { meshes++; assert.equal(o.material.isMeshStandardMaterial, true); }
    });
    assert.ok(meshes > 200, 'retain foliage, ornaments and lights from the existing model');
  } finally { disposeARTree(root); }
});

test('DIY AR keeps the chosen foliage, star and custom ornaments without stage actors', () => {
  const root = createARTree(1.65, { foliageColor: '#c78b9a', starColor: '#96af9b', ornaments: [{ id: 1, type: 'gift', color: '#526f94', position: [0,2,1], normal: [0,0,1], size: 1.2 }] });
  try {
    const decorations = root.getObjectByName('diy-ornaments'); assert.equal(decorations.children.length, 1);
    assert.equal(decorations.children[0].children[0].material.color.getHexString(), '526f94');
    let foliage; root.traverse(o => { if (o.geometry?.type === 'ConeGeometry') foliage = o.material; }); assert.equal(foliage.color.getHexString(), 'c78b9a');
    root.traverse(o => { assert.equal(!!o.isPoints || !!o.isLine || !!o.userData.holidayCharacter, false); });
    assert.ok(Math.abs(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y - 1.65) < .000001);
  } finally { disposeARTree(root); }
});
