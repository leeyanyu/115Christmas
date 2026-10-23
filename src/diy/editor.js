import { createDesignHistory, foliagePalette, MAX_ORNAMENTS } from './design.js';
import { createEditorScene } from './editor-scene.js';

export function createDesignEditor({ dialog, onSave, onOpen }) {
  const $ = selector => dialog.querySelector(selector);
  let scene, history, selected, returnFocus, tool = 'view';
  const palette = $('[data-palette]');
  foliagePalette.forEach(([name, color]) => {
    const button = document.createElement('button'); button.type = 'button'; button.title = name; button.setAttribute('aria-label', name); button.dataset.foliage = color; button.style.setProperty('--swatch', color); palette.append(button);
  });
  function configure() { scene?.configure(tool, $('[name="ornamentColor"]').value, +$('[name="ornamentSize"]').value); }
  function update() {
    const value = history.value; scene?.apply(value);
    for (const name of ['title', 'blessing', 'engraving', 'foliageColor', 'starColor']) {
      const input = $('[name="' + name + '"]');
      if (document.activeElement !== input) input.value = value[name];
    }
    $('[data-count]').textContent = `${value.ornaments.length} / ${MAX_ORNAMENTS}`;
    $('[data-undo]').disabled = !history.canUndo; $('[data-redo]').disabled = !history.canRedo;
    const ornament = value.ornaments.find(o => o.id === selected);
    if (!ornament) selected = undefined;
    scene?.select(selected); $('[data-delete]').disabled = !ornament;
    if (ornament) { $('[name="ornamentColor"]').value = ornament.color; $('[name="ornamentSize"]').value = ornament.size; }
    palette.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.foliage === value.foliageColor)));
    configure();
  }
  const commit = (value, merge) => { history.commit(value, merge); update(); };
  function select(id) { selected = id; update(); }
  function click(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-cancel')) dialog.close();
    if (button.dataset.tool) { selected = undefined; scene?.select(); $('[data-delete]').disabled = true; tool = button.dataset.tool; dialog.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); $('[data-editor-notice]').textContent = tool === 'view' ? '拖曳旋轉，雙指或滾輪縮放。' : tool === 'remove' ? '輕點裝飾即可移除。' : '點枝葉放上裝飾；點裝飾可選取，拖曳可換位置。'; configure(); }
    if (button.dataset.view) {
      tool = 'view'; dialog.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool))); configure();
      if (button.dataset.view === 'engraving') scene?.showEngraving(); else scene?.frameTree();
      $('[data-editor-notice]').textContent = button.dataset.view === 'engraving' ? '拖曳欣賞刻字，按「看整棵樹」返回。' : '拖曳旋轉，雙指或滾輪縮放。';
    }
    if (button.dataset.foliage) commit({ ...history.value, foliageColor: button.dataset.foliage });
    if (button.hasAttribute('data-undo')) { history.undo(); update(); }
    if (button.hasAttribute('data-redo')) { history.redo(); update(); }
    if (button.hasAttribute('data-delete')) { commit({ ...history.value, ornaments: history.value.ornaments.filter(o => o.id !== selected) }); }
  }
  function input(event) {
    const { name, value } = event.target; if (!history) return;
    if (['title', 'blessing', 'engraving', 'foliageColor', 'starColor'].includes(name)) commit({ ...history.value, [name]: value }, name);
    if (['ornamentColor', 'ornamentSize'].includes(name)) {
      if (selected) commit({ ...history.value, ornaments: history.value.ornaments.map(o => o.id === selected ? { ...o, [name === 'ornamentColor' ? 'color' : 'size']: name === 'ornamentColor' ? value : +value } : o) }, name + selected);
      configure();
    }
  }
  function submit(event) { event.preventDefault(); onSave(history.value); dialog.close(); }
  function close() {
    scene?.dispose(); scene = null;
    // A lost WebGL context stays attached to its canvas. A fresh element lets
    // the next visit allocate a clean context while releasing the old one.
    const canvas = $('canvas'); canvas.replaceWith(canvas.cloneNode(false));
    returnFocus?.focus();
  }
  dialog.addEventListener('click', click); dialog.addEventListener('input', input); $('form').addEventListener('submit', submit); dialog.addEventListener('close', close);
  return {
    open(design) {
      if (dialog.open) return; returnFocus = document.activeElement; onOpen?.(); history = createDesignHistory(design); selected = undefined; tool = 'view';
      dialog.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool))); dialog.showModal();
      try { scene = createEditorScene($('canvas'), { design: history.value, onChange: commit, onSelect: select, onNotice: text => { $('[data-editor-notice]').textContent = text; } }); update(); $('[data-editor-notice]').textContent = '拖曳旋轉，雙指或滾輪縮放。'; }
      catch (error) { dialog.close(); console.error(error); onSave(null, '編輯器無法開啟，請確認瀏覽器已啟用硬體加速。'); }
    },
    dispose() { scene?.dispose(); dialog.removeEventListener('click', click); dialog.removeEventListener('input', input); $('form').removeEventListener('submit', submit); dialog.removeEventListener('close', close); },
  };
}
