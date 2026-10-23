const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Geometry is relative to the palm, so it also works for a tilted left hand.
export function readPalm(landmarks, aspect = 4 / 3) {
  if (landmarks?.length !== 21 || landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const p = landmarks.map(point => ({ x: point.x * aspect, y: point.y }));
  const size = distance(p[0], p[9]);
  if (size < .035) return null; // Too far away for a reliable pose.
  const fingers = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];
  const extended = fingers.every(([base, joint, tip]) =>
    distance(p[tip], p[0]) > distance(p[joint], p[0]) * 1.16
    && distance(p[tip], p[base]) > size * .55);
  const thumb = distance(p[4], p[17]) > distance(p[3], p[17]) * 1.08
    && distance(p[4], p[5]) > size * .48;
  const indices = [0, 5, 9, 13, 17];
  return { x: 1 - indices.reduce((sum, i) => sum + landmarks[i].x, 0) / 5,
    y: indices.reduce((sum, i) => sum + landmarks[i].y, 0) / 5, open: extended && thumb };
}

// Time-based, independent of detector/browser frame rate. Closing a fist does
// not rearm a light; a lowered/absent hand must be confirmed first.
export function createHandGestures({ holdSeconds = 1, releaseSeconds = .7 } = {}) {
  let previous = null, filtered = null, rotationAnchor = 0, holdAnchor = null;
  let hold = 0, missingSince = null, loweredSince = null, latched = false;
  let lastTime = null;
  function suspend() { previous = filtered = holdAnchor = null; hold = 0; lastTime = null; }
  function update(palm, now) {
    const gap = lastTime === null ? 0 : now - lastTime;
    // Rotation can bridge a slower sample; lighting still requires continuous
    // stable observations and never counts a long stalled frame toward a hold.
    const dt = gap > 0 && gap <= .9 ? gap : 0;
    lastTime = now;
    let turn = 0, trigger = false, state = 'searching';
    if (!palm) {
      missingSince ??= now;
      if (now - missingSince >= releaseSeconds) latched = false;
      const grace = !!previous && now - missingSince < .3;
      if (!grace) previous = filtered = null;
      holdAnchor = null; hold = 0; loweredSince = null;
      return { present: false, grace, turn, trigger, progress: 0, state };
    }
    missingSince = null;
    if (palm.y > .86) {
      loweredSince ??= now;
      if (now - loweredSince >= releaseSeconds) latched = false;
      previous = filtered = holdAnchor = null; hold = 0;
      return { present: false, turn, trigger, progress: 0, state: 'lowered' };
    }
    loweredSince = null;
    if (!previous || !dt) {
      filtered = { x: palm.x, y: palm.y }; rotationAnchor = palm.x;
      previous = { ...palm }; holdAnchor = { ...palm }; hold = 0;
      return { present: true, turn, trigger, progress: 0, state: latched ? 'latched' : 'ready' };
    }
    const smoothing = 1 - Math.exp(-dt * 12);
    const dx = palm.x - previous.x, dy = palm.y - previous.y;
    // A sudden tracking handoff/reacquisition must not spin the tree.
    if (Math.hypot(dx, dy) > .45) {
      suspend();
      return { present: true, turn, trigger, progress: 0, state: 'ready' };
    }
    filtered.x += (palm.x - filtered.x) * smoothing;
    filtered.y += (palm.y - filtered.y) * smoothing;
    const travel = filtered.x - rotationAnchor;
    if (Math.abs(travel) >= .004) { turn = clamp(travel * 4, -1.2, 1.2); rotationAnchor = filtered.x; }
    const moving = Math.hypot(dx, dy) / dt > .11
      || (holdAnchor && distance(palm, holdAnchor) > .024);
    previous = { ...palm };
    if (moving || !palm.open || gap > .65 || !holdAnchor) {
      hold = 0; holdAnchor = { ...palm }; state = moving ? 'moving' : 'ready';
    } else if (latched) { hold = 0; state = 'latched'; }
    else { hold += Math.min(dt, .25); state = 'holding'; }
    if (hold >= holdSeconds) { latched = true; trigger = true; hold = 0; state = 'latched'; }
    return { present: true, turn, trigger, progress: latched ? 0 : clamp(hold / holdSeconds, 0, 1), state };
  }
  return { update, suspend, reset() { suspend(); missingSince = loweredSince = null; latched = false; } };
}
