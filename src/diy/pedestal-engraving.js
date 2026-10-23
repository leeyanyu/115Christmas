import * as THREE from 'three';

// System fonts support Chinese names without downloading another font package.
// A shallow shadow and highlight make the lettering read as an inset inlay.
export function createPedestalEngraving(tree, { createCanvas = () => globalThis.document?.createElement('canvas') } = {}) {
  const root = new THREE.Group(); root.name = 'diy-pedestal-engraving'; root.visible = false;
  root.position.set(0, .0825, -1.43); root.rotation.set(-Math.PI / 2, 0, Math.PI); tree.root.add(root);
  let current = '', canvas, texture, mesh;
  return {
    set(value = '') {
      if (value === current) return;
      current = value; root.visible = false;
      if (!value) return;
      canvas ||= createCanvas(); if (!canvas) return;
      canvas.width = 1024; canvas.height = 160;
      const context = canvas.getContext('2d'); if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = '500 94px "Songti TC", "PMingLiU", "Noto Serif CJK TC", serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      const width = context.measureText(value).width;
      const scale = Math.min(1, 930 / Math.max(1, width));
      context.save(); context.translate(512, 80); context.scale(scale, 1);
      context.fillStyle = '#06131b'; context.fillText(value, -1.5, -2);
      context.fillStyle = '#ddc793'; context.fillText(value, 1, 1.5);
      context.fillStyle = '#ad8c53'; context.fillText(value, 0, 0); context.restore();
      if (!texture) {
        texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .035, depthWrite: false,
          metalness: .42, roughness: .5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, .185), material); mesh.name = 'personal-name-inlay'; root.add(mesh);
      }
      texture.needsUpdate = true; root.visible = true;
    },
    dispose() { tree.root.remove(root); mesh?.geometry.dispose(); mesh?.material.dispose(); texture?.dispose(); },
  };
}
