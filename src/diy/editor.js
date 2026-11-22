import { createDesignHistory, foliagePalette, paintPalette, MAX_ORNAMENTS, normalizeDesign } from './design.js';
import { createEditorScene } from './editor-scene.js';

export function createDesignEditor({ dialog, onSave, onOpen, onPublish, onPublished, onBrowse, publishConfigured = false }) {
  const $ = selector => dialog.querySelector(selector);
  let scene, history, selected, returnFocus, tool = 'view';
  let paintColor = paintPalette[0][1];
  let upload, epoch = 0, busy = false, disabledBefore = [];
  const publishNote = publishConfigured ? '送出後，作品圖片、刻字與祝福將公開展示。' : '目前為本機預覽，尚未連接共同收件服務。';
  $('[data-send-forest]').textContent = publishConfigured ? '送出我的樹' : '預覽我的樹';
  const palette = $('[data-palette]');
  const paintPanel = $('[data-paint-panel]');
  foliagePalette.forEach(([name, color]) => {
    const button = document.createElement('button'); button.type = 'button'; button.title = name; button.setAttribute('aria-label', name); button.dataset.foliage = color; button.style.setProperty('--swatch', color); palette.append(button);
  });
  paintPalette.forEach(([name, color]) => {
    const button = document.createElement('button'); button.type = 'button'; button.title = name;
    button.setAttribute('aria-label', name + '筆刷'); button.dataset.paintColor = color; button.style.setProperty('--swatch', color);
    $('[data-paint-palette]').append(button);
  });
  function configure() { scene?.configure(tool, $('[name="ornamentColor"]').value, +$('[name="ornamentSize"]').value, paintColor); }
  function syncTools() {
    dialog.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    dialog.querySelectorAll('[data-paint-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.paintColor === paintColor)));
  }
  function setTool(value) {
    selected = undefined; scene?.select(); $('[data-delete]').disabled = true; tool = value; syncTools(); configure();
    $('[data-editor-notice]').textContent = tool === 'view' ? '拖曳旋轉，雙指或滾輪縮放。' : tool === 'paint' ? '在枝葉上滑動彩繪；切換「旋轉欣賞」可畫另一面。' : tool === 'remove' ? '輕點裝飾即可移除。' : '點枝葉放上裝飾；點裝飾可選取，拖曳可換位置。';
  }
  function update() {
    const value = history.value; scene?.apply(value);
    for (const name of ['title', 'blessing', 'engraving', 'foliageColor', 'starColor']) {
      const input = $('[name="' + name + '"]');
      if (document.activeElement !== input) input.value = value[name];
    }
    $('[data-count]').textContent = `${value.ornaments.length} / ${MAX_ORNAMENTS}`;
    dialog.querySelectorAll('[data-undo]').forEach(b => { b.disabled = !history.canUndo; }); $('[data-redo]').disabled = !history.canRedo;
    $('[data-clear-paint]').disabled = !value.paint.length;
    const ornament = value.ornaments.find(o => o.id === selected);
    if (!ornament) selected = undefined;
    scene?.select(selected); $('[data-delete]').disabled = !ornament;
    if (ornament) { $('[name="ornamentColor"]').value = ornament.color; $('[name="ornamentSize"]').value = ornament.size; }
    palette.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.foliage === value.foliageColor)));
    syncTools(); configure();
  }
  const commit = (value, merge) => { history.commit(value, merge); update(); };
  function select(id) { selected = id; update(); }
  function click(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-cancel')) dialog.close();
    if (button.hasAttribute('data-open-forest') && !busy) { onSave(history.value); dialog.close(); onBrowse?.(); }
    if (button.hasAttribute('data-clear')) {
      const { title, blessing } = history.value; setTool('view'); paintPanel.open = false;
      $('[name="ornamentColor"]').value = '#eacb94'; $('[name="ornamentSize"]').value = '1';
      commit(normalizeDesign({ title, blessing })); scene?.frameTree();
      $('[data-editor-notice]').textContent = '彩繪、裝飾與刻字已清除，配色恢復原樣；可以按「復原」找回。';
    }
    if (button.dataset.tool) setTool(button.dataset.tool);
    if (button.dataset.paintColor) { paintColor = button.dataset.paintColor; setTool('paint'); }
    if (button.hasAttribute('data-clear-paint')) { commit({ ...history.value, paint: [] }); $('[data-editor-notice]').textContent = '彩繪已清除，其他裝飾和刻字保留；可按「復原一筆」找回。'; }
    if (button.dataset.view) {
      setTool('view');
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
  function submitting(value) {
    busy = value; dialog.setAttribute('aria-busy', String(value));
    $('.diy-panel').inert = value; $('.diy-preview').inert = value;
    if (value) { disabledBefore = [...dialog.querySelectorAll('button:not([data-cancel])')].map(button => [button, button.disabled]); disabledBefore.forEach(([button]) => { button.disabled = true; }); }
    else { disabledBefore.forEach(([button, disabled]) => { button.disabled = disabled; }); disabledBefore = []; }
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (!event.submitter?.hasAttribute('data-send-forest')) { onSave(history.value); dialog.close(); return; }
    const value = history.value, current = epoch; upload = new AbortController(); submitting(true);
    $('[data-publish-status]').textContent = publishConfigured ? '正在準備圖片並送出，請稍候…' : '正在準備你的森林預覽…';
    try {
      // Keep the editable draft even if the upload is cancelled or interrupted.
      onSave(value);
      const image = scene.captureImage();
      const result = await onPublish(value, image, upload.signal);
      if (epoch !== current || !dialog.open) return;
      submitting(false); dialog.close(); onPublished?.(result);
    } catch (error) {
      if (epoch === current && dialog.open && error.name !== 'AbortError') $('[data-publish-status]').textContent = error.message || '送出未完成，作品仍在這裡，可以再試一次。';
    } finally { if (epoch === current) { submitting(false); upload = undefined; } }
  }
  function close() {
    epoch++; upload?.abort(); upload = undefined; submitting(false);
    scene?.dispose(); scene = null;
    // A lost WebGL context stays attached to its canvas. A fresh element lets
    // the next visit allocate a clean context while releasing the old one.
    const canvas = $('canvas'); canvas.replaceWith(canvas.cloneNode(false));
    returnFocus?.focus();
  }
  function togglePaint() {
    if (!dialog.open || !history) return;
    if (paintPanel.open) setTool('paint'); else if (tool === 'paint') setTool('view');
  }
  dialog.addEventListener('click', click); dialog.addEventListener('input', input); $('form').addEventListener('submit', submit); dialog.addEventListener('close', close);
  paintPanel.addEventListener('toggle', togglePaint);
  return {
    open(design) {
      if (dialog.open) return; epoch++; returnFocus = document.activeElement; onOpen?.(); history = createDesignHistory(design); selected = undefined; tool = 'view';
      $('[data-publish-status]').textContent = publishNote;
      paintPanel.open = false; syncTools(); dialog.showModal();
      try { scene = createEditorScene($('canvas'), { design: history.value, onChange: commit, onSelect: select, onNotice: text => { $('[data-editor-notice]').textContent = text; } }); update(); $('[data-editor-notice]').textContent = '拖曳旋轉，雙指或滾輪縮放。'; }
      catch (error) { dialog.close(); console.error(error); onSave(null, '編輯器無法開啟，請確認瀏覽器已啟用硬體加速。'); }
    },
    dispose() { scene?.dispose(); paintPanel.removeEventListener('toggle', togglePaint); dialog.removeEventListener('click', click); dialog.removeEventListener('input', input); $('form').removeEventListener('submit', submit); dialog.removeEventListener('close', close); },
  };
}
