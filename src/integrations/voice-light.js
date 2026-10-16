// Local RMS analysis only: no recorder, network request, or audio output.
export function createVoiceLight({ button, note, meter, onEnergy, onLevel = () => {} }) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let generation = 0, stream, context, source, analyser, frame, active = false;
  let elapsed = 0, noise = 0, samples = 0, level = 0, previous = 0;
  const idleText = '持續哼唱，讓感恩發光。聲音只在裝置內分析，不錄音、不上傳。';
  function stop(message = idleText) {
    generation++; active = false;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    source?.disconnect(); analyser?.disconnect();
    context?.close().catch(() => {});
    stream = context = source = analyser = null;
    button.textContent = '用歌聲點亮'; button.setAttribute('aria-pressed', 'false');
    note.textContent = message; meter.value = 0; onLevel(0);
  }
  async function start() {
    const token = ++generation;
    active = true; button.textContent = '取消開啟'; button.setAttribute('aria-pressed', 'true');
    note.textContent = '請允許使用麥克風；也可以隨時取消，繼續觸碰點亮。';
    try {
      context = new AudioContextClass();
      await context.resume();
      if (token !== generation) return;
      // Preserve sustained humming instead of treating it as background noise.
      const incoming = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false });
      if (token !== generation) { incoming.getTracks().forEach(track => track.stop()); return; }
      stream = incoming;
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser(); analyser.fftSize = 1024;
      source.connect(analyser); // Intentionally never connect to destination.
      stream.getTracks().forEach(track => { track.onended = () => stop('麥克風已中斷，仍可輕觸聖誕樹點亮祝福。'); });
      const data = new Float32Array(analyser.fftSize);
      elapsed = noise = samples = level = 0; previous = performance.now();
      button.textContent = '停止麥克風';
      note.textContent = '先安靜一秒，讓聖誕樹聽聽冬夜的聲音…';
      function update(now) {
        if (token !== generation) return;
        const dt = Math.max(0, Math.min((now - previous) / 1000, .1)); previous = now; elapsed += dt;
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        if (elapsed < 1) { noise += rms; samples++; }
        else {
          const threshold = Math.max(.012, Math.min(.06, noise / Math.max(1, samples) * 2.2));
          const target = Math.max(0, Math.min(1, (rms - threshold) / .08));
          level += (target - level) * (1 - Math.exp(-dt * 9));
          meter.value = level; onLevel(level);
          note.textContent = level > .08 ? '聽見你的祝福了，繼續唱，讓光抵達星星 ✧' : '輕輕唱歌或哼唱即可，持續的聲音會累積祝福。';
          if (level > .08 && !onEnergy(dt * Math.min(1, level * 3) / 12)) {
            stop('你的聲音點亮了冬夜！謝謝你的祝福 ✧'); return;
          }
        }
        if (elapsed >= 60) { stop('先休息一下吧。想再唱一段，隨時重新開啟。'); return; }
        frame = requestAnimationFrame(update);
      }
      frame = requestAnimationFrame(update);
    } catch (error) {
      if (token !== generation) return;
      stop(error.name === 'NotAllowedError'
        ? '尚未允許麥克風；可在瀏覽器設定開啟，或繼續輕觸點亮。'
        : '目前無法使用麥克風，請確認裝置與權限；仍可輕觸點亮。');
    }
  }
  const toggle = () => active ? stop() : start();
  const hide = () => { if (document.hidden) stop(); };
  const leave = () => stop();
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
    button.disabled = true; note.textContent = '此瀏覽器不支援麥克風互動，請輕觸聖誕樹點亮祝福。';
    return { stop() {}, dispose() {} };
  }
  button.addEventListener('click', toggle);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', leave);
  return { stop, dispose() { stop(); button.removeEventListener('click', toggle); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); } };
}
