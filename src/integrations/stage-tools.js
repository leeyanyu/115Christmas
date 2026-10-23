import './stage-tools.css';

// One set of real controls serves the desktop row and mobile disclosure.
// Keeping the original buttons preserves AR URLs and fullscreen user gestures.
export function createStageTools(root, media = window.matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1024px)')) {
  const button = root.querySelector('#stage-tools-toggle');
  const items = root.querySelector('#stage-tools-items');
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  let open = false;
  function sync() {
    root.dataset.open = String(open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? '收合聖誕樹工具' : '展開 DIY、AR 與全螢幕工具');
    items.inert = media.matches && !open;
    if (media.matches && !open) items.setAttribute('aria-hidden', 'true');
    else items.removeAttribute('aria-hidden');
  }
  function close(restoreFocus = false) {
    if (!open) return;
    open = false;
    if (restoreFocus || items.contains(doc.activeElement)) button.focus();
    sync();
  }
  const toggle = () => { open = !open; sync(); };
  const outside = event => { if (!root.contains(event.target)) close(); };
  const choose = event => { if (event.target.closest('button, a')) close(); };
  const escape = event => { if (open && event.key === 'Escape') { event.preventDefault(); close(true); } };
  const resize = () => { if (media.matches && items.contains(doc.activeElement)) button.focus(); open = false; sync(); };
  const fullscreen = () => close();
  button.addEventListener('click', toggle);
  items.addEventListener('click', choose);
  doc.addEventListener('pointerdown', outside);
  doc.addEventListener('focusin', outside);
  doc.addEventListener('keydown', escape);
  doc.addEventListener('fullscreenchange', fullscreen);
  doc.addEventListener('webkitfullscreenchange', fullscreen);
  media.addEventListener('change', resize);
  view.addEventListener('resize', resize);
  sync();
  return {
    dispose() {
      button.removeEventListener('click', toggle); items.removeEventListener('click', choose);
      doc.removeEventListener('pointerdown', outside); doc.removeEventListener('focusin', outside); doc.removeEventListener('keydown', escape);
      doc.removeEventListener('fullscreenchange', fullscreen); doc.removeEventListener('webkitfullscreenchange', fullscreen);
      media.removeEventListener('change', resize); view.removeEventListener('resize', resize);
      items.inert = false; items.removeAttribute('aria-hidden');
    },
  };
}
