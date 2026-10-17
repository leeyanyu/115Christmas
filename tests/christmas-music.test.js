import test from 'node:test';
import assert from 'node:assert/strict';
import { createChristmasMusic } from '../src/integrations/christmas-music.js';
import { christmasMusicMix } from '../src/integrations/christmas-music-mix.js';

function setup(fetchAudio, options = {}) {
  class Button extends EventTarget {
    dataset = {};
    classList = { toggle() {} };
    setAttribute(key, value) { this[key] = value; }
  }
  class Parameter {
    value = 0; events = [];
    cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
    cancelScheduledValues(time) { this.events.push(['cancel', time]); }
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  }
  const button = new Button(), note = {}, doc = new EventTarget(), win = new EventTarget();
  const contexts = [], requests = [], timers = new Map(); doc.hidden = false;
  function createContext() {
    const context = {
      currentTime: 10, state: 'suspended', destination: {}, sources: [], gains: [],
      async resume() { this.state = 'running'; },
      async suspend() { this.state = 'suspended'; },
      async close() { this.state = 'closed'; },
      async decodeAudioData(data) { return { data, duration: 15 }; },
      createGain() {
        const gain = { gain: new Parameter(), connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
        this.gains.push(gain); return gain;
      },
      createDynamicsCompressor() {
        const compressor = { connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
        for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) compressor[key] = new Parameter();
        this.compressor = compressor; return compressor;
      },
      createBufferSource() {
        const source = { connect(target) { this.target = target; }, start(time) { this.started = time; }, stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
        this.sources.push(source); return source;
      },
    };
    contexts.push(context); return context;
  }
  const music = createChristmasMusic({ button, note, urls: ['melody', 'rhythm'], autoPlay: false, doc, win,
    createContext: () => { const context = createContext(); options.configureContext?.(context); return context; }, ...options,
    fetchAudio: (...args) => { requests.push(args); return fetchAudio ? fetchAudio(...args) : Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }); },
    schedule(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, unschedule(id) { timers.delete(id); } });
  return { music, button, note, contexts, requests, doc, win,
    click: () => button.dispatchEvent(new Event('click')), flush: () => new Promise(resolve => setImmediate(resolve)),
    runTimers() { for (const fn of [...timers.values()]) fn(); timers.clear(); } };
}

test('music waits for a gesture, keeps the melody continuous, and fades synchronized accompaniment', async () => {
  const s = setup();
  s.music.update(20, true); s.music.update(1, false);
  assert.equal(s.requests.length, 0); assert.equal(s.contexts.length, 0);
  s.click(); await s.flush();
  const context = s.contexts[0], [master, melody, rhythm] = context.gains;
  assert.equal(context.state, 'running'); assert.equal(s.requests.length, 2);
  assert.equal(context.sources.length, 2); assert.ok(context.sources.every(source => source.loop && source.started === 10.03));
  assert.equal(master.gain.value, .7); assert.equal(melody.gain.value, 1); assert.equal(rhythm.gain.value, 0);
  s.music.update(.1, true);
  assert.equal(s.button.dataset.musicMood, 'lively');
  assert.equal(melody.gain.events.length, 0, 'rotation must not interrupt or fade the melody');
  assert.deepEqual(rhythm.gain.events.at(-1), ['ramp', 1, 11.2]);
  const eventCount = rhythm.gain.events.length;
  for (let frame = 0; frame < 120; frame++) s.music.update(1 / 60, true);
  assert.equal(rhythm.gain.events.length, eventCount, 'one movement should not continually reschedule audio automation');
  s.music.update(.6, false); assert.equal(s.button.dataset.musicMood, 'lively');
  s.music.update(.2, false); assert.equal(s.button.dataset.musicMood, 'melody');
  assert.equal(melody.gain.value, 1); assert.equal(melody.gain.events.length, 0);
  assert.deepEqual(rhythm.gain.events.at(-1), ['ramp', 0, 11.2]);
  s.click(); s.runTimers(); assert.equal(context.state, 'suspended');
  for (let i = 0; i < 12; i++) { s.click(); await s.flush(); s.click(); s.runTimers(); }
  assert.equal(s.requests.length, 2); assert.equal(s.contexts.length, 1); assert.equal(context.sources.length, 2);
  s.music.dispose(); s.music.dispose();
  assert.equal(context.state, 'closed'); assert.ok(context.sources.every(source => source.stopped && source.disconnected));
  assert.ok(context.gains.every(gain => gain.disconnected));
  s.click(); assert.equal(s.contexts.length, 1);
});

test('approved audition mix preserves all six original samples, gains and shared compression', async () => {
  const { tracks, masterVolume, compression } = christmasMusicMix;
  assert.deepEqual(tracks.map(track => [track.file, track.level]), [
    ['music-lab/audio/crystal-round.mp3', .4],
    ['music-lab/audio/electronic-drums.mp3', 1.2],
    ['music-lab/audio/piano-rhythm.mp3', .9],
    ['music-lab/audio/bass.mp3', 1.2],
    ['music-lab/audio/sleigh-bells.mp3', .25],
    ['music-lab/audio/trumpet.mp3', .3],
  ]);
  const s = setup(undefined, { urls: tracks.map(track => track.file), levels: tracks.map(track => track.level),
    masterVolume, compression });
  s.click(); await s.flush();
  const context = s.contexts[0], [master, ...channels] = context.gains;
  assert.deepEqual(s.requests.map(([url]) => url), tracks.map(track => track.file));
  assert.equal(master.gain.value, .5, 'the selected 50% master is applied after compression');
  assert.equal(master.target, context.destination);
  assert.equal(context.compressor.target, master);
  assert.deepEqual(Object.fromEntries(Object.keys(compression).map(key => [key, context.compressor[key].value])),
    { threshold: -6, knee: 6, ratio: 8, attack: .003, release: .16 });
  assert.ok(channels.every(channel => channel.target === context.compressor));
  assert.deepEqual(channels.map(channel => channel.gain.value), [.4, 0, 0, 0, 0, 0]);
  assert.ok(context.sources.every((source, index) => source.target === channels[index]
    && source.loop && source.loopEnd === 15 && source.started === 10.03));
  s.music.update(.1, true);
  assert.deepEqual(channels.map(channel => channel.gain.value), [.4, 1.2, .9, 1.2, .25, .3]);
  assert.ok(channels.slice(1).every(channel => channel.gain.events.at(-1)[2] === 11.2),
    'every accompaniment layer uses the same fade clock');
  assert.deepEqual(channels[0].gain.events, [], 'the crystal piano must continue through rotation');
  s.music.update(1, false);
  assert.deepEqual(channels.map(channel => channel.gain.value), [.4, 0, 0, 0, 0, 0]);
  s.music.setListening(true);
  assert.equal(master.gain.value, 0); assert.equal(context.state, 'suspended');
  s.music.setListening(false); await s.flush();
  assert.equal(master.gain.value, .5);
  s.click(); s.runTimers(); s.click(); await s.flush();
  assert.equal(s.requests.length, 6); assert.equal(context.sources.length, 6);
  s.music.dispose();
  assert.equal(context.compressor.disconnected, true);
  assert.ok(context.sources.every(source => source.stopped && source.disconnected));
  assert.ok(context.gains.every(gain => gain.disconnected));
});

test('microphone and hidden pages immediately mute; returning honors the music preference', async () => {
  const s = setup(); s.click(); await s.flush();
  const context = s.contexts[0], master = context.gains[0];
  s.music.setListening(true);
  assert.equal(master.gain.value, 0); assert.equal(context.state, 'suspended'); assert.equal(s.button['aria-pressed'], 'true');
  s.music.update(.1, true); assert.equal(master.gain.value, 0);
  s.music.setListening(false); await s.flush(); assert.equal(context.state, 'running');
  s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(context.state, 'suspended'); assert.equal(master.gain.value, 0);
  s.music.setListening(true); s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange'));
  await s.flush(); assert.equal(context.state, 'suspended', 'returning cannot resume music while the microphone is active');
  s.music.setListening(false); await s.flush(); assert.equal(context.state, 'running');
  s.win.dispatchEvent(new Event('pagehide')); assert.equal(context.state, 'suspended');
  s.win.dispatchEvent(new Event('pageshow')); await s.flush(); assert.equal(context.state, 'running');
  s.music.setListening(true); s.click(); s.music.setListening(false); await s.flush();
  assert.equal(context.state, 'suspended', 'turning off during singing must stay off afterward');
  s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange'));
  s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); await s.flush();
  assert.equal(context.state, 'suspended'); s.music.dispose();
});

