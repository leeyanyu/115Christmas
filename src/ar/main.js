import './style.css';
import { findARTree } from './catalog.js';
import { arPlatform, arLaunchURL, arShareURL, androidViewerURL, androidReferenceURL } from './launch.js';
import { createARLaunchFeedback } from './launch-feedback.js';
import { createARPreview } from './preview.js';
import { createWebXRTree } from './webxr-tree.js';

const query = new URLSearchParams(location.search);
const tree = findARTree(query.get('tree') ?? undefined);
const launch = document.querySelector('#ar-launch'), support = document.querySelector('#ar-support');
const previewStatus = document.querySelector('#preview-status');
let preview, controller, launchFeedback, webXR, prepareTimer, checkingXR = false;

if (!tree) {
  document.querySelector('#work-title').textContent = '找不到這棵聖誕樹';
  document.querySelector('#work-author').textContent = '';
  previewStatus.textContent = '作品連結可能有誤';
  support.textContent = '請確認作品連結，或先看看格致聖誕樹。';
  document.querySelector('#default-tree').hidden = false;
  document.querySelector('#share-tree').hidden = true;
} else {
  document.title = `${tree.title} · AR 合照 · GJ Christmas`;
  document.querySelector('#work-title').textContent = tree.title;
  document.querySelector('#work-author').textContent = [tree.className, tree.author].filter(Boolean).join(' · ');
  document.querySelector('#work-blessing').textContent = tree.blessing;
  let quickLook = false;
  try { quickLook = launch.relList.supports('ar'); } catch { /* Not available in every browser. */ }
  const platform = arPlatform(navigator, quickLook);
  const href = arLaunchURL(tree, platform, location.href, import.meta.env.BASE_URL);
  if (href) {
    launch.href = href; launch.hidden = false;
    if (platform === 'quick-look') { launch.rel = 'ar'; launch.type = 'model/vnd.usdz+zip'; }
    document.querySelector('#ar-steps').hidden = false;
    support.textContent = '開啟後將由手機的 AR 畫面帶你放置聖誕樹。';
  } else {
    support.textContent = platform === 'ios-browser' ? '請用 iPhone／iPad 的 Safari 開啟此頁，再進入 AR 合照。'
      : '請用支援 AR 的 iPhone 或 Android 手機開啟此頁，將聖誕樹放到身邊。';
  }
  if (query.has('ar-fallback')) support.textContent = '此手機尚未啟動 AR。請用支援 ARCore 的 Android 手機與 Chrome，並確認已安裝及更新「Google Play Services for AR」。仍可在這裡欣賞作品。';

  if (platform === 'scene-viewer') {
    const help = document.querySelector('#android-ar-help');
    const alternate = document.querySelector('#ar-browser-launch');
    const native = document.querySelector('#ar-native-launch');
    const reference = document.querySelector('#ar-reference-launch');
    const capability = document.querySelector('#xr-capability');
    alternate.href = androidViewerURL(tree, location.href, import.meta.env.BASE_URL).href;
    native.href = href; reference.href = androidReferenceURL(tree, location.href, import.meta.env.BASE_URL);
    support.textContent = '開啟系統檢視器後，若先看到 3D 預覽，請選擇「在你的空間中查看」或 AR 按鈕。';
    if (query.has('ar-fallback')) {
      support.textContent = '系統檢視器未能開啟。請試試下方連結，並確認 Google 與 AR 服務已啟用及更新。';
      help.hidden = false; help.open = true;
    }
    launch.addEventListener('click', event => {
      if (checkingXR) { event.preventDefault(); support.textContent = '正在準備 3D 空間 AR，請稍候再輕點一次。'; }
      else if (webXR?.ready) { event.preventDefault(); webXR.start(); }
    });
    launchFeedback = createARLaunchFeedback({ links: [launch, alternate, native, reference], note: support, help,
      canAttempt: event => event.currentTarget !== launch || (!checkingXR && !webXR?.ready) });
    function prepareXR() {
      checkingXR = true; launch.setAttribute('aria-busy', 'true');
      capability.textContent = '正在檢查瀏覽器的 3D 空間 AR…';
      const instance = createWebXRTree({ overlay: document.querySelector('#xr-overlay'), canvas: document.querySelector('#xr-canvas'),
        url: new URL(tree.glb, new URL(import.meta.env.BASE_URL, location.href)).href,
        onStatus: message => { support.textContent = message; },
        onEnd: () => { support.textContent = '已離開 3D 空間 AR，可再次放置聖誕樹。'; },
        onError: error => {
          help.hidden = false; help.open = true;
          support.textContent = error.name === 'NotAllowedError' || error.name === 'SecurityError'
            ? '尚未允許瀏覽器的相機與空間追蹤，請確認 Chrome 網站權限後重試。'
            : '瀏覽器的 3D 空間 AR 未能啟動。可試下方的系統 AR 或 Google 示範模型，協助確認手機的 AR 服務。';
        } });
      webXR = instance;
      clearTimeout(prepareTimer);
      prepareTimer = setTimeout(() => { if (webXR === instance && checkingXR) {
        checkingXR = false; launch.setAttribute('aria-busy', 'false');
        capability.textContent = '瀏覽器 AR 仍在準備，可先測試系統 AR。';
      } }, 5000);
      instance.prepare().then(available => {
        if (webXR !== instance) return;
        clearTimeout(prepareTimer); checkingXR = false; launch.setAttribute('aria-busy', 'false');
        capability.textContent = available ? '此瀏覽器提供 3D 空間 AR，會優先在 Chrome 內啟動。'
          : '此瀏覽器目前未提供直接空間 AR，主按鈕會嘗試系統 AR。';
        if (available) support.textContent = '在 Chrome 內尋找地面、輕點放置；樹會留在空間裡，可移動手機取景並截圖合照。';
      }).catch(error => {
        if (webXR !== instance || error.name === 'AbortError') return;
        clearTimeout(prepareTimer); checkingXR = false; launch.setAttribute('aria-busy', 'false');
        capability.textContent = '瀏覽器 AR 尚未準備好，可使用系統 AR 或示範模型測試。';
      });
    }
    prepareXR();
    window.addEventListener('pagehide', () => { clearTimeout(prepareTimer); const old = webXR; webXR = undefined; old?.dispose(); });
    window.addEventListener('pageshow', event => { if (event.persisted) prepareXR(); });
  }

  const shareURL = arShareURL(tree, location.href);
  const share = document.querySelector('#share-tree');
  share.addEventListener('click', async () => {
    const note = document.querySelector('#share-note');
    try {
      if (navigator.share) await navigator.share({ title: `${tree.title} · AR 合照`, url: shareURL });
      else { await navigator.clipboard.writeText(shareURL); note.textContent = '連結已複製，可傳到手機開啟。'; }
    } catch (error) {
      if (error.name === 'AbortError') return;
      const input = document.querySelector('#share-link');
      input.value = shareURL; input.hidden = false;
      document.querySelector('#share-link-label').hidden = false;
      input.focus(); input.select(); note.textContent = '可手動複製下方的作品連結。';
    }
  });
  async function loadPreview() {
    controller?.abort(); controller = new AbortController();
    previewStatus.hidden = false; previewStatus.textContent = '正在準備聖誕樹…';
    try {
      preview = await createARPreview(document.querySelector('#ar-preview'),
        new URL(tree.glb, new URL(import.meta.env.BASE_URL, location.href)).href, { signal: controller.signal });
      previewStatus.hidden = true; document.querySelector('#preview-hint').hidden = false;
    } catch (error) {
      if (error.name !== 'AbortError') previewStatus.textContent = '預覽暫時無法顯示，可重新整理重試；支援的手機仍可按下方按鈕進入 AR。';
    }
  }
  loadPreview();
  window.addEventListener('pagehide', () => { controller?.abort(); preview?.dispose(); });
  window.addEventListener('pageshow', event => { if (event.persisted) loadPreview(); });
}
if (import.meta.hot) import.meta.hot.dispose(() => { clearTimeout(prepareTimer); webXR?.dispose(); controller?.abort(); preview?.dispose(); launchFeedback?.dispose(); });
