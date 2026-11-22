import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

// Paint belongs to the tree's local surface, so it survives orbiting, growth,
// storage and standard mesh export. Subdivision keeps the original silhouette.
export function createTreePaint(tree) {
  const records = [], materials = new Map(), unit = new THREE.Vector3(1, 1, 1);
  const modifier = new TessellateModifier(.14, 7);
  const base = new THREE.Color(), ink = new THREE.Color(), sphere = new THREE.Sphere();
  let previous = [], previousBase;

  function prepare() {
    if (records.length) return;
    tree.layers.forEach(layer => {
      const layerMatrix = new THREE.Matrix4().compose(layer.position, layer.quaternion, unit);
      layer.traverse(mesh => {
        if (!mesh.isMesh) return;
        const originalGeometry = mesh.geometry, originalMaterial = mesh.material;
        mesh.updateMatrix();
        const transform = layerMatrix.clone().multiply(mesh.matrix);
        const geometry = modifier.modify(originalGeometry);
        const positions = geometry.attributes.position.clone().applyMatrix4(transform);
        const normals = geometry.attributes.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform));
        const colors = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
        colors.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('color', colors);
        if (!materials.has(originalMaterial)) {
          const material = originalMaterial.clone();
          material.color.setHex(0xffffff); material.vertexColors = true;
          materials.set(originalMaterial, material);
        }
        records.push({ mesh, originalGeometry, originalMaterial, geometry, material: materials.get(originalMaterial),
          positions: positions.array, normals: normals.array, colors,
          box: new THREE.Box3().setFromBufferAttribute(positions) });
      });
    });
  }

  function stamp(dab) {
    ink.set(dab.color); sphere.center.fromArray(dab.position); sphere.radius = dab.radius;
    const radiusSquared = dab.radius * dab.radius, [nx, ny, nz] = dab.normal;
    for (const record of records) {
      if (!record.box.intersectsSphere(sphere)) continue;
      const { positions: p, normals: n, colors } = record, c = colors.array;
      let changed = false;
      for (let i = 0; i < p.length; i += 3) {
        // A stroke on the front never bleeds through to the back of a bough.
        if (n[i] * nx + n[i + 1] * ny + n[i + 2] * nz <= .05) continue;
        const dx = p[i] - sphere.center.x, dy = p[i + 1] - sphere.center.y, dz = p[i + 2] - sphere.center.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared >= radiusSquared) continue;
        const weight = .92 * (1 - distanceSquared / radiusSquared) ** 2;
        c[i] += (ink.r - c[i]) * weight; c[i + 1] += (ink.g - c[i + 1]) * weight; c[i + 2] += (ink.b - c[i + 2]) * weight;
        changed = true;
      }
      if (changed) colors.needsUpdate = true;
    }
  }

  return {
    apply(paint = [], baseColor = '#164d3c') {
      if (!paint.length) {
        records.forEach(r => { r.mesh.geometry = r.originalGeometry; r.mesh.material = r.originalMaterial; });
        previous = []; previousBase = undefined; return;
      }
      prepare();
      const signatures = paint.map(dab => JSON.stringify(dab));
      const append = previousBase === baseColor && previous.length <= signatures.length && previous.every((v, i) => v === signatures[i]);
      records.forEach(r => { r.mesh.geometry = r.geometry; r.mesh.material = r.material; });
      if (!append) {
        base.set(baseColor);
        records.forEach(({ colors }) => {
          const c = colors.array;
          for (let i = 0; i < c.length; i += 3) { c[i] = base.r; c[i + 1] = base.g; c[i + 2] = base.b; }
          colors.needsUpdate = true;
        });
      }
      for (const dab of paint.slice(append ? previous.length : 0)) stamp(dab);
      previous = signatures; previousBase = baseColor;
    },
    syncLighting() {
      if (!previous.length) return;
      for (const [original, material] of materials) {
        material.emissive.copy(original.emissive); material.emissiveIntensity = original.emissiveIntensity;
      }
    },
    dispose() {
      records.forEach(r => { r.mesh.geometry = r.originalGeometry; r.mesh.material = r.originalMaterial; r.geometry.dispose(); });
      materials.forEach(m => m.dispose()); materials.clear(); records.length = 0; previous = []; previousBase = undefined;
    },
  };
}
