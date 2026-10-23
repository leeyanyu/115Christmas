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
