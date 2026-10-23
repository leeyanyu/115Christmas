export const DESIGN_KEY = 'gj-christmas-diy-v1';
export const MAX_ORNAMENTS = 36;
export const ornamentTypes = ['ball', 'star', 'bow', 'gift'];
export const foliagePalette = [
  ['經典綠', '#164d3c'], ['鼠尾草', '#96af9b'], ['雪白', '#dde7e6'],
  ['柔粉', '#c78b9a'], ['冬夜藍', '#526f94'], ['霧紫', '#9382a6'],
];
const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
const clamp = (v, lo, hi, fallback = lo) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
const text = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '';

export function normalizeDesign(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const ids = new Set();
  const ornaments = [];
  for (const item of Array.isArray(value.ornaments) ? value.ornaments.slice(0, MAX_ORNAMENTS) : []) {
    if (!item || !ornamentTypes.includes(item.type) || !Array.isArray(item.position) || item.position.length !== 3 || !item.position.every(Number.isFinite)) continue;
    const id = Math.round(clamp(item.id, 1, 1e6, ornaments.length + 1));
    if (ids.has(id)) continue; ids.add(id);
    const raw = Array.isArray(item.normal) && item.normal.length === 3 && item.normal.every(Number.isFinite) ? item.normal : [0, 0, 1];
    const length = Math.hypot(...raw);
    ornaments.push({ id, type: item.type, color: color(item.color, '#eacb94'), size: clamp(item.size, .6, 1.8, 1),
      position: [clamp(item.position[0], -1.8, 1.8), clamp(item.position[1], .6, 3.75), clamp(item.position[2], -1.8, 1.8)],
      normal: length > .0001 ? raw.map(n => n / length) : [0, 0, 1] });
  }
  return { version: 1, title: text(value.title, 28) || '我的聖誕樹', blessing: text(value.blessing, 90),
    foliageColor: color(value.foliageColor, '#164d3c'), starColor: color(value.starColor, '#eacb94'), ornaments };
}

export function loadDesign(storage) {
  try {
    const data = JSON.parse(storage.getItem(DESIGN_KEY));
    if (!data || data.design?.version !== 1) return { design: null, active: false };
    return { design: normalizeDesign(data.design), active: data.active === true };
  } catch { return { design: null, active: false }; }
}
export function saveDesign(storage, design, active) {
  try { storage.setItem(DESIGN_KEY, JSON.stringify({ design: normalizeDesign(design), active: !!active })); return true; }
  catch { return false; }
}

export function createDesignHistory(initial) {
  let current = normalizeDesign(initial), past = [], future = [], lastMerge;
  return {
    get value() { return normalizeDesign(current); }, get canUndo() { return past.length > 0; }, get canRedo() { return future.length > 0; },
    commit(value, merge) {
      const next = normalizeDesign(value);
      if (JSON.stringify(next) === JSON.stringify(current)) return this.value;
      if (!merge || merge !== lastMerge) { past.push(current); if (past.length > 32) past.shift(); }
      current = next; future = []; lastMerge = merge; return this.value;
    },
    undo() { if (past.length) { future.push(current); current = past.pop(); } lastMerge = undefined; return this.value; },
    redo() { if (future.length) { past.push(current); current = future.pop(); } lastMerge = undefined; return this.value; },
  };
}
