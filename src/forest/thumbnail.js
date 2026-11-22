import { validForestImage } from './service.js';

// Keep the display variant inside the image: the existing Google storage
// retains these optional chunks without a schema change or redeployment.
const variant = 'tree-only-v1';
const ascii = (bytes, start, count) => String.fromCharCode(...bytes.subarray(start, start + count));
function decode(value) {
  if (!validForestImage(value)) return null;
  const [prefix, data] = value.split(',');
  try {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0)), webp = prefix.includes('webp');
    if (webp ? bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP' : bytes.length < 20 || ![137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)) return null;
    return { prefix, bytes, webp };
  }
  catch { return null; }
}
function findVariant(image) {
  if (!image) return false;
  const { bytes, webp } = image, view = new DataView(bytes.buffer);
  for (let offset = webp ? 12 : 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset + (webp ? 4 : 0), webp), start = offset + 8;
    if (start + length + (webp ? length % 2 : 4) > bytes.length) return false;
    if (ascii(bytes, offset + (webp ? 0 : 4), 4) === (webp ? 'GJTR' : 'gjTr') && ascii(bytes, start, length) === variant) return true;
    offset = start + length + (webp ? length % 2 : 4);
  }
  return false;
}
export const isTreeOnlyThumbnail = value => findVariant(decode(value));

export function markTreeOnlyThumbnail(value) {
  const image = decode(value); if (!image || findVariant(image)) return value;
  const { bytes, webp, prefix } = image, data = new TextEncoder().encode(variant);
  const chunk = new Uint8Array(8 + data.length + (webp ? data.length % 2 : 4)), view = new DataView(chunk.buffer);
  chunk.set(new TextEncoder().encode(webp ? 'GJTR' : 'gjTr'), webp ? 0 : 4);
  view.setUint32(webp ? 4 : 0, data.length, webp); chunk.set(data, 8);
  if (!webp) {
    if (ascii(bytes, bytes.length - 8, 4) !== 'IEND') return value;
    let crc = 0xffffffff;
    for (const byte of chunk.subarray(4, chunk.length - 4)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
    view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  }
  const end = webp ? bytes.length : bytes.length - 12, output = new Uint8Array(bytes.length + chunk.length);
  output.set(bytes.subarray(0, end)); output.set(chunk, end); output.set(bytes.subarray(end), end + chunk.length);
  if (webp) new DataView(output.buffer).setUint32(4, output.length - 8, true);
  let binary = ''; for (let start = 0; start < output.length; start += 4096) binary += String.fromCharCode(...output.subarray(start, start + 4096));
  return prefix + ',' + btoa(binary);
}

export function withoutPedestal(tree, capture) {
  const parts = [...(tree.pedestalParts || []), tree.root.getObjectByName('diy-pedestal-engraving')].filter(Boolean);
  const visible = parts.map(part => part.visible);
  try { parts.forEach(part => { part.visible = false; }); return capture(); }
  finally { parts.forEach((part, index) => { part.visible = visible[index]; }); }
}
