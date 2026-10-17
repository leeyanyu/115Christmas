// Audition-only mixer. Sources share one audio clock and are reused for all
// instrument/volume changes. The Christmas tree imports none of this code.
export function createAuditionMixer({ tracks, onState = () => {},
  createContext = () => new (window.AudioContext || window.webkitAudioContext)(),
  fetchAudio = (...args) => fetch(...args) }) {
  let context, master, compressor, channels, preparing;
  let active = false, disposed = false, generation = 0, masterVolume = .8, levels = {};
  const abort = new AbortController();
  function applyLevels() {
    channels?.forEach(channel => channel.gain.gain.setTargetAtTime(Math.max(0, Math.min(1.2, levels[channel.id] || 0)), context.currentTime, .035));
  }
  async function prepare() {
    if (channels) return;
    if (preparing) return preparing;
    preparing = (async () => {
      let count = 0;
      const buffers = await Promise.all(tracks.map(async track => {
        const response = await fetchAudio(track.file, { signal: abort.signal });
        if (!response.ok) throw new Error('audio unavailable');
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (active && !disposed) onState('loading', `${++count} / ${tracks.length}`);
        return buffer;
      }));
      if (disposed) return;
      const loopEnd = Math.min(...buffers.map(buffer => buffer.duration));
      channels = buffers.map((buffer, index) => {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; source.loop = true; source.loopEnd = loopEnd;
        gain.gain.value = 0; source.connect(gain); gain.connect(compressor);
        return { id: tracks[index].id, source, gain };
      });
      const start = context.currentTime + .05;
      channels.forEach(channel => channel.source.start(start));
    })();
    try { await preparing; } finally { preparing = undefined; }
  }
  function mute() {
    if (!context || context.state === 'closed') return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
    context.suspend().catch(() => {});
  }
  return {
    get isPlaying() { return active; },
    async play(nextLevels) {
      if (disposed) return;
      const token = ++generation;
      active = true; levels = { ...nextLevels }; onState('loading', '準備音色');
      try {
        if (!context) {
          context = createContext(); compressor = context.createDynamicsCompressor(); master = context.createGain();
          compressor.threshold.value = -6; compressor.knee.value = 6; compressor.ratio.value = 8;
          compressor.attack.value = .003; compressor.release.value = .16;
          master.gain.value = 0; compressor.connect(master); master.connect(context.destination);
        }
        const resumed = context.resume(); // In the user's tap, before loading.
        await Promise.all([resumed, prepare()]);
        if (disposed || !active || token !== generation) return;
        applyLevels(); master.gain.setTargetAtTime(masterVolume, context.currentTime, .05);
        onState('playing');
      } catch {
        if (disposed || token !== generation) return;
        active = false; mute(); onState('error', '音色暫時無法載入，請再按一次播放。上方兩段 MP3 也可以直接試聽。');
      }
    },
    setLevels(nextLevels) { levels = { ...nextLevels }; if (active) applyLevels(); },
    setMaster(value) {
      masterVolume = Math.max(0, Math.min(1, value));
      if (active && channels) master.gain.setTargetAtTime(masterVolume, context.currentTime, .04);
    },
    pause() { if (disposed) return; ++generation; active = false; mute(); onState('paused'); },
    dispose() {
      if (disposed) return;
      disposed = true; ++generation; active = false; abort.abort();
      channels?.forEach(channel => { channel.source.stop(); channel.source.disconnect(); channel.gain.disconnect(); });
      compressor?.disconnect(); master?.disconnect(); context?.close().catch(() => {});
    },
  };
}
