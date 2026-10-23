import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayTriggers } from '../src/scene/play-triggers.js';
import { createPlayRewards } from '../src/scene/play-rewards.js';

test('only fast manual turns earn stars, with cooldown and cancellation', () => {
  let stars = 0;
  const t = createPlayTriggers(() => stars++, () => {});
  for(let i=0;i<100;i++) t.update(.1,.4,false);
  assert.equal(stars,0);
  for(let i=0;i<100;i++) t.update(.1,.02,true);
  assert.equal(stars,0);
  for(let i=0;i<10;i++) t.update(.1,.4,true);
  assert.equal(stars,1);
  for(let i=0;i<10;i++) t.update(.1,.4,true);
  assert.equal(stars,1);
  t.update(5);t.cancelGesture();
  for(let i=0;i<5;i++) t.update(.1,.4,true);
  t.cancelGesture();for(let i=0;i<5;i++)t.update(.1,.4,true);
  assert.equal(stars,1);
});
test('three consecutive star taps trigger snow; pauses, cooldown and reset work', () => {
  let snow=0;const t=createPlayTriggers(()=>{},()=>snow++);
  t.tapStar();t.update(1.3);t.tapStar();t.tapStar();assert.equal(snow,0);
  t.tapStar();assert.equal(snow,1);
  for(let i=0;i<10;i++)t.tapStar();assert.equal(snow,1);
  t.update(12);t.tapStar();t.tapStar();t.tapStar();assert.equal(snow,2);
  t.reset();t.tapStar();t.tapStar();assert.equal(snow,2);
});
test('rewards reuse buffers, fade out and release resources; reduced motion is still', () => {
  const scene=new THREE.Scene(), r=createPlayRewards(scene,96);
  const p=scene.getObjectByName('christmas-surprises'), storage=p.geometry.attributes.position.array;
  const count=()=>[...p.geometry.attributes.alpha.array].filter(v=>v>0).length;
  r.stars(new THREE.Vector3(0,4,0),false);r.update(.1,1);assert.equal(count(),32);
  r.snow(false);r.update(.1,1);assert.equal(count(),96);
  r.update(11,1);assert.equal(count(),0);assert.equal(p.visible,false);
  r.snow(true);r.update(.1,1);assert.equal(count(),24);const first=storage.slice();
  r.update(.2,1);assert.deepEqual(storage,first);
  for(let i=0;i<100;i++){r.stars(new THREE.Vector3(),false);r.snow(false);r.update(.01,1);}
  assert.equal(p.geometry.attributes.position.array,storage);assert.equal(scene.children.length,1);
  r.reset();assert.equal(count(),0);let disposed=0;
  p.geometry.addEventListener('dispose',()=>disposed++);p.material.addEventListener('dispose',()=>disposed++);
  r.dispose();assert.equal(disposed,2);assert.equal(scene.children.length,0);
});

test('manual pointer distance earns a reward even when damping cancels net rotation', () => {
  let stars = 0;
  const t = createPlayTriggers(() => stars++, () => {});
  for (let i = 0; i < 8; i++) {
    t.update(.1); // Rendered orientation can return to the same angle.
    t.spin(i % 2 ? -.8 : .8, .1);
  }
  assert.equal(stars, 1);
});

test('snow and stars retain varied size and opacity at the same age', () => {
  const scene = new THREE.Scene(), r = createPlayRewards(scene, 96);
  const p = scene.getObjectByName('christmas-surprises');
  r.stars(new THREE.Vector3(0, 4, 0), false);
  r.snow(false); r.update(.2, 1, 15);
  const sizes = p.geometry.attributes.size.array, alpha = p.geometry.attributes.alpha.array;
  for (const [start, end] of [[0, 32], [32, 96]]) {
    const subset = sizes.slice(start, end), opacity = alpha.slice(start, end);
    assert.ok(Math.max(...subset) > Math.min(...subset) * 2);
    assert.ok(Math.max(...opacity) > Math.min(...opacity) * 1.5);
  }
  assert.equal(p.material.uniforms.focusDistance.value, 15);
  r.dispose();
});
test('palm stars can be brighter without increasing particle count; other bursts keep their original brightness', () => {
  const scene = new THREE.Scene(), rewards = createPlayRewards(scene, 96);
  const points = scene.getObjectByName('christmas-surprises');
  rewards.stars(new THREE.Vector3(0, 4, 0), false, true, 2);
  rewards.update(.2, 1);
  assert.equal(points.material.uniforms.starBrightness.value, 2);
  assert.equal([...points.geometry.attributes.alpha.array].filter(v => v > 0).length, 24);
  rewards.stars(new THREE.Vector3(0, 4, 0), false);
  assert.equal(points.material.uniforms.starBrightness.value, 1);
  rewards.stars(new THREE.Vector3(0, 4, 0), true, false, 2);
  assert.ok(points.material.uniforms.starBrightness.value <= 1.25);
  rewards.dispose();
});
