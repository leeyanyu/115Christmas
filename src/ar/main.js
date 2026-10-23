import './style.css';
import { findARTree } from './catalog.js';
import { arShareURL } from './launch.js';
import { createARPreview } from './preview.js';
import { createCameraPhoto } from './camera-photo.js';

const query = new URLSearchParams(location.search);
const tree = findARTree(query.get('tree') ?? undefined);
const launch = document.querySelector('#ar-launch'), support = document.querySelector('#ar-support');
const previewStatus = document.querySelector('#preview-status'), photoDialog = document.querySelector('#photo-studio');
let preview, controller, cameraPhoto;

if (!tree) {
  document.querySelector('#work-title').textContent = '找不到這棵聖誕樹';
  document.querySelector('#work-author').textContent = '';
  previewStatus.textContent = '作品連結可能有誤';
  support.textContent = '請確認作品連結，或先看看格致聖誕樹。';
  document.querySelector('#default-tree').hidden = false;
  document.querySelector('#share-tree').hidden = true;
} else {
  document.title = `${tree.title} · 實景合照 · GJ Christmas`;
  document.querySelector('#work-title').textContent = tree.title;
  document.querySelector('#work-author').textContent = [tree.className, tree.author].filter(Boolean).join(' · ');
  document.querySelector('#work-blessing').textContent = tree.blessing;
  launch.hidden = false;
  document.querySelector('#ar-steps').hidden = false;
  support.textContent = '手動調整樹在鏡頭畫面中的位置與大小；移動手機取景後，請重新對齊。照片只在裝置內合成。';
  const modelURL = new URL(tree.glb, new URL(import.meta.env.BASE_URL, location.href)).href;
  cameraPhoto = createCameraPhoto({ button: launch, dialog: photoDialog, modelURL, title: tree.title,
    onOpen() { controller?.abort(); preview?.dispose(); preview = undefined; },
    onClose() { loadPreview(); } });

  const shareURL = arShareURL(tree, location.href);
  const share = document.querySelector('#share-tree');
  share.addEventListener('click', async () => {
    const note = document.querySelector('#share-note');
    try {
      if (navigator.share) await navigator.share({ title: `${tree.title} · 聖誕合照`, url: shareURL });
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
      preview = await createARPreview(document.querySelector('#ar-preview'), modelURL, { signal: controller.signal });
      previewStatus.hidden = true; document.querySelector('#preview-hint').hidden = false;
    } catch (error) {
      if (error.name !== 'AbortError') previewStatus.textContent = '預覽暫時無法顯示，請確認網路後重新整理。';
    }
  }
  loadPreview();
  window.addEventListener('pagehide', () => { controller?.abort(); preview?.dispose(); });
  window.addEventListener('pageshow', event => { if (event.persisted && !photoDialog.open) loadPreview(); });
}
if (import.meta.hot) import.meta.hot.dispose(() => { cameraPhoto?.dispose(); controller?.abort(); preview?.dispose(); });
