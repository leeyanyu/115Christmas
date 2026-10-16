// Gesture-only rewards: automatic rotation and inertia cannot earn a spin reward.
export function createPlayTriggers(onStars, onSnow) {
  let time = 0, energy = 0, cooldown = 0, taps = 0, lastTap = -Infinity, snowUntil = 0;
  function earn(delta, turn, manual) {
      if (manual && delta > 0 && Math.abs(turn) / delta > .65 && time >= cooldown) {
        energy += Math.min(Math.abs(turn), .7);
        if (energy >= Math.PI) { energy = 0; cooldown = time + 5; onStars(); }
      }
  }
  return {
    update(delta, turn = 0, manual = false) {
      time += delta;
      energy = Math.max(0, energy - delta * .45);
      earn(delta, turn, manual);
      if (time - lastTap > 1.2) taps = 0;
    },
    spin(turn, seconds) { earn(seconds, turn, true); },
    tapStar() {
      if (time < snowUntil) return;
      taps = time - lastTap <= 1.2 ? taps + 1 : 1;
      lastTap = time;
      if (taps === 3) { taps = 0; snowUntil = time + 12; onSnow(); }
    },
    cancelGesture() { energy = 0; taps = 0; },
    reset() { time = 0; energy = 0; cooldown = 0; taps = 0; lastTap = -Infinity; snowUntil = 0; },
  };
}
