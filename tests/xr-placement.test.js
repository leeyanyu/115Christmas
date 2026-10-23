import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFloorHit, placeSpatialTree, spatialScale } from '../src/ar/xr-placement.js';

test('AR accepts horizontal hit poses in reference space, ignoring walls and lost poses', () => {
  const floor = new THREE.Matrix4().makeTranslation(1, -.8, -2), wall = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const frame = { getHitTestResults: () => [
    { getPose: () => null }, { getPose: () => ({ transform: { matrix: wall.toArray() } }) },
    { getPose: () => ({ transform: { matrix: floor.toArray() } }) },
  ] };
  const target = new THREE.Matrix4(); assert.equal(readFloorHit(frame, {}, {}, target), true); assert.deepEqual(target.elements, floor.elements);
  assert.equal(readFloorHit({ getHitTestResults: () => [] }, {}, {}, target), false);
});

test('the placed 3D tree keeps its world position when the camera moves and scales around its base', () => {
  const tree = new THREE.Group(), pose = new THREE.Matrix4().makeTranslation(1, -.8, -2), camera = new THREE.Vector3(0, 0, 0);
  placeSpatialTree(tree, pose, camera);
  assert.deepEqual(tree.position.toArray(), [1, -.8, -2]); assert.equal(tree.visible, true);
  const position = tree.position.clone(); camera.set(3, 1, 2); tree.scale.setScalar(spatialScale(1.4));
  assert.deepEqual(tree.position.toArray(), position.toArray());
  assert.equal(spatialScale(.001), .35); assert.equal(spatialScale(100), 1.8);
});
