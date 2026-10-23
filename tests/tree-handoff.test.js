import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTreeHandoff, HANDOFF_DURATION } from '../src/diy/tree-handoff.js';

function hull(points) {
  points.sort((a,b) => a.x-b.x || a.y-b.y);
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const lower=[],upper=[];
  for(const p of points) { while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p); }
  for(const p of points.toReversed()) { while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p); }
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function silhouette(position,camera) {
  const points=[];
  for(const [y,r] of [[0,1.85],[.6,1.7],[2,.95],[3.4,.45],[4.05,.37],[4.4,.03]])
    for(let i=0;i<20;i++)points.push(new THREE.Vector3(Math.cos(i*Math.PI/10)*r,y,Math.sin(i*Math.PI/10)*r).add(position).project(camera));
  return hull(points);
}
function intersects(a,b) {
  for(const poly of [a,b])for(let i=0;i<poly.length;i++) {
    const p=poly[i],q=poly[(i+1)%poly.length],x=q.y-p.y,y=p.x-q.x;
    const av=a.map(p=>p.x*x+p.y*y),bv=b.map(p=>p.x*x+p.y*y);
    if(Math.max(...av)<Math.min(...bv)||Math.max(...bv)<Math.min(...av))return false;
  }
  return true;
}
for(const aspect of [1440/960,390/720,320/850,667/320])for(const angle of [0,.7,2.5]) {
  const distance=Math.max(10,1.95/(Math.tan(37*Math.PI/360)*aspect*.85));
  const camera=new THREE.PerspectiveCamera(37,aspect,.1,100);
  camera.position.set(Math.sin(angle)*distance,3,Math.cos(angle)*distance);camera.lookAt(0,2,0);camera.updateMatrixWorld();
  const forward=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle)),right=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
  const depth=Math.min(distance*4.4,90);
  const far=new THREE.Vector3(camera.position.x,0,camera.position.z).addScaledVector(forward,depth).addScaledVector(right,depth*Math.tan(37*Math.PI/360)*aspect*.79);
  const handoff=createTreeHandoff(camera,far,.25);
  for(let frame=0;frame<=210;frame++) {
    const state=handoff.sample(frame*HANDOFF_DURATION/210);
    assert.ok(state.incoming.distanceTo(state.outgoing)>3.8,`footprints overlap at ${aspect}, frame ${frame}`);
    const depth=state.outgoing.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
    const screen=state.outgoing.clone().project(camera);
    if(depth>camera.far+6||depth<1||Math.abs(screen.x)>1.4)continue;
    assert.equal(intersects(silhouette(state.incoming,camera),silhouette(state.outgoing,camera)),false,`visible silhouettes overlap at ${aspect}, frame ${frame}`);
  }
  const reduced=handoff.sample(.01,true);assert.ok(reduced.done);assert.equal(reduced.incoming.length(),0);assert.ok(reduced.outgoing.distanceTo(far)<1e-8);
}
console.log('Both full tree footprints and projected silhouettes stay separate throughout desktop/mobile handoffs.');
