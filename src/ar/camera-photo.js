import { openRearCamera } from './rear-camera.js';
import { createPhotoTree } from './photo-tree.js';
import { createPhotoPlacement } from './photo-layout.js';
import { capturePhoto } from './photo-capture.js';

export function createCameraPhoto({ button, dialog, modelURL, title, onOpen = () => {}, onClose = () => {} }) {
  const get = id => dialog.querySelector(`#${id}`);
  const frame = get('photo-frame'), video = get('photo-video'), canvas = get('photo-tree'), image = get('photo-result');
  const status = get('photo-status'), shoot = get('photo-shoot'), retry = get('photo-retry');
  const live = get('photo-live-actions'), review = get('photo-review-actions'), scale = get('photo-scale');
  const save = get('photo-save'), share = get('photo-share'), hint = get('photo-hint');
  const placement = createPhotoPlacement();
  let generation = 0, controller, camera, tree, photoURL, photoFile, mode = 'closed', disposed = false, previousFocus;
  let resizeFrame, capturing = false;
  function clearPhoto() {
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = undefined; photoFile = undefined; image.removeAttribute('src'); save.removeAttribute('href');
  }
  function release() {
    generation++; controller?.abort(); controller = undefined;
    camera?.stop(); camera = undefined; tree?.dispose(); tree = undefined;
    placement.cancel();
  }
  function ui(next) {
    mode = next;
    const isLive = next === 'live';
    live.hidden = !isLive; review.hidden = next !== 'review';
    retry.hidden = next !== 'error' && next !== 'paused';
    video.hidden = next === 'review'; canvas.hidden = !isLive;
    image.hidden = next !== 'review'; hint.hidden = !isLive;
    shoot.disabled = !isLive || capturing;
    dialog.dataset.photoState = next;
  }
  function errorMessage(error) {
    if (error.name === 'NotAllowedError') return '尚未允許鏡頭。請在瀏覽器的網站權限開啟相機，再按重新開啟。';
    if (error.name === 'NotFoundError') return '找不到攝影機，請確認手機或電腦已連接鏡頭。';
    if (error.name === 'NotReadableError') return '鏡頭正被其他程式使用，請關閉其他相機程式後重試。';
    return error.message || '暫時無法開啟合照，請重試。';
  }
  function resize() {
    if (mode !== 'live' || !tree) return;
    const rect = frame.getBoundingClientRect();
    tree.resize(rect.width, rect.height);
    tree.setPlacement(placement.resize(rect.width, rect.height, tree.ratio));
    scale.value = String(Math.round(placement.value.height * 100));
  }
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize);
  });
  observer.observe(frame);
  function apply(value) { if (mode === 'live' && tree) { tree.setPlacement(value); scale.value = String(Math.round(value.height * 100)); } }
  async function start() {
    release(); clearPhoto(); capturing = false;
    const token = generation; controller = new AbortController();
    const signal = controller.signal;
    ui('loading'); status.textContent = '正在開啟後鏡頭並準備聖誕樹…';
    const getCamera = openRearCamera(video, { signal }).then(incoming => {
      if (token !== generation) { incoming.stop(); throw new DOMException('Cancelled', 'AbortError'); }
      camera = incoming;
      camera.stream.getVideoTracks().forEach(track => { track.onended = () => {
        if (mode === 'live') { release(); ui('paused'); status.textContent = '鏡頭已中斷，可按重新開啟繼續合照。'; }
      }; });
    });
    const getTree = createPhotoTree(canvas, modelURL, { signal }).then(incoming => {
      if (token !== generation) { incoming.dispose(); throw new DOMException('Cancelled', 'AbortError'); }
      tree = incoming;
    });
    try {
      await Promise.all([getCamera, getTree]);
      if (token !== generation) return;
      ui('live'); resize(); status.textContent = '拖曳放置、雙指縮放，準備好就按拍照。';
    } catch (error) {
      if (token !== generation || error.name === 'AbortError') return;
      release(); ui('error'); status.textContent = errorMessage(error);
    }
  }
  function open() {
    if (disposed || dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal(); onOpen(); start();
  }
  function close() { if (dialog.open) dialog.close(); }
  function closed() {
    release(); clearPhoto(); ui('closed'); onClose();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function down(event) {
    if (mode !== 'live' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    canvas.setPointerCapture(event.pointerId);
    const rect = frame.getBoundingClientRect();
    placement.begin(event.pointerId, event.clientX - rect.left, event.clientY - rect.top);
  }
  function move(event) {
    if (mode !== 'live') return;
    const rect = frame.getBoundingClientRect();
    apply(placement.move(event.pointerId, event.clientX - rect.left, event.clientY - rect.top));
  }
  function up(event) { placement.end(event.pointerId); }
  function wheel(event) {
    if (mode !== 'live') return;
    event.preventDefault(); apply(placement.scale(Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * .002)));
  }
  const scaleChanged = () => apply(placement.setHeight(+scale.value / 100));
  const smaller = () => apply(placement.scale(.9)), larger = () => apply(placement.scale(1.1));
  async function snap() {
    if (mode !== 'live' || capturing || !tree) return;
    capturing = true; shoot.disabled = true; status.textContent = '正在製作合照…';
    const token = generation;
    try {
      const blob = await capturePhoto(video, tree, frame.getBoundingClientRect());
      if (token !== generation || !dialog.open) return;
      const filename = `GJ-Christmas-${Date.now()}.jpg`;
      photoFile = new File([blob], filename, { type: 'image/jpeg' });
      photoURL = URL.createObjectURL(blob); image.src = photoURL;
      save.href = photoURL; save.download = filename;
      share.hidden = !navigator.canShare?.({ files: [photoFile] });
      release(); ui('review'); status.textContent = '合照完成，可儲存或分享；照片只在你的裝置內產生。';
    } catch (error) {
      if (token === generation) status.textContent = errorMessage(error);
    } finally { capturing = false; shoot.disabled = mode !== 'live'; }
  }
  async function sharePhoto() {
    if (!photoFile) return;
    try { await navigator.share({ files: [photoFile], title: `${title} · 聖誕合照` }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = '分享暫時無法開啟，可改按儲存照片。'; }
  }
  function hide() {
    if (!document.hidden || !dialog.open || mode === 'review') return;
    release(); ui('paused'); status.textContent = '鏡頭已暫停，回到頁面後可按重新開啟。';
  }
  function pageHide() { if (dialog.open && mode !== 'review') { release(); ui('paused'); status.textContent = '鏡頭已暫停，可按重新開啟。'; } }
  button.addEventListener('click', open); get('photo-close').addEventListener('click', close);
  dialog.addEventListener('close', closed);
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('wheel', wheel, { passive: false });
  scale.addEventListener('input', scaleChanged);
  get('photo-smaller').addEventListener('click', smaller); get('photo-larger').addEventListener('click', larger);
  shoot.addEventListener('click', snap); retry.addEventListener('click', start); get('photo-retake').addEventListener('click', start);
  share.addEventListener('click', sharePhoto);
  document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', pageHide);
  return { dispose() {
    disposed = true; release(); clearPhoto(); cancelAnimationFrame(resizeFrame); observer.disconnect();
    button.removeEventListener('click', open); get('photo-close').removeEventListener('click', close);
    dialog.removeEventListener('close', closed); if (dialog.open) dialog.close();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('wheel', wheel);
    scale.removeEventListener('input', scaleChanged);
    get('photo-smaller').removeEventListener('click', smaller); get('photo-larger').removeEventListener('click', larger);
    shoot.removeEventListener('click', snap); retry.removeEventListener('click', start); get('photo-retake').removeEventListener('click', start);
    share.removeEventListener('click', sharePhoto);
    document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', pageHide);
  } };
}
