import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTree } from '../src/scene/tree.js';
import { createGingerbread } from '../src/scene/gingerbread.js';
import { createHolidayVisitors } from '../src/scene/holiday-visitors.js';

function camera(aspect = 1.5) {
  const camera = new THREE.PerspectiveCamera(37, aspect);
  camera.position.set(0, 3, -10); camera.lookAt(0, 2, 0); camera.updateMatrixWorld(); return camera;
}

test('character diffuse fill leaves the tree materials and scene lights untouched', () => {
  const tree = createTree(), foliage = tree.layers[0].children[0].material;
  const original = foliage.onBeforeCompile, color = foliage.color.clone();
  const visitors = createHolidayVisitors(tree);
  for (const name of ['hidden-gingerbread', 'hidden-candy-cane']) {
    const root = tree.root.getObjectByName(name), material = root.children[0].material;
    const shader = { uniforms: {}, fragmentShader: '#include <lights_fragment_end>' };
    material.onBeforeCompile(shader);
    assert.ok(shader.uniforms.characterFill.value.r > .5);
    assert.match(shader.fragmentShader, /reflectedLight.indirectDiffuse/);
    assert.equal(material.emissiveIntensity, 1); assert.equal(material.emissive.getHex(), 0);
  }
  assert.equal(foliage.onBeforeCompile, original); assert.ok(foliage.color.equals(color));
  let lights = 0; tree.root.traverse(o => { if (o.isLight) lights++; }); assert.equal(lights, 0);
  visitors.dispose();
});

test('tapping a perched or climbing visitor starts a continuous fall and cannot restart it', () => {
  for (const kind of ['gingerbread', 'candy-cane']) {
    const tree = createTree(), view = camera(1), actor = createGingerbread(tree, { kind, autoCycle: false, linger: 20 });
    assert.equal(actor.drop(), false);
    actor.update(.1, view, true, false);
    const perched = actor.root.position.y;
    assert.equal(actor.drop(), true); assert.equal(actor.drop(), false);
    actor.update(.3, view, true, false); assert.ok(actor.root.position.y < perched);
    actor.hide(); actor.arrive(); actor.update(.1, view, true, false); actor.update(2.7, view, true, false);
    actor.update(1.2, view, true, false); const climbing = actor.root.position.y;
    assert.ok(climbing > .43 && climbing < perched);
    assert.equal(actor.drop(), true); actor.update(0, view, true, false);
    assert.equal(actor.root.position.y, climbing);
    actor.update(.4, view, true, false); assert.ok(actor.root.position.y < climbing);
    actor.update(.1, view, true, true); const position = actor.root.position.clone();
    assert.equal(actor.drop(), true); actor.update(10, view, true, true);
    assert.ok(actor.root.position.equals(position)); actor.dispose();
  }
});

test('random casts include both solo visitors and a pair, with bounded reusable resources', () => {
  for (const [aspect, angle] of [[1.5, Math.PI], [.5, Math.PI], [1.5, 0], [.5, 1.5], [1.5, -1.5]]) {
  const tree = createTree(), view = camera(), drops = [];
  view.aspect = aspect; view.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10); view.lookAt(0, 2, 0); view.updateProjectionMatrix(); view.updateMatrixWorld();
  const count = tree.root.children.length;
  const visitors = createHolidayVisitors(tree, { random: () => .9, onDrop: kind => drops.push(kind) });
  const roots = ['hidden-gingerbread', 'hidden-candy-cane'].map(name => tree.root.getObjectByName(name));
  const geometries = roots.map(root => root.children[0].geometry);
  visitors.update(.1, view, true, false);
  const casts = [];
  for (let round = 0; round < 4; round++) {
    let settled = false;
    for (let i = 0; i < 600; i++) {
      visitors.update(.1, view, true, false);
      if (visitors.targets.length === 2) assert.ok(visitors.targets[0].position.distanceTo(visitors.targets[1].position) > .48, `visitors overlap at angle ${angle}, round ${round}, step ${i}: ${visitors.targets.map(root => root.position.toArray())}`);
      if (visitors.targets.length && !visitors.isPerforming) { settled = true; break; }
    }
    assert.ok(settled, `cast ${round} never settled`);
    casts.push(visitors.targets.map(root => root.userData.holidayCharacter).sort().join('+'));
    if (visitors.targets.length === 2) assert.ok(visitors.targets[0].position.distanceTo(visitors.targets[1].position) > .8);
    for (const root of visitors.targets) assert.equal(visitors.tap(root.children[0]), true);
  }
  assert.equal(new Set(casts).size, 3);
  assert.ok(drops.includes('candy-cane')); assert.ok(drops.includes('gingerbread'));
  assert.equal(tree.root.children.length, count + 2);
  roots.forEach((root, i) => assert.equal(root.children[0].geometry, geometries[i]));
  visitors.reset(); visitors.update(.1, view, true, true);
  const initial = visitors.targets[0].position.clone(); visitors.update(100, view, true, true);
  assert.equal(visitors.targets.length, 1); assert.ok(visitors.targets[0].position.equals(initial));
  let disposedTextures = 0; roots[1].children[0].material.map.addEventListener('dispose', () => disposedTextures++);
  visitors.dispose(); assert.equal(tree.root.children.length, count); assert.equal(disposedTextures, 1);
  }
});

test('the rounded candy cane stays outside branches while falling, hopping, and climbing', () => {
  for (const aspect of [1.5, .5]) {
    const tree = createTree(), view = camera(aspect);
    const actor = createGingerbread(tree, { kind: 'candy-cane', homeAngle: -2.65, homeHeight: 2.35 });
    const branches = []; tree.root.updateWorldMatrix(true, true);
    tree.layers.forEach(layer => layer.traverse(mesh => {
      if (mesh.geometry?.type === 'ConeGeometry') branches.push({ inverse: mesh.matrixWorld.clone().invert(), ...mesh.geometry.parameters });
    }));
    const body = actor.root.children[0], positions = body.geometry.attributes.position;
    const point = new THREE.Vector3(), local = new THREE.Vector3();
    for (let frame = 0; frame < 230; frame++) {
      const angle = Math.PI + Math.sin(frame * .035) * 1.3;
      view.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10); view.lookAt(0, 2, 0);
      actor.update(.1, view, true, false);
      if (!actor.root.visible) continue;
      body.updateWorldMatrix(true, false);
      for (let i = 0; i < positions.count; i += 13) {
        point.fromBufferAttribute(positions, i).applyMatrix4(body.matrixWorld);
        for (const branch of branches) {
          local.copy(point).applyMatrix4(branch.inverse);
          if (local.y <= -branch.height / 2 || local.y >= branch.height / 2) continue;
          assert.ok(Math.hypot(local.x, local.z) >= branch.radius * (.5 - local.y / branch.height) - .005, `candy penetrates branch at frame ${frame}`);
        }
      }
    }
    actor.dispose();
  }
});
