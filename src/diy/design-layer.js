import * as THREE from 'three';
import { createTree } from '../scene/tree.js';
import { createOrnamentFactory } from './ornaments.js';
import { normalizeDesign } from './design.js';

export function createDesignLayer(tree) {
  const original = tree.animated.slice(0, -1), originalStar = tree.starMaterial.color.clone();
  const foliage = new Set(); tree.layers.forEach(layer => layer.traverse(o => { if (o.material?.color) foliage.add(o.material); }));
  const originalColors = new Map([...foliage].map(m => [m, m.color.clone()]));
  const group = new THREE.Group(); group.name = 'diy-ornaments'; tree.root.add(group);
  const items = new Map(), factory = createOrnamentFactory(), normal = new THREE.Vector3(), front = new THREE.Vector3(0, 0, 1);
  let active = false, selected;
  return {
    get targets() { return active ? [...items.values()] : []; },
    getItem(id) { return items.get(id); },
    apply(value) {
      active = !!value; const design = value ? normalizeDesign(value) : null;
      original.forEach(o => { o.visible = !active; }); group.visible = active;
      foliage.forEach(m => m.color.copy(design ? new THREE.Color(design.foliageColor) : originalColors.get(m)));
      tree.starMaterial.color.copy(design ? new THREE.Color(design.starColor) : originalStar);
      const wanted = new Set(design?.ornaments.map(o => o.id));
      for (const [id, item] of items) if (!wanted.has(id)) { group.remove(item); factory.disposeItem(item); items.delete(id); }
      for (const spec of design?.ornaments || []) {
        let item = items.get(spec.id);
        if (item && item.userData.kind !== spec.type) { group.remove(item); factory.disposeItem(item); items.delete(spec.id); item = null; }
        if (!item) { item = factory.create(spec.type, spec.color); item.userData.designId = spec.id; item.userData.kind = spec.type; items.set(spec.id, item); group.add(item); }
        item.position.fromArray(spec.position); item.quaternion.setFromUnitVectors(front, normal.fromArray(spec.normal));
        item.scale.setScalar(spec.size); item.userData.baseSize = spec.size;
        item.userData.colorMaterial.color.set(spec.color);
      }
      this.select(selected);
    },
    select(id) { selected = id; for (const [key, item] of items) { item.userData.colorMaterial.emissive.set(key === id ? 0xeacb94 : 0x000000); item.userData.colorMaterial.emissiveIntensity = key === id ? .12 : 0; } },
    syncGrowth() {
      if (!active) return;
      for (const item of items.values()) {
        const layer = tree.layers[Math.max(0, Math.min(8, Math.round((item.position.y - .65) / .34)))];
        item.scale.setScalar(item.userData.baseSize * Math.max(.001, layer.scale.x));
      }
    },
    dispose() { tree.root.remove(group); items.forEach(item => factory.disposeItem(item)); items.clear(); factory.dispose(); },
  };
}

export function createDisplayTree(design, { bare = false } = {}) {
  const tree = createTree(), layer = createDesignLayer(tree);
  if (design || bare) layer.apply(design || normalizeDesign());
  if (bare) { tree.animated.at(-1).visible = false; tree.bulbs.forEach(b => { b.visible = false; }); tree.wire.visible = false; }
  else {
    tree.bulbs.forEach(b => b.material.color.set(0xffdf91)); tree.starMaterial.emissiveIntensity = .5;
  }
  return { tree, layer };
}
