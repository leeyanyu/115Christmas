const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

// The photograph uses the same centered cover crop as the visible video.
export function coverCrop(sourceWidth, sourceHeight, width, height) {
  if (![sourceWidth, sourceHeight, width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error('鏡頭畫面尚未就緒');
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const sw = width / scale, sh = height / scale;
  return { sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh };
}

export function photoDimensions(videoWidth, videoHeight, width, height, maxSide = 1920) {
  const crop = coverCrop(videoWidth, videoHeight, width, height);
  const scale = Math.min(1, maxSide / Math.max(crop.sw, crop.sh));
  return { width: Math.max(1, Math.round(crop.sw * scale)), height: Math.max(1, Math.round(crop.sh * scale)) };
}

// Screen placement only: x is the center and y the bottom of the tree.
// Pinch changes scale and translation, never the model's orientation.
export function createPhotoPlacement() {
  let width = 1, height = 1, ratio = .82;
  let state = { x: .7, y: .9, height: .5 }, base, gesture;
  const pointers = new Map();
  function constrain(next) {
    const h = clamp(next.height, .14, Math.min(.88, .94 * width / height / ratio));
    const half = ratio * h * height / width / 2;
    state = { x: clamp(next.x, half + .02, .98 - half), y: clamp(next.y, h + .02, .98), height: h };
    return { ...state };
  }
  function pair() {
    const [a, b] = [...pointers.values()];
    return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }
      : a ? { ...a, distance: 0 } : null;
  }
  function rebase() { base = { ...state }; gesture = pair(); }
  return {
    get value() { return { ...state }; },
    resize(w, h, modelRatio = ratio) { width = Math.max(1, w); height = Math.max(1, h); ratio = modelRatio; pointers.clear(); return constrain(state); },
    begin(id, x, y) { if (pointers.size >= 2) return; pointers.set(id, { x, y }); rebase(); },
    move(id, x, y) {
      if (!pointers.has(id)) return { ...state };
      pointers.set(id, { x, y }); const current = pair();
      const scale = gesture.distance ? current.distance / gesture.distance : 1;
      const result = constrain({ height: base.height * scale,
        x: (current.x + (base.x * width - gesture.x) * scale) / width,
        y: (current.y + (base.y * height - gesture.y) * scale) / height });
      return result;
    },
    end(id) { pointers.delete(id); rebase(); },
    cancel() { pointers.clear(); rebase(); },
    scale(factor) { const next = constrain({ ...state, height: state.height * factor }); rebase(); return next; },
    setHeight(value) { const next = constrain({ ...state, height: value }); rebase(); return next; },
  };
}
