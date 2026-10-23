import { createDesignLayer } from './design-layer.js';
import { createDistantTree } from './distant-tree.js';

export function createDesignStage({ tree, theme, initial, ...options }) {
  const layer = createDesignLayer(tree), distant = createDistantTree({ tree, foregroundTargets: () => layer.targets, ...options });
  let saved = initial?.design || null, active = !!(saved && initial.active);
  function style() { layer.apply(active ? saved : null); theme.setBaseColor(active ? saved.foliageColor : null); theme.set('classic'); }
  function backdrop() { distant.appearance(active ? null : saved, !saved); }
  style(); backdrop();
  return {
    get isMoving() { return distant.isMoving; },
    get targets() { return layer.targets; },
    apply(design, nextActive = true) {
      const outgoing = active ? saved : null;
      if (design) saved = design;
      active = !!(saved && nextActive); style(); distant.swap(outgoing, false);
    },
    update(delta, ready, reduced, ratio) { layer.syncGrowth(); distant.update(delta, ready, reduced, ratio); },
    reset() { distant.reset(); backdrop(); },
    dispose() { distant.dispose(); layer.dispose(); },
  };
}