test('cancelling or disposing while music loads cannot turn it on later', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const s = setup(() => pending);
  s.click(); assert.equal(s.button['aria-busy'], 'true');
  s.click(); s.runTimers();
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }); await s.flush();
  assert.equal(s.button['aria-pressed'], 'false'); assert.equal(s.contexts[0].gains[0].gain.value, 0);
  assert.equal(s.contexts[0].state, 'suspended');
  s.click(); await s.flush(); assert.equal(s.contexts[0].state, 'running'); assert.equal(s.requests.length, 2);
  s.music.dispose();

  let finish;
  const late = new Promise(done => { finish = done; });
  const t = setup(() => late);
  t.click(); const signal = t.requests[0][1].signal; t.music.dispose();
  assert.equal(signal.aborted, true);
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }); await t.flush();
  assert.equal(t.contexts[0].sources.length, 0); assert.equal(t.contexts[0].state, 'closed');
});

test('rapid toggles and microphone changes during download cannot duplicate or unmute the graph', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const s = setup(() => pending);
  s.click(); s.click(); s.click();
  s.music.setListening(true); s.music.setListening(false); s.music.setListening(true);
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }); await s.flush();
  assert.equal(s.contexts.length, 1); assert.equal(s.requests.length, 2); assert.equal(s.contexts[0].sources.length, 2);
  assert.equal(s.contexts[0].gains[0].gain.value, 0); assert.equal(s.contexts[0].state, 'suspended');
  s.music.setListening(false); await s.flush();
  assert.equal(s.contexts[0].state, 'running'); assert.equal(s.contexts[0].sources.length, 2);
  s.music.dispose();
});

