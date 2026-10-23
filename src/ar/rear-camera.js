export async function openRearCamera(video, { signal, mediaDevices = navigator.mediaDevices, timeoutMs = 15000 } = {}) {
  const cancelled = () => new DOMException('Cancelled', 'AbortError');
  if (signal?.aborted) throw cancelled();
  if (!mediaDevices?.getUserMedia) throw new Error('請使用 HTTPS 網址，並以 Chrome 或 Safari 開啟鏡頭合照。');
  const stream = await mediaDevices.getUserMedia({ audio: false, video: {
    facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24, max: 30 },
  } });
  let stopped = false;
  function stop() {
    if (stopped) return; stopped = true;
    signal?.removeEventListener('abort', abort);
    stream.getTracks().forEach(track => { track.onended = null; track.stop(); });
    if (video.srcObject === stream) { video.pause(); video.srcObject = null; }
  }
  let rejectAbort;
  function abort() { stop(); rejectAbort?.(cancelled()); }
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) { stop(); throw cancelled(); }
  video.srcObject = stream;
  let timer, loaded;
  const ready = new Promise((resolve, reject) => {
    rejectAbort = reject;
    loaded = () => { if (video.readyState >= 2 && video.videoWidth && video.videoHeight) resolve(); };
    video.addEventListener('loadeddata', loaded); video.addEventListener('resize', loaded);
    timer = setTimeout(() => reject(new Error('鏡頭尚未提供畫面，請關閉其他使用相機的程式後重試。')), timeoutMs);
    Promise.resolve().then(() => video.play()).then(loaded, reject);
  });
  try { await ready; return { stream, stop }; }
  catch (error) { stop(); throw error; }
  finally { clearTimeout(timer); video.removeEventListener('loadeddata', loaded); video.removeEventListener('resize', loaded); }
}
