// Each future student work gets its own stable id and exported GLB / USDZ pair.
// Class, author and blessing belong to the work, not to the AR launch code.
export const arTrees = Object.freeze([
  Object.freeze({
    id: 'gj-2026', title: '格致聖誕樹', author: '格致中學', className: '',
    blessing: '把感恩帶在身邊，讓每個地方都有一點聖誕的光。',
    glb: 'ar/models/gj-2026.glb', usdz: 'ar/models/gj-2026.usdz', heightMeters: 1.65,
  }),
]);

export function findARTree(id = arTrees[0].id) {
  return arTrees.find(tree => tree.id === id) ?? null;
}
