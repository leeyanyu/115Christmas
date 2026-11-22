import { renderBrandedPhoto } from './photo-brand.js';

export function createPhotoFilter({ dialog, openButton }) {
  const $ = selector => dialog.querySelector(selector), input = $('[data-photo-file]'), canvas = $('canvas');
  const choose = $('[data-photo-choose]'), position = $('select'), download = $('[data-photo-download]'), share = $('[data-photo-share]');
  const note = $('[data-photo-status]');
  let generation = 0, image, sourceURL, outputURL, file, decoding, returnFocus;
  function busy(value) { dialog.setAttribute('aria-busy', String(value)); choose.disabled = value; position.disabled = value; share.disabled = value; download.hidden = value || !file; }
  function release() {
    document.body.classList.remove('photo-filter-open');
    generation++; if (decoding) { decoding.src = ''; decoding = undefined; }
    if (sourceURL) URL.revokeObjectURL(sourceURL); if (outputURL) URL.revokeObjectURL(outputURL);
    sourceURL = outputURL = image = file = undefined;
    canvas.width = canvas.height = 1; canvas.hidden = true; $('[data-photo-placeholder]').hidden = false; choose.textContent = '選擇合照或截圖';
    $('[data-photo-controls]').hidden = true; input.value = ''; position.value = 'bottom'; busy(false);
  }
  function show() { if (dialog.open) return; returnFocus = document.activeElement; note.textContent = '照片只在這台裝置處理。'; document.body.classList.add('photo-filter-open'); dialog.showModal(); }
  function closed() { release(); returnFocus?.focus(); }
  const close = () => dialog.close(), pick = () => { input.value = ''; input.click(); };
  async function compose(nextImage, current) {
    // Encode on a separate canvas; a failed or cancelled render cannot replace
    // the visible preview or a previously prepared downloadable photograph.
    const prepared = document.createElement('canvas');
    const blob = await renderBrandedPhoto(nextImage, prepared, position.value);
    if (current !== generation || !dialog.open) return false;
    const nextFile = new File([blob], 'Ger-Jyh-Light-up-Christmas.jpg', { type: 'image/jpeg' });
    canvas.width = prepared.width; canvas.height = prepared.height;
    canvas.getContext('2d').drawImage(prepared, 0, 0);
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = URL.createObjectURL(blob); file = nextFile; download.href = outputURL; download.download = file.name;
    canvas.hidden = false; $('[data-photo-placeholder]').hidden = true; $('[data-photo-controls]').hidden = false; choose.textContent = '換一張合照';
    try { share.hidden = !navigator.canShare?.({ files: [file] }); } catch { share.hidden = true; }
    note.textContent = '活動字樣已加入照片，可以下載後分享至臉書或其他社群。';
    return true;
  }
  async function changed() {
    if (!dialog.open) return;
    const selected = input.files?.[0]; if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { note.textContent = '請選擇 JPG、PNG 或 WebP 照片或截圖。'; return; }
    if (selected.size > 25 * 1024 * 1024) { note.textContent = '照片超過 25 MB，請先縮小，或選擇 AR 截圖。'; return; }
    const current = ++generation, nextURL = URL.createObjectURL(selected), nextImage = new Image(); let adopted = false;
    decoding = nextImage; busy(true); note.textContent = '正在把活動字樣加入合照…';
    try {
      nextImage.src = nextURL; await nextImage.decode();
      if (current !== generation || !dialog.open) return;
      if (!await compose(nextImage, current)) return;
      if (sourceURL) URL.revokeObjectURL(sourceURL);
      sourceURL = nextURL; image = nextImage; adopted = true;
    } catch (error) { if (current === generation && dialog.open) note.textContent = error.message?.includes('合照') ? error.message : '照片無法讀取，請改用 JPG、PNG 或 WebP 再試一次。'; }
    finally { if (!adopted) URL.revokeObjectURL(nextURL); if (decoding === nextImage) decoding = undefined; if (current === generation) busy(false); }
  }
  async function reposition() {
    if (!image) return; const current = ++generation; busy(true);
    try { await compose(image, current); } catch (error) { if (current === generation) note.textContent = error.message || '字樣位置未能更新，請再試一次。'; }
    finally { if (current === generation) busy(false); }
  }
  async function shared() {
    if (!file) return;
    try { await navigator.share({ title: 'Light up Christmas · Ger-Jyh', files: [file] }); }
    catch (error) { if (error.name !== 'AbortError') note.textContent = '這次未能開啟分享，請先下載照片，再貼到社群。'; }
  }
  openButton.addEventListener('click', show); $('[data-photo-close]').addEventListener('click', close);
  choose.addEventListener('click', pick); input.addEventListener('change', changed); position.addEventListener('change', reposition); share.addEventListener('click', shared); dialog.addEventListener('close', closed);
  return { dispose() { release(); if (dialog.open) dialog.close(); openButton.removeEventListener('click', show); $('[data-photo-close]').removeEventListener('click', close); choose.removeEventListener('click', pick); input.removeEventListener('change', changed); position.removeEventListener('change', reposition); share.removeEventListener('click', shared); dialog.removeEventListener('close', closed); } };
}
