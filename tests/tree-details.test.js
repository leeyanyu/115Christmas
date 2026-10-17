import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createTreeTheme } from '../src/scene/tree-theme.js';
import { createGingerbread } from '../src/scene/gingerbread.js';

test('tree themes restore the original foliage and leave ornaments untouched', () => {
  const tree = createTree(), material = tree.layers[0].children[0].material;
  const original = material.color.clone(), gold = tree.animated[0].material.color.clone();
  const theme = createTreeTheme(tree);
  theme.set('snow'); theme.update(10, false);
  assert.ok(material.color.r > original.r);
  assert.ok(tree.animated[0].material.color.equals(gold));
  theme.set('classic'); theme.update(10, false);
  assert.ok(Math.abs(material.color.g - original.g) < .001);
  theme.set('aurora'); theme.update(1, true); const color = material.color.clone();
  theme.update(1, true); assert.ok(material.color.equals(color));
  theme.dispose(); assert.ok(material.color.equals(original));
});

test('gingerbread leaves, a new character enters and climbs using the same geometry', () => {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 10);
  const effect = createGingerbread(tree), ginger = tree.root.getObjectByName('hidden-gingerbread');
  const count = ginger.children.length;
  const geometry = ginger.children[0].geometry, firstColor = ginger.children[0].material.color.clone();
  effect.update(2, camera, true, false); const home = ginger.position.clone();
  camera.position.z = -10;
  camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
  effect.update(1.2, camera, true, false); effect.update(.6, camera, true, false);
  assert.ok(ginger.position.y < home.y);
  effect.update(.6, camera, true, false); assert.ok(Math.abs(ginger.position.y - .43) < .001);
  effect.update(.8, camera, true, false); effect.update(.45, camera, true, false);
  assert.ok(ginger.position.y > .43); assert.ok(ginger.scale.x > .9);
  effect.update(2.25, camera, true, false); assert.equal(ginger.visible, false);
  const screen = ginger.getWorldPosition(new THREE.Vector3()).project(camera);
  assert.ok(screen.x > 1.2); assert.ok(ginger.scale.x > .9);
  effect.update(5, camera, true, false); assert.equal(ginger.visible, true);
  assert.ok(ginger.getWorldPosition(new THREE.Vector3()).project(camera).x < -1.2);
  assert.equal(ginger.children[0].geometry, geometry);
  assert.ok(!ginger.children[0].material.color.equals(firstColor));
  effect.update(2.7, camera, true, false); assert.ok(Math.abs(ginger.position.y - .43) < .001);
  effect.update(1.3, camera, true, false); assert.ok(ginger.position.y > .43 && ginger.position.y < home.y);
  effect.update(1.3, camera, true, false);
  assert.equal(ginger.position.y, home.y); assert.equal(ginger.children.length, count);
  assert.ok(Math.hypot(ginger.position.x, ginger.position.z) < 1.4);
  effect.reset(); assert.equal(ginger.visible, false);
  effect.dispose(); assert.equal(tree.root.getObjectByName('hidden-gingerbread'), undefined);
});

test('wide views use shorter grounded hops and reduced motion keeps the climber still', () => {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, 1.8); camera.position.set(0, 3, -10); camera.lookAt(0, 2, 0);
  const effect = createGingerbread(tree), ginger = tree.root.getObjectByName('hidden-gingerbread');
  effect.update(1.2, camera, true, false); effect.update(1.1, camera, true, false); effect.update(.8, camera, true, false);
  effect.update(.24, camera, true, false); assert.ok(ginger.position.y - .43 * .76 <= .20);
  effect.update(.24, camera, true, false); assert.ok(Math.abs(ginger.position.y - .43 * .76) < .001);
  assert.ok(Math.abs(ginger.scale.x - .76) < .001);
  assert.ok(Math.hypot(ginger.position.x, ginger.position.z) >= 2.35 - .001);
  effect.update(.1, camera, true, true); const position = ginger.position.clone();
  effect.update(20, camera, true, true); assert.ok(ginger.position.equals(position));
  effect.dispose();
});

test('gingerbread body stays outside branch volumes through a complete cycle', () => {
  for (const aspect of [1.5, .5]) {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, aspect);
  camera.position.set(0, 3, -10); camera.lookAt(0, 2, 0);
  const effect = createGingerbread(tree), ginger = tree.root.getObjectByName('hidden-gingerbread');
  const branches = [];
  tree.root.updateWorldMatrix(true, true);
  tree.layers.forEach(layer => layer.traverse(mesh => {
    if (mesh.geometry?.type === 'ConeGeometry') branches.push({ inverse: mesh.matrixWorld.clone().invert(), ...mesh.geometry.parameters });
  }));
  const point = new THREE.Vector3(), local = new THREE.Vector3();
  const body = ginger.children[0], positions = body.geometry.attributes.position;
  for (let frame = 0; frame < 210; frame++) {
    const angle = Math.PI + Math.sin(frame * .04) * 1.4;
    camera.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10); camera.lookAt(0, 2, 0);
    effect.update(.1, camera, true, false);
    if (!ginger.visible) continue;
    body.updateWorldMatrix(true, false);
    for (let i = 0; i < positions.count; i += 37) {
      point.fromBufferAttribute(positions, i).applyMatrix4(body.matrixWorld);
      for (const branch of branches) {
        local.copy(point).applyMatrix4(branch.inverse);
        if (local.y <= -branch.height / 2 || local.y >= branch.height / 2) continue;
        const radius = branch.radius * (.5 - local.y / branch.height);
        assert.ok(Math.hypot(local.x, local.z) >= radius - .005, `body penetrates branch at frame ${frame}`);
      }
    }
  }
  effect.dispose();
  }
});

test('side views retain a solid cookie and a visible face without detaching from the tree', () => {
  for (const aspect of [1.5, .5]) {
  const tree = createTree(), camera = new THREE.PerspectiveCamera(37, aspect);
  const effect = createGingerbread(tree), ginger = tree.root.getObjectByName('hidden-gingerbread');
  const body = ginger.children[0].geometry; body.computeBoundingBox();
  const thickness = body.boundingBox.max.z - body.boundingBox.min.z;
  assert.ok(thickness >= .139 && thickness < .15);
  const solid = new THREE.Mesh(body, ginger.children[0].material), ray = new THREE.Raycaster();
  for (const direction of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
    ray.set(direction.clone().multiplyScalar(2).add(new THREE.Vector3(0, .05, 0)), direction.clone().negate());
    assert.ok(ray.intersectObject(solid).length > 0, 'cookie has an open side');
  }
  const normal = new THREE.Vector3(), view = new THREE.Vector3();
  for (const angle of [-2.4, -1.94, 1.2, 1.4, 2.4, Math.PI]) {
    camera.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10);
    effect.update(1, camera, true, true);
    ginger.updateWorldMatrix(true, true);
    normal.set(0, 0, 1).transformDirection(ginger.matrixWorld);
    view.copy(camera.position).sub(ginger.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(normal.dot(view) > .6, `face disappears at angle ${angle}`);
    assert.ok(Math.hypot(ginger.position.x, ginger.position.z) < (aspect > 1.1 ? 1.4 : 1.5));
  }
  effect.dispose();
  }
});
