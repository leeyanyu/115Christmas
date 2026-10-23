import './style.css';
import { findARTree } from './catalog.js';
import { arPlatform, arLaunchURL, arShareURL } from './launch.js';
import { createARPreview } from './preview.js';

const query = new URLSearchParams(location.search);
const tree = findARTree(query.get('tree') ?? undefined);
const launch = document.querySelector('#ar-launch'), support = document.querySelector('#ar-support');
const previewStatus = document.querySelector('#preview-status');
let preview, controller;

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
if (import.meta.hot) import.meta.hot.dispose(() => { controller?.abort(); preview?.dispose(); });
