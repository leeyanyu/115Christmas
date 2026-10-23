import * as THREE from 'three';

const themes = { classic: 0x164d3c, snow: 0xdde7e6, aurora: 0x678fa5 };
export function createTreeTheme(tree) {
  const materials = new Set();
  tree.layers.forEach(layer => layer.traverse(o => { if (o.material?.color) materials.add(o.material); }));
  const original = new Map([...materials].map(m => [m, m.color.clone()]));
  const target = new THREE.Color(themes.classic), tint = new THREE.Color(), snowEmissive = new THREE.Color(0xb6c9d1);
  let theme = 'classic', time = 0, customBase = null;
  return {
    setBaseColor(value) { customBase = value ? new THREE.Color(value) : null; },
    set(value) { if (Object.hasOwn(themes, value)) { theme = value; target.setHex(themes[value]); } },
    update(delta, reducedMotion) {
      time += delta;
      if (theme === 'aurora') target.setHSL(.48 + (reducedMotion ? .06 : (Math.sin(time * .35) + 1) * .11), .65, .18);
      for (const material of materials) {
        tint.copy(theme === 'classic' ? (customBase || original.get(material)) : target);
        material.color.lerp(tint, reducedMotion ? 1 : 1 - Math.exp(-delta * 3));
        // Theme glow follows the existing feedback rather than changing exposure.
        if (theme === 'snow') material.emissive.lerp(snowEmissive, .55);
        else if (theme === 'aurora') { material.emissive.copy(tint); material.emissiveIntensity += .12; }
        else material.emissive.copy(customBase || original.get(material));
      }
    },
    dispose() { original.forEach((color, material) => { material.color.copy(color); }); },
  };
}
