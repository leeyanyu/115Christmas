import test from 'node:test';
import assert from 'node:assert/strict';
import { createChristmasMusic } from '../src/integrations/christmas-music.js';

function setup(fetchAudio) {
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
      async decodeAudioData(data) { return { data }; },
      createGain() {
        const gain = { gain: new Parameter(), connect() {}, disconnect() { this.disconnected = true; } };
        this.gains.push(gain); return gain;
      },
      createBufferSource() {
        const source = { connect() {}, start(time) { this.started = time; }, stop() { this.stopped = true; }, disconnect() { this.disconnected = true; } };
        this.sources.push(source); return source;
      },
    };
    contexts.push(context); return context;
  }
  const music = createChristmasMusic({ button, note, urls: ['gentle', 'lively'], doc, win, createContext,
    fetchAudio: (...args) => { requests.push(args); return fetchAudio ? fetchAudio(...args) : Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }); },
    schedule(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, unschedule(id) { timers.delete(id); } });
  return { music, button, note, contexts, requests, doc, win,
    click: () => button.dispatchEvent(new Event('click')), flush: () => new Promise(resolve => setImmediate(resolve)),
    runTimers() { for (const fn of [...timers.values()]) fn(); timers.clear(); } };
}

test('music waits for a gesture, fades between rotation moods, and reuses its graph', async () => {
  const s = setup();
  s.music.update(20, true); s.music.update(1, false);
  assert.equal(s.requests.length, 0); assert.equal(s.contexts.length, 0);
  s.click(); await s.flush();
  const context = s.contexts[0], [master, gentle, lively] = context.gains;
  assert.equal(context.state, 'running'); assert.equal(s.requests.length, 2);
  assert.equal(context.sources.length, 2); assert.ok(context.sources.every(source => source.loop && source.started === 10));
  assert.equal(master.gain.value, .7); assert.equal(gentle.gain.value, 1); assert.equal(lively.gain.value, 0);
  s.music.update(.1, true);
  assert.equal(s.button.dataset.musicMood, 'lively');
  assert.deepEqual(gentle.gain.events.at(-1), ['ramp', 0, 11.4]);
  assert.deepEqual(lively.gain.events.at(-1), ['ramp', 1, 11.4]);
  const eventCount = lively.gain.events.length;
  for (let frame = 0; frame < 120; frame++) s.music.update(1 / 60, true);
  assert.equal(lively.gain.events.length, eventCount, 'one movement should not continually reschedule audio automation');
  s.music.update(.6, false); assert.equal(s.button.dataset.musicMood, 'lively');
  s.music.update(.2, false); assert.equal(s.button.dataset.musicMood, 'gentle');
  s.click(); s.runTimers(); assert.equal(context.state, 'suspended');
  for (let i = 0; i < 12; i++) { s.click(); await s.flush(); s.click(); s.runTimers(); }
  assert.equal(s.requests.length, 2); assert.equal(s.contexts.length, 1); assert.equal(context.sources.length, 2);
  s.music.dispose(); s.music.dispose();
  assert.equal(context.state, 'closed'); assert.ok(context.sources.every(source => source.stopped && source.disconnected));
  assert.ok(context.gains.every(gain => gain.disconnected));
  s.click(); assert.equal(s.contexts.length, 1);
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
  assert.equal(s.contexts[0].sources.length, 2); s.music.resetMotion(); assert.equal(s.button.dataset.musicMood, 'gentle');
  s.music.dispose();
});
