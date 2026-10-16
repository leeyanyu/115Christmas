import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInteractionParticles } from '../src/scene/interaction-particles.js';

const active = points => [...points.geometry.attributes.alpha.array].filter(value => value > 0).length;

test('burst drifts from its origin and expires within 1.5 seconds', () => {
  const scene = new THREE.Scene();
  const pool = createInteractionParticles(scene);
  const points = scene.getObjectByName('interaction-starlight');
  const origin = new THREE.Vector3(1, 2, 3);
  pool.burst(origin, false, false);
  pool.update(.01, 1);
  assert.equal(active(points), 12);
  const first = points.geometry.attributes.position.array.slice(0, 36);
  assert.ok(Math.abs(first[0] - origin.x) < .01);
  pool.update(.3, 1);
  assert.notDeepEqual(points.geometry.attributes.position.array.slice(0, 36), first);
  pool.update(1.2, 1);
  assert.equal(active(points), 0);
  assert.equal(points.visible, false);
  pool.dispose();
});

test('reduced motion remains stationary; constrained mode uses eight particles', () => {
  const scene = new THREE.Scene();
  const pool = createInteractionParticles(scene, 48);
  const points = scene.getObjectByName('interaction-starlight');
  pool.burst(new THREE.Vector3(1, 2, 3), true, true);
  pool.update(.01, 1);
  assert.equal(active(points), 8);
  const first = points.geometry.attributes.position.array.slice();
  pool.update(.3, 1);
  assert.deepEqual(points.geometry.attributes.position.array, first);
  pool.dispose();
});

test('repeated bursts and trails reuse bounded storage and release GPU resources', () => {
  const scene = new THREE.Scene();
  const pool = createInteractionParticles(scene, 48);
  const points = scene.getObjectByName('interaction-starlight');
  const geometry = points.geometry, material = points.material;
  const storage = geometry.attributes.position.array;
  for (let i = 0; i < 500; i++) {
    pool.burst(new THREE.Vector3(1, 2, 0), false, true);
    pool.trail(new THREE.Vector3(1, 2, 0), .8);
    pool.update(.001, 1);
  }
  assert.equal(scene.children.length, 1);
  assert.equal(active(points), 48);
  assert.equal(geometry.attributes.position.array, storage);
  pool.reset();
  assert.equal(active(points), 0);
  assert.equal(points.visible, false);
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  material.addEventListener('dispose', () => disposed++);
  pool.dispose();
  assert.equal(disposed, 2);
  assert.equal(scene.children.length, 0);
});
