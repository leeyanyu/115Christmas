export function createInteractionGuide({ button, dialog, onTheme, onOpen = () => {} }) {
  const close = dialog.querySelector('[data-close-guide]');
  function open() { onOpen(); if (!dialog.open) dialog.showModal(); }
  function dismiss() { dialog.close(); }
  function backdrop(event) { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss(); } }
  function choose(event) {
    const option = event.target.closest('[data-tree-theme]'); if (!option) return;
    onTheme(option.dataset.treeTheme);
    dialog.querySelectorAll('[data-tree-theme]').forEach(b => b.setAttribute('aria-pressed', String(b === option)));
  }
  button.addEventListener('click', open); close.addEventListener('click', dismiss);
  dialog.addEventListener('click', backdrop); dialog.addEventListener('click', choose);
  return { dispose() { if (dialog.open) dismiss(); button.removeEventListener('click', open); close.removeEventListener('click', dismiss); dialog.removeEventListener('click', backdrop); dialog.removeEventListener('click', choose); } };
}
