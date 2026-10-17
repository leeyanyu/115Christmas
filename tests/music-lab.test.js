import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditionMixer } from '../public/music-lab/mixer.js';

function setup(fetchAudio) {
  const contexts = [], requests = [], states = [];
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; } });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; } });
  function createContext() {
    const context = {
      currentTime: 10, state: 'suspended', destination: {}, gains: [], sources: [],
      async resume() { this.state = 'running'; }, async suspend() { this.state = 'suspended'; }, async close() { this.state = 'closed'; },
      async decodeAudioData() { return { duration: 32 * 60 / 132 }; },
      createGain() { const gain = { ...node(), gain: parameter() }; this.gains.push(gain); return gain; },
      createDynamicsCompressor() { return { ...node(), ...Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, parameter()])) }; },
      createBufferSource() { const source = { ...node(), start(time) { this.started = time; }, stop() { this.stopped = true; } }; this.sources.push(source); return source; },
    };
    contexts.push(context); return context;
  }
  const mixer = createAuditionMixer({ tracks: Array.from({ length: 8 }, (_, id) => ({ id: String(id), file: `${id}.mp3` })),
    createContext, onState: (...args) => states.push(args), fetchAudio: (...args) => {
      requests.push(args); return fetchAudio ? fetchAudio(...args) : Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    } });
  return { mixer, contexts, requests, states, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('audition mixer stays lazy and reuses eight synchronized sources across solo and mix changes', async () => {
  const s = setup(); assert.equal(s.requests.length, 0);
  await s.mixer.play({ 0: 1 }); const context = s.contexts[0];
  assert.equal(context.sources.length, 8); assert.equal(s.requests.length, 8);
  assert.ok(context.sources.every(source => source.loop && source.started === 10.05 && source.loopEnd === 32 * 60 / 132));
  assert.equal(context.gains[1].gain.value, 1); assert.ok(context.gains.slice(2).every(gain => gain.gain.value === 0));
  s.mixer.setLevels({ 1: 1, 3: .85 });
  assert.equal(context.gains[1].gain.value, 0); assert.equal(context.gains[2].gain.value, 1); assert.equal(context.gains[4].gain.value, .85);
  for (let i = 0; i < 20; i++) { s.mixer.pause(); await s.mixer.play({ [i % 8]: .7 }); }
  assert.equal(s.contexts.length, 1); assert.equal(context.sources.length, 8); assert.equal(s.requests.length, 8);
  s.mixer.setMaster(.4); assert.equal(context.gains[0].gain.value, .4);
  s.mixer.pause(); assert.equal(context.state, 'suspended'); assert.equal(context.gains[0].gain.value, 0);
  s.mixer.dispose(); s.mixer.dispose();
  assert.equal(context.state, 'closed'); assert.ok(context.sources.every(source => source.stopped && source.disconnected));
});

test('pausing, rapidly switching solo, and disposing during loading cannot restart cancelled audio', async () => {
  let finish;
  const loading = new Promise(resolve => { finish = resolve; });
  const s = setup(() => loading);
  const first = s.mixer.play({ 0: 1 }); const second = s.mixer.play({ 1: 1 }); s.mixer.pause();
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await Promise.all([first, second]);
  assert.equal(s.mixer.isPlaying, false); assert.equal(s.contexts[0].gains[0].gain.value, 0);
  assert.equal(s.contexts[0].sources.length, 8); assert.equal(s.requests.length, 8);
  await s.mixer.play({ 2: 1 }); assert.equal(s.contexts[0].gains[3].gain.value, 1); s.mixer.dispose();

  let resolveLate;
  const pending = new Promise(resolve => { resolveLate = resolve; });
  const t = setup(() => pending); const play = t.mixer.play({ 0: 1 });
  const signal = t.requests[0][1].signal; t.mixer.dispose();
  resolveLate({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await play;
  assert.equal(signal.aborted, true); assert.equal(t.contexts[0].sources.length, 0);
});

test('instrument download errors leave the mixer retryable', async () => {
  let failed = true;
  const s = setup(async () => ({ ok: !failed, arrayBuffer: async () => new ArrayBuffer(1) }));
  await s.mixer.play({ 0: 1 }); assert.equal(s.mixer.isPlaying, false); assert.equal(s.states.at(-1)[0], 'error');
  failed = false; await s.mixer.play({ 0: 1 }); assert.equal(s.states.at(-1)[0], 'playing');
  assert.equal(s.contexts[0].sources.length, 8); s.mixer.dispose();
});
