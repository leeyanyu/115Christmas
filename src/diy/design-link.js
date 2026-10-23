import { normalizeDesign } from './design.js';

export function encodeDesign(value) {
  const d = normalizeDesign(value);
  const data = [1, d.title, d.blessing, d.engraving, d.foliageColor, d.starColor,
    d.ornaments.map(o => [o.type, o.color, o.size, ...o.position.map(n => +n.toFixed(4)), ...o.normal.map(n => +n.toFixed(4))])];
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeDesign(encoded) {
  try {
    if (!encoded || encoded.length > 14000 || !/^[\w-]+$/.test(encoded)) return null;
    const raw = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const a = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    if (!Array.isArray(a) || a.length !== 7 || a[0] !== 1 || !Array.isArray(a[6]) || a[6].length > 36) return null;
    if (![a[1], a[2], a[3], a[4], a[5]].every(v => typeof v === 'string')) return null;
    if (!a[6].every(o => Array.isArray(o) && o.length === 9 && o.slice(2).every(Number.isFinite))) return null;
    return normalizeDesign({ title: a[1], blessing: a[2], engraving: a[3], foliageColor: a[4], starColor: a[5],
      ornaments: a[6].map((o, i) => ({ id: i + 1, type: o[0], color: o[1], size: o[2], position: o.slice(3, 6), normal: o.slice(6, 9) })) });
  } catch { return null; }
}
export function designARURL(design, pageURL) {
  const url = new URL('./ar.html', pageURL); url.search = 'tree=diy';
  url.hash = `design=${encodeDesign(design)}`; return url.href;
}
export function designFromURL(pageURL) {
  const url = new URL(pageURL);
  return decodeDesign(new URLSearchParams(url.hash.slice(1)).get('design'));
}
