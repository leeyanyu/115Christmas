// Darken only the background layer; text, the canvas and its lights stay crisp.
export function createRotationAtmosphere(canvas) {
  const main = canvas.closest('main');
  const original = main?.style.getPropertyValue('--rotation-dim') ?? '';
  let previous = '';
  return {
    update(strength) {
      const value = (Math.max(0, Math.min(1, strength)) * .85).toFixed(3);
      if (main && value !== previous) { main.style.setProperty('--rotation-dim', value); previous = value; }
    },
    dispose() {
      if (!main) return;
      if (original) main.style.setProperty('--rotation-dim', original);
      else main.style.removeProperty('--rotation-dim');
    },
  };
}
