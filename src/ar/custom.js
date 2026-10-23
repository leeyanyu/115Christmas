import { designFromURL, designARURL } from '../diy/design-link.js';
import { arPlatform } from './launch.js';
import { createCustomARAssets } from './custom-assets.js';
import { createARPreview } from './preview.js';
import { createWebXRTree } from './webxr-tree.js';

export function mountCustomAR() {
  const $ = id => document.querySelector(`#${id}`), design = designFromURL(location.href);
  const launch = $('ar-launch'), support = $('ar-support'), previewStatus = $('preview-status');
  if (!design) {
    $('work-title').textContent = '找不到這份作品'; $('work-author').textContent = '';
    previewStatus.textContent = '作品連結可能不完整'; support.textContent = '請回到 DIY 聖誕樹，重新開啟 AR 合照連結。';
    $('share-tree').hidden = true; $('default-tree').hidden = false; return;
  }
  document.title = `${design.title} · AR 合照 · GJ Christmas`;
  $('work-title').textContent = design.title; $('work-author').textContent = design.engraving || '你的作品'; $('work-blessing').textContent = design.blessing;
  let quickLook = false; try { quickLook = launch.relList.supports('ar'); } catch { /* Browser does not advertise Quick Look. */ }
  const platform = arPlatform(navigator, quickLook), shareURL = designARURL(design, location.href);
  let assets, preview, webXR, controller, generation = 0, ready = false, nativeOpen = false;
  launch.addEventListener('click', event => {
    if (!ready) { event.preventDefault(); support.textContent = '作品正在準備，完成後請再輕點一次。'; return; }
    if (platform === 'quick-look') nativeOpen = true;
    if (platform === 'scene-viewer') { event.preventDefault(); if (webXR?.ready) webXR.start(); }
  });
  $('share-tree').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${design.title} · AR 合照`, url: shareURL });
      else { await navigator.clipboard.writeText(shareURL); $('share-note').textContent = '作品連結已複製，傳到手機就能開啟。'; }
    } catch (error) {
      if (error.name === 'AbortError') return;
      $('share-link').value = shareURL; $('share-link').hidden = false; $('share-link-label').hidden = false; $('share-link').focus(); $('share-link').select();
      $('share-note').textContent = '複製這份作品連結，在手機開啟。';
    }
  });
  function stop(keepNative = false) {
    generation++; ready = false; controller?.abort(); preview?.dispose(); preview = undefined;
    webXR?.dispose(); webXR = undefined;
    // Quick Look can fetch its Blob after the page becomes hidden. Keep that
    // URL alive until the viewer returns; navigation itself releases the page.
    if (!keepNative) { assets?.dispose(); assets = undefined; }
  }
  async function boot() {
    stop(); nativeOpen = false; const current = generation; controller = new AbortController();
    launch.hidden = platform === 'desktop' || platform === 'ios-browser'; launch.href = '#'; launch.setAttribute('aria-busy', 'true');
    previewStatus.hidden = false; previewStatus.textContent = '正在準備你的聖誕樹…';
    support.textContent = '保留你的配色、裝飾與刻字，讓作品走進真實空間。';
    try {
      const next = await createCustomARAssets(design, { quickLook: platform === 'quick-look' });
      if (current !== generation) { next.dispose(); return; } assets = next;
      if (platform === 'quick-look') {
        launch.href = assets.usdzURL; launch.rel = 'ar'; launch.type = 'model/vnd.usdz+zip'; ready = true;
        support.textContent = '輕點下方按鈕，在 Safari 的 AR 畫面放置你的作品。'; $('ar-steps').hidden = false;
      } else if (platform === 'scene-viewer') {
        webXR = createWebXRTree({ overlay: $('xr-overlay'), canvas: $('xr-canvas'), url: assets.glbURL,
          onStatus: message => { support.textContent = message; }, onEnd: () => { support.textContent = '已離開 AR，可再次放置你的聖誕樹。'; },
          onError: error => { support.textContent = error.name === 'NotAllowedError' || error.name === 'SecurityError'
            ? '尚未允許相機與空間追蹤，請檢查 Chrome 網站權限後重試。' : '空間 AR 未能啟動，請確認手機的 AR 服務已更新後重試。'; } });
        const available = await webXR.prepare(); if (current !== generation) return;
        ready = available; launch.hidden = !available; launch.href = '#';
        $('ar-steps').hidden = !available;
        support.textContent = available ? '找到地面後輕點放置，可縮放、移動手機取景並截圖合照。'
          : '這台瀏覽器未提供空間 AR。請用支援 AR 的 Android Chrome 或 iPhone Safari 開啟這份作品連結。';
      } else support.textContent = platform === 'ios-browser' ? '請用 iPhone／iPad 的 Safari 開啟這份作品連結，再進入 AR。' : '把作品連結傳到手機，就能帶著自己的聖誕樹合照。';
      launch.setAttribute('aria-busy', 'false');
      try {
        preview = await createARPreview($('ar-preview'), assets.glbURL, { signal: controller.signal });
        if (current !== generation) { preview.dispose(); return; }
        previewStatus.hidden = true; $('preview-hint').hidden = false;
      } catch (error) { if (error.name !== 'AbortError' && current === generation) previewStatus.textContent = '預覽暫時無法顯示，仍可使用已準備好的 AR。'; }
    } catch (error) {
      if (current !== generation) return;
      launch.hidden = true; launch.setAttribute('aria-busy', 'false'); previewStatus.textContent = '作品暫時無法準備完成';
      support.textContent = '請重新整理這份作品連結再試一次。'; console.error('Custom AR preparation:', error);
    }
  }
  const hide = () => stop(nativeOpen);
  const show = event => { if (event.persisted || nativeOpen) boot(); };
  window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show);
  boot();
  return { dispose() { stop(); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); } };
}
