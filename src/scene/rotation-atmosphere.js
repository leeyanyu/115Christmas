// Darken only the background layer; text, the canvas and its lights stay crisp.
export function createRotationAtmosphere(canvas) {
  const main = canvas.closest('main');
  const original = main?.style.getPropertyValue('--rotation-dim') ?? '';
  const originalPalm = main?.style.getPropertyValue('--palm-dim') ?? '';
  let previous = '', previousPalm = '';
  return {
    update(strength, palmStrength = 0) {
      const value = (Math.max(0, Math.min(1, strength)) * .85).toFixed(3);
      if (main && value !== previous) { main.style.setProperty('--rotation-dim', value); previous = value; }
      const palm = (Math.max(0, Math.min(1, palmStrength)) * .95).toFixed(3);
      if (main && palm !== previousPalm) { main.style.setProperty('--palm-dim', palm); previousPalm = palm; }
    },
    dispose() {
      if (!main) return;
      if (original) main.style.setProperty('--rotation-dim', original);
      else main.style.removeProperty('--rotation-dim');
      if (originalPalm) main.style.setProperty('--palm-dim', originalPalm);
      else main.style.removeProperty('--palm-dim');
    },
  };
}
