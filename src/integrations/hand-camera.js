import { createHandGestures, readPalm } from './hand-gestures.js';

const messages = {
  searching: '伸出一隻手，輕輕左右移動', lowered: '再舉起手，就能重新點亮',
  moving: '手掌移動中 · 聖誕樹跟著旋轉', ready: '張開手掌，停留一秒',
  holding: '掌心停留，星光正在甦醒', latched: '祝福已送出 · 放下手後可再點亮',
};
const defaultDetector = async () => (await import('./hand-detector.js')).createHandDetector();

export function createHandCamera({ button, note, preview, select, onInput, onLight,
  canInteract = () => true, createDetector = defaultDetector }) {
  const gestures = createHandGestures();
  const ring = button.querySelector('[data-hand-progress]');
  let generation = 0, active = false, stream, detector, frame, pending, disposed = false;
  let lastFrame = -Infinity, lastVideoTime = -1, interval = 100, slowFrames = 0;
  function show(text, progress = 0, state = '') {
    if (note.textContent !== text) note.textContent = text;
    if (ring) ring.style.strokeDashoffset = String(100 - progress * 100);
    button.dataset.handState = state;
  }
  function releaseDetector(instance) {
    // The graph must not be destroyed while send() is still running.
    Promise.resolve(pending).catch(() => {}).then(() => instance?.close()).catch(() => {});
  }
  function stop(message = '') {
    generation++; active = false; cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream = null; preview.pause(); preview.srcObject = null; preview.hidden = true;
    releaseDetector(detector); detector = null;
    gestures.reset(); onInput({ present: false, turn: 0, progress: 0 });
    button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-busy', 'false');
    button.setAttribute('aria-label', '開啟攝影機手勢互動'); button.title = '開啟攝影機手勢互動';
    show(message); note.hidden = !message;
  }
  async function devices(token) {
    if (!navigator.mediaDevices.enumerateDevices || !select) return;
    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    if (token !== generation) return;
    const current = stream?.getVideoTracks()[0]?.getSettings().deviceId;
    select.replaceChildren(...cameras.map((camera, i) => {
      const option = document.createElement('option'); option.value = camera.deviceId;
      option.textContent = camera.label || `攝影機 ${i + 1}`; return option;
    }));
    if (current) select.value = current;
    select.disabled = cameras.length < 2;
  }
  async function start() {
    if (disposed) return;
    const token = ++generation;
    active = true; note.hidden = false;
    button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', '關閉攝影機手勢互動'); button.title = '關閉攝影機手勢互動';
    show('請允許攝影機，準備掌心的星光…');
    try {
      const deviceId = select?.value;
      const incoming = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20, max: 30 },
      } });
      if (token !== generation) { incoming.getTracks().forEach(track => track.stop()); return; }
      stream = incoming;
      stream.getTracks().forEach(track => { track.onended = () => stop('攝影機已中斷，請重新開啟。'); });
      preview.srcObject = stream; await preview.play();
      if (token !== generation) return;
      preview.hidden = false;
      show('正在準備手勢辨識，首次載入請稍候…');
      const incomingDetector = await createDetector();
      if (token !== generation) { releaseDetector(incomingDetector); return; }
      detector = incomingDetector;
      button.setAttribute('aria-busy', 'false');
      devices(token).catch(() => {});
      gestures.reset(); lastFrame = -Infinity; lastVideoTime = -1; interval = 100; slowFrames = 0;
      show(messages.searching, 0, 'searching');
      async function update(now) {
        if (token !== generation) return;
        frame = requestAnimationFrame(update);
        if (pending || preview.readyState < 2 || now - lastFrame < interval || preview.currentTime === lastVideoTime) return;
        lastFrame = now; lastVideoTime = preview.currentTime;
        const started = performance.now();
        const instance = detector;
        const task = Promise.resolve().then(() => instance.detect(preview));
        pending = task;
        try {
          const landmarks = await task;
          if (token !== generation) return;
          const palm = readPalm(landmarks, preview.videoWidth / Math.max(1, preview.videoHeight));
          let input;
          if (canInteract()) input = gestures.update(palm, performance.now() / 1000);
          else { gestures.suspend(); input = { present: !!palm && palm.y <= .86, turn: 0, progress: 0, state: 'paused' }; }
          onInput(input);
          if (input.trigger) onLight();
          show(input.state === 'paused' ? '稍候，舞台準備好就能互動' : messages[input.state], input.progress, input.state);
          // Slow devices lower inference frequency; the scene keeps its own RAF.
          slowFrames = performance.now() - started > 65 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
          if (slowFrames >= 5) interval = 200;
        } catch (error) {
          if (token === generation) stop('手勢辨識暫時中斷，請關閉其他攝影機程式後重試。');
        } finally { if (pending === task) pending = null; }
      }
      frame = requestAnimationFrame(update);
    } catch (error) {
      if (token !== generation) return;
      stop(error.name === 'NotAllowedError' ? '尚未允許攝影機，請在瀏覽器設定開啟後重試。'
        : error.name === 'NotFoundError' ? '找不到攝影機，請先接上攝影機再試一次。'
        : '無法開啟手勢互動，請確認攝影機與網路後重試。');
    }
  }
  const toggle = () => active ? stop() : start();
  const changeDevice = () => { if (active) { stop(); start(); } };
  const hide = () => { if (document.hidden) stop(); };
  const leave = () => stop();
  if (!navigator.mediaDevices?.getUserMedia) {
    button.disabled = true; button.title = '請使用 HTTPS 網址與支援攝影機的瀏覽器';
    return { stop() {}, dispose() {} };
  }
  button.addEventListener('click', toggle);
  select?.addEventListener('change', changeDevice);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', leave);
  return { stop, dispose() { disposed = true; stop(); button.removeEventListener('click', toggle);
    select?.removeEventListener('change', changeDevice); document.removeEventListener('visibilitychange', hide);
    window.removeEventListener('pagehide', leave); } };
}
