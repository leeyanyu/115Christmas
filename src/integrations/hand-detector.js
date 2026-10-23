const assetBase = new URL(`${import.meta.env?.BASE_URL ?? '/'}hand-tracking/1.1.1/`,
  globalThis.location?.href ?? 'http://localhost/').href;

function defaultWorker() {
  if (!globalThis.Worker || !globalThis.OffscreenCanvas || !globalThis.createImageBitmap || !globalThis.DecompressionStream) {
    throw new Error('請更新 Chrome 或 Safari，才能使用流暢的背景手勢辨識。');
  }
  return new Worker(new URL('./hand-tracking-worker.js', import.meta.url), { type: 'module' });
}

// The rendering thread never runs model inference. Only a small, fresh bitmap
// crosses the worker boundary, with at most one transferred frame in flight.
export async function createHandDetector({ signal, onProgress = () => {}, workerFactory = defaultWorker,
  bitmapFactory = (video, options) => createImageBitmap(video, options), timeoutMs = 60000 } = {}) {
  const worker = workerFactory();
  let closed = false, requestId = 0, pending = null, bitmapBusy = false;
  function close(reason = new Error('手勢辨識已關閉。')) {
    if (closed) return;
    closed = true; worker.terminate(); signal?.removeEventListener('abort', abort);
    if (pending) { clearTimeout(pending.timer); pending.reject(reason); pending = null; }
  }
  const abort = () => close(new DOMException('Cancelled', 'AbortError'));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) { abort(); throw new DOMException('Cancelled', 'AbortError'); }
  const timedOut = () => close(new Error('手勢載入或辨識逾時，請檢查網路後重試。'));
  worker.onmessage = ({ data }) => {
    if (closed) return;
    if (data.type === 'progress') {
      // A slow connection that is still making progress is not a frozen load.
      if (pending?.type === 'init') {
        clearTimeout(pending.timer); pending.timer = setTimeout(timedOut, timeoutMs);
      }
      onProgress(data); return;
    }
    if (!pending || data.id !== pending.id) return;
    const current = pending; pending = null; clearTimeout(current.timer);
    if (data.type === 'error') current.reject(new Error(data.message));
    else current.resolve(data.landmarks ?? null);
  };
  worker.onerror = () => close(new Error('背景手勢辨識中斷，請重新開啟攝影機。'));
  function request(message, transfer = [], timeout = timeoutMs) {
    if (closed) return Promise.reject(new Error('手勢辨識已關閉。'));
    if (pending) return Promise.reject(new Error('手勢影格仍在處理中。'));
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(timedOut, timeout);
      pending = { id, type: message.type, resolve, reject, timer };
      try { worker.postMessage({ ...message, id }, transfer); }
      catch (error) { close(error); }
    });
  }
  try { await request({ type: 'init', assetBase }); }
  catch (error) { close(); throw error; }
  return {
    async detect(video) {
      if (closed) throw new Error('手勢辨識已關閉。');
      if (bitmapBusy || pending) throw new Error('手勢影格仍在處理中。');
      bitmapBusy = true;
      let bitmap;
      try {
        const width = Math.min(320, video.videoWidth);
        bitmap = await bitmapFactory(video, { resizeWidth: width,
          resizeHeight: Math.max(1, Math.round(width * video.videoHeight / video.videoWidth)), resizeQuality: 'low' });
        if (closed) { bitmap.close(); bitmap = null; throw new Error('手勢辨識已關閉。'); }
        return await request({ type: 'frame', bitmap, time: performance.now() }, [bitmap], 10000);
      } finally { bitmap?.close(); bitmapBusy = false; }
    },
    close,
  };
}
