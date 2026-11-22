import { validForestImage } from './service.js';

export function forestPlacement(index, id) {
  let seed = 0; for (const character of id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  const row = index % 3, column = Math.floor(index / 3);
  return { x: 160 + column * 230 + row * 74 + seed % 35, row, scale: [1, .82, .66][row], width: 275, bottom: [7, 22, 35][row] + seed % 3 };
}

export function createCommunityForest({ dialog, service, onOpen = () => {}, onClose = () => {} }) {
  const $ = selector => dialog.querySelector(selector), scroll = $('[data-forest-scroll]'), grove = $('[data-forest-grove]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let controller, generation = 0, nextCursor = null, previousCursor = null, returnFocus, open = false, closing = false, closeTimer, pushed = false;
  let pageCursor = 0;
  const status = text => { $('[data-forest-status]').textContent = text; };
  const buttons = busy => { dialog.querySelectorAll('[data-forest-refresh], [data-forest-next], [data-forest-previous]').forEach(button => { button.disabled = busy; }); };
  function makeFigure(item, index) {
    const figure = document.createElement('figure'), position = forestPlacement(index, item.id);
    figure.className = 'forest-tree' + (item.id === service.ownId ? ' is-mine' : ''); figure.dataset.treeId = item.id;
    figure.style.setProperty('--tree-x', position.x + 'px'); figure.style.setProperty('--tree-bottom', position.bottom + '%');
    figure.style.setProperty('--tree-size', position.width * position.scale + 'px'); figure.style.zIndex = String(3 - position.row);
    const picture = document.createElement('img'); picture.alt = [item.title, item.author, item.blessing].filter(Boolean).join(' · ');
    picture.loading = 'lazy'; picture.decoding = 'async'; picture.width = 420; picture.height = 540;
    picture.addEventListener('error', () => { picture.hidden = true; figure.classList.add('image-missing'); });
    const caption = document.createElement('figcaption'); caption.textContent = item.title || '我的聖誕樹';
    const note = document.createElement('span'); note.className = 'forest-tree-note'; note.textContent = item.id === service.ownId ? '我的樹' : item.author || '一份冬夜的心意';
    figure.title = item.blessing || item.title; figure.append(picture, caption, note); return figure;
  }
  async function load(cursor = 0, focusId, message) {
    controller?.abort(); controller = new AbortController(); const signal = controller.signal, current = ++generation;
    buttons(true); dialog.setAttribute('aria-busy', 'true'); status(service.configured ? '正在走進大家的森林…' : '本機預覽：尚未連接 Google 收件服務。');
    try {
      const result = await service.list(cursor, signal, focusId); if (current !== generation || !open) return;
      pageCursor = result.cursor ?? cursor;
      nextCursor = result.nextCursor; previousCursor = result.previousCursor ?? (pageCursor > 0 ? Math.max(0, pageCursor - 24) : null);
      $('[data-forest-count]').textContent = service.configured ? `${result.total} 棵心意，在這裡相遇` : `本機預覽 · ${result.items.length} 棵樹`;
      $('[data-forest-local]').hidden = service.configured;
      $('[data-forest-next]').hidden = nextCursor == null; $('[data-forest-previous]').hidden = previousCursor == null;
      grove.replaceChildren(); scroll.scrollLeft = 0;
      const figures = result.items.map((item, index) => { const figure = makeFigure(item, index); grove.append(figure); return figure; });
      grove.style.width = Math.max(scroll.clientWidth, Math.ceil(result.items.length / 3) * 230 + 360) + 'px';
      $('[data-forest-empty]').hidden = result.items.length > 0;
      const images = result.items.length ? await service.loadImages(result.items, signal) : new Map();
      if (current !== generation || !open) return;
      let loaded = 0;
      result.items.forEach((item, index) => {
        const imageData = images.get(item.id), figure = figures[index];
        if (validForestImage(imageData)) { figure.querySelector('img').src = imageData; loaded++; }
        else { figure.querySelector('img').hidden = true; figure.classList.add('image-missing'); }
      });
      if (focusId) {
        const index = result.items.findIndex(item => item.id === focusId);
        if (index >= 0) { const x = forestPlacement(index, focusId).x; scroll.scrollTo({ left: Math.max(0, x - scroll.clientWidth / 2), behavior: motion.matches ? 'auto' : 'smooth' }); }
      }
      status(!service.configured ? '目前只有這台裝置的作品；連接 Google 收件服務後，才會看見大家的樹。' : message || (loaded < result.items.length ? '有些作品圖片暫時未載入，可以按「更新森林」重試。' : result.total ? '左右滑動，看看每一棵不同的心意。' : '森林正等著第一棵聖誕樹。'));
    } catch (error) {
      if (error.name !== 'AbortError' && current === generation) status(error.message || '森林暫時無法載入，請重新整理。');
    } finally { if (current === generation) { buttons(false); dialog.setAttribute('aria-busy', 'false'); } }
  }
  function finishClose() {
    closing = false; clearTimeout(closeTimer); dialog.classList.remove('is-leaving'); dialog.close(); document.body.classList.remove('forest-open');
    onClose(); returnFocus?.focus();
  }
  function hide(updateHistory = true) {
    if (!open || closing) return;
    open = false; closing = true; controller?.abort(); generation++; dialog.classList.add('is-leaving');
    if (updateHistory) {
      if (pushed && location.hash === '#forest') history.back();
      else if (location.hash === '#forest') history.replaceState(null, '', location.pathname + location.search);
    }
    pushed = false;
    if (motion.matches) finishClose(); else closeTimer = setTimeout(finishClose, 420);
  }
  function show({ focusId, message, updateHistory = true } = {}) {
    if (closing) finishClose();
    if (!open) {
      returnFocus = document.activeElement; open = true; onOpen(); document.body.classList.add('forest-open'); dialog.showModal();
      $('[data-forest-back]').focus();
      if (updateHistory && location.hash !== '#forest') { history.pushState({ forest: true }, '', '#forest'); pushed = true; }
    }
    if (message) status(message);
    load(0, focusId, message);
  }
  function click(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-forest-back')) hide();
    if (button.hasAttribute('data-forest-refresh')) load(0, service.ownId);
    if (button.hasAttribute('data-forest-next') && nextCursor != null) load(nextCursor);
    if (button.hasAttribute('data-forest-previous') && previousCursor != null) load(previousCursor);
  }
  const cancel = event => { event.preventDefault(); hide(); };
  function key(event) { if (!event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); scroll.scrollBy({ left: event.key === 'ArrowRight' ? 240 : -240, behavior: motion.matches ? 'auto' : 'smooth' }); } }
  const pop = () => { if (location.hash === '#forest') show({ updateHistory: false }); else hide(false); };
  dialog.addEventListener('click', click); dialog.addEventListener('cancel', cancel); dialog.addEventListener('keydown', key); window.addEventListener('popstate', pop);
  return { open: show, close: hide, openFromURL() { if (location.hash === '#forest') show({ updateHistory: false }); },
    dispose() { controller?.abort(); clearTimeout(closeTimer); if (dialog.open) dialog.close(); document.body.classList.remove('forest-open'); dialog.removeEventListener('click', click); dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('keydown', key); window.removeEventListener('popstate', pop); } };
}