test('load and playback failures remain retryable without duplicating sources', async () => {
  let failed = true;
  const s = setup(async () => ({ ok: !failed, arrayBuffer: async () => new ArrayBuffer(2) }));
  s.click(); await s.flush(); assert.equal(s.button['aria-pressed'], 'false'); assert.match(s.note.textContent, /重試/);
  assert.equal(s.contexts[0].sources.length, 0);
  failed = false; s.click(); await s.flush(); assert.equal(s.contexts[0].state, 'running');
  assert.equal(s.contexts[0].sources.length, 2);
  s.click(); s.runTimers();
  const resume = s.contexts[0].resume;
  s.contexts[0].resume = async () => { throw new Error('gesture needed'); };
  s.click(); await s.flush(); assert.equal(s.button['aria-pressed'], 'false');
  s.contexts[0].resume = resume;
  s.click(); await s.flush(); assert.equal(s.contexts[0].state, 'running');
  assert.equal(s.contexts[0].sources.length, 2); s.music.resetMotion(); assert.equal(s.button.dataset.musicMood, 'melody');
  s.music.dispose();
});

test('autoplay starts without a gesture when permitted and stays off after the visitor mutes', async () => {
  const s = setup(undefined, { autoPlay: true }); await s.flush();
  assert.equal(s.contexts.length, 1); assert.equal(s.requests.length, 2);
  assert.equal(s.contexts[0].state, 'running'); assert.equal(s.button.dataset.musicPlayback, 'playing');
  s.click(); s.runTimers();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown']) s.doc.dispatchEvent(new Event(type));
  await s.flush();
  assert.equal(s.contexts[0].state, 'suspended'); assert.equal(s.button['aria-pressed'], 'false');
  s.music.dispose();
});

test('a pending or denied autoplay resume waits for a gesture without hanging preparation', async () => {
  for (const denial of ['pending', 'rejected']) {
    let calls = 0;
    const s = setup(undefined, { autoPlay: true, configureContext(context) {
      const resume = context.resume.bind(context);
      context.resume = () => {
        if (++calls > 1) return resume();
        return denial === 'pending' ? new Promise(() => {})
          : Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
      };
    } });
    await s.flush();
    assert.equal(s.button['aria-busy'], 'false', 'audio loading cannot wait for a blocked resume promise');
    assert.equal(s.button['aria-pressed'], 'true'); assert.equal(s.button.dataset.musicPlayback, 'waiting');
    assert.equal(s.contexts[0].gains[0].gain.value, 0);
    s.doc.dispatchEvent(new Event('pointerup')); await s.flush();
    assert.equal(s.contexts[0].state, 'running'); assert.equal(s.button.dataset.musicPlayback, 'playing');
    assert.equal(s.contexts[0].sources.length, 2); assert.equal(s.requests.length, 2);
    s.music.dispose();
  }
});

test('mute, microphone and dispose prevent a late autoplay unlock from overriding them', async () => {
  let unblock;
  const s = setup(undefined, { autoPlay: true, configureContext(context) {
    context.resume = () => new Promise(resolve => { unblock = () => { context.state = 'running'; context.onstatechange?.(); resolve(); }; });
  } });
  await s.flush(); s.click();
  unblock(); await s.flush(); assert.equal(s.contexts[0].state, 'suspended');
  assert.equal(s.contexts[0].gains[0].gain.value, 0); assert.equal(s.button['aria-pressed'], 'false');
  const count = s.contexts.length; s.music.dispose();
  s.doc.dispatchEvent(new Event('pointerup')); await s.flush(); assert.equal(s.contexts.length, count);

  let blocked = true;
  const t = setup(undefined, { autoPlay: true, configureContext(context) {
    const resume = context.resume.bind(context);
    context.resume = () => blocked ? new Promise(() => {}) : resume();
  } });
  await t.flush(); t.music.setListening(true); blocked = false;
  t.doc.dispatchEvent(new Event('touchend')); await t.flush();
  assert.equal(t.contexts[0].state, 'suspended', 'gesture cannot start music during microphone analysis');
  t.music.setListening(false); await t.flush(); assert.equal(t.contexts[0].state, 'running');
  t.music.dispose();
});
