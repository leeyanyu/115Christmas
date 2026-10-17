// Attempt autoplay, then retry on the first gesture if the browser blocks it.
// Decode two synchronized stems once. The melody
// always continues; rotation fades in accompaniment without changing tempo.
// Gain nodes also work on iOS, where media-element volume is not adjustable.
export function createChristmasMusic({ button, note, urls, autoPlay = true,
  createContext = () => new (window.AudioContext || window.webkitAudioContext)(),
  fetchAudio = (...args) => fetch(...args), doc = document, win = window,
  schedule = setTimeout, unschedule = clearTimeout }) {
  let context, master, layers, preparing, pauseTimer;
  let enabled = autoPlay, listening = false, away = false, disposed = false, ready = false;
  let generation = 0, hold = 0, mood = 'melody';
  const abort = new AbortController();
  const visible = () => !doc.hidden && !away;
  function sync(message) {
    const loading = enabled && !ready;
    const paused = enabled && (listening || !visible());
    const waiting = enabled && ready && !paused && context?.state !== 'running';
    const label = enabled ? (loading ? '取消載入聖誕音樂' : '關閉聖誕音樂') : '開啟聖誕音樂';
    button.setAttribute('aria-label', label); button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(enabled)); button.setAttribute('aria-busy', String(loading));
    button.classList.toggle('music-paused', paused);
    button.dataset.musicMood = enabled && ready ? mood : 'off';
    button.dataset.musicPlayback = !enabled ? 'off' : paused ? 'paused' : loading ? 'loading' : waiting ? 'waiting' : 'playing';
    note.textContent = message || (paused ? '聖誕音樂暫停中，結束麥克風或回到頁面後繼續。'
      : loading ? '正在準備聖誕旋律，可點音符關閉。'
        : waiting ? '聖誕音樂已準備好，輕觸頁面即可播放；點音符可關閉。'
        : enabled ? '聖誕音樂已開啟，旋轉時加入鼓點與伴奏，停下後保留主旋律。' : '點音符，聽見聖誕旋律。');
  }
  function ramp(parameter, value, seconds) {
    const now = context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.linearRampToValueAtTime(value, now + seconds);
  }
  function mix() {
    if (!ready) return;
    ramp(layers[1].gain.gain, Number(mood === 'lively'), 1.2);
  }
  function setMood(next) {
    if (next === mood) return;
    mood = next; mix(); sync();
  }
  function pauseNow() {
    unschedule(pauseTimer);
    if (!context || context.state === 'closed') return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    context.suspend().catch(() => {});
  }
  function applyPlayback() {
    if (disposed) return;
    if (!enabled || listening || !visible()) pauseNow();
    else if (ready && context?.state === 'running') ramp(master.gain, .7, .6);
    sync();
  }
  function fail(token) {
    if (disposed || token !== generation) return;
    enabled = false; pauseNow(); sync('音樂暫時無法播放，請點音符重試。');
  }
  async function prepare() {
    if (ready) return;
    if (preparing) return preparing;
    preparing = (async () => {
      const buffers = await Promise.all(urls.map(async url => {
        const response = await fetchAudio(url, { signal: abort.signal });
        if (!response.ok) throw new Error('Unable to load Christmas music');
        return context.decodeAudioData(await response.arrayBuffer());
      }));
      if (disposed) return;
      layers = buffers.map((buffer, index) => {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; source.loop = true;
        gain.gain.value = index === 0 ? 1 : Number(mood === 'lively');
        source.connect(gain); gain.connect(master);
        return { source, gain };
      });
      const start = context.currentTime + .03;
      layers.forEach(layer => layer.source.start(start));
      ready = true;
    })();
    try { await preparing; } finally { preparing = undefined; }
  }
  async function activate(token, automatic = false) {
    try {
      unschedule(pauseTimer);
      if (!context) {
        context = createContext(); master = context.createGain();
        master.gain.value = 0; master.connect(context.destination);
        context.onstatechange = applyPlayback;
      }
      // A blocked Web Audio resume may stay pending indefinitely rather than
      // reject. Prepare independently, and let statechange finish the fade-in.
      if (!listening && visible()) context.resume().catch(error => {
        if (disposed || token !== generation) return;
        if (automatic || error.name === 'NotAllowedError') sync();
        else fail(token);
      });
      await prepare();
      if (disposed || token !== generation || !enabled) return;
      applyPlayback();
    } catch {
      fail(token);
    }
  }
  function toggle() {
    if (disposed) return;
    const token = ++generation;
    enabled = !enabled; sync();
    if (enabled) { void activate(token); return; }
    unschedule(pauseTimer);
    if (context?.state === 'running') {
      ramp(master.gain, 0, .18);
      pauseTimer = schedule(() => { if (!disposed && !enabled && token === generation) pauseNow(); }, 200);
    } else pauseNow();
  }
  function resumeIfEnabled() {
    const token = ++generation;
    if (enabled && !listening && visible()) void activate(token, true);
    else { pauseNow(); sync(); }
  }
  const visibility = () => { if (doc.hidden) { ++generation; pauseNow(); sync(); } else resumeIfEnabled(); };
  const leave = () => { away = true; ++generation; pauseNow(); sync(); };
  const returnToPage = () => { away = false; resumeIfEnabled(); };
  function firstGesture(event) {
    if (disposed || !enabled || listening || !visible() || context?.state === 'running') return;
    // A tap on the music button must switch it off, never unlock it first.
    if (event.target === button || button.contains?.(event.target)) return;
    void activate(++generation);
  }
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
  button.addEventListener('click', toggle);
  gestures.forEach(type => doc.addEventListener(type, firstGesture, { capture: true, passive: true }));
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pagehide', leave); win.addEventListener('pageshow', returnToPage);
  sync();
  if (autoPlay) void activate(++generation, true);
  return {
    update(delta, turning) {
      if (disposed) return;
      hold = turning ? .75 : Math.max(0, hold - delta);
      setMood(hold > 0 ? 'lively' : 'melody');
    },
    resetMotion() { hold = 0; setMood('melody'); },
    setListening(value) {
      if (disposed || listening === value) return;
      listening = value;
      if (listening) { ++generation; pauseNow(); sync(); }
      else resumeIfEnabled();
    },
    dispose() {
      if (disposed) return;
      disposed = true; ++generation; enabled = false;
      abort.abort(); unschedule(pauseTimer);
      button.removeEventListener('click', toggle); doc.removeEventListener('visibilitychange', visibility);
      gestures.forEach(type => doc.removeEventListener(type, firstGesture, true));
      win.removeEventListener('pagehide', leave); win.removeEventListener('pageshow', returnToPage);
      layers?.forEach(layer => { layer.source.stop(); layer.source.disconnect(); layer.gain.disconnect(); });
      master?.disconnect();
      if (context) { context.onstatechange = null; context.close().catch(() => {}); }
    },
  };
}
