const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ease = t => t * t * (3 - 2 * t);

// A finite extra arc follows each completed swipe. New hand movement takes
// over immediately; stopping the camera or taking manual control cancels it.
export function createHandRotation() {
  let queued = 0, sinceInput = 1, sinceMove = 1, direction = 0, peak = 0;
  let armed = false, flickTime = -1, flickArc = 0, strokeDistance = 0, quietAfter = .16;
  function reset() { queued = peak = direction = strokeDistance = 0; sinceInput = sinceMove = 1; armed = false; flickTime = -1; flickArc = 0; quietAfter = .16; }
  return {
    get isActive() { return Math.abs(queued) > .0001 || armed || flickTime >= 0; },
    input(input, ready) {
      if (!ready || input.reset) { reset(); return; }
      const sampleGap = clamp(sinceInput, .06, .4);
      sinceInput = 0;
      const turn = input.present ? input.turn || 0 : 0;
      if (Math.abs(turn) < .006) { quietAfter = Math.min(quietAfter, sinceMove + .06); return; }
      const sign = Math.sign(turn);
      if (sign !== direction) { queued = 0; peak = strokeDistance = 0; }
      peak = Math.max(Math.abs(turn) / sampleGap, peak * .8);
      strokeDistance = Math.min(1.5, strokeDistance + Math.abs(turn));
      // A slower camera must not be mistaken for a hand stopping between frames.
      quietAfter = clamp(sampleGap * 1.35, .16, .38);
      direction = sign; sinceMove = 0; armed = true;
      flickTime = -1; flickArc = 0;
      queued = clamp(queued + turn, -1.5, 1.5);
    },
    update(delta, reducedMotion, ready) {
      sinceInput += delta; sinceMove += delta;
      if (!ready || sinceInput >= .85) { reset(); return 0; }
      if (reducedMotion) { armed = false; flickTime = -1; peak = strokeDistance = 0; }
      if (armed && sinceMove >= quietAfter) {
        armed = false;
        if (peak >= .6 || strokeDistance > .08) {
          flickTime = 0; flickArc = direction * clamp(strokeDistance * .4 + peak * .12, .25, .75);
        }
        peak = strokeDistance = 0;
      }
      let step = clamp(queued * (1 - Math.exp(-delta * 9)), -delta * 1.5, delta * 1.5);
      queued -= step;
      if (Math.abs(queued) < .0001) queued = 0;
      if (flickTime >= 0) {
        const previous = flickTime / .52;
        flickTime = Math.min(.52, flickTime + delta);
        step += flickArc * (ease(flickTime / .52) - ease(previous));
        if (flickTime >= .52) flickTime = -1;
      }
      return clamp(step, -delta * 2.6, delta * 2.6) * (reducedMotion ? .4 : 1);
    },
    reset,
  };
}
