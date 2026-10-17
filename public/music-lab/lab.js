import { createAuditionMixer } from './mixer.js';

const players = [...document.querySelectorAll('audio')];
const status = document.querySelector('#mix-status');
const play = document.querySelector('#play-mix'), pause = document.querySelector('#pause-mix');
const reset = document.querySelector('#reset-mix'), summary = document.querySelector('#choice-text');
const master = document.querySelector('#master-volume');
let catalog, engine, selectedLead = 'crystal-clear', solo = null;
const volumes = {}, enabled = {}, soloButtons = new Map(), selectionInputs = new Map(), volumeInputs = new Map();

function levels() {
  if (solo) return { [solo]: volumes[solo] / 100 };
  return Object.fromEntries(catalog.tracks.map(track => [track.id,
    (track.family === 'lead' ? track.id === selectedLead : enabled[track.id]) ? volumes[track.id] / 100 : 0]));
}
function describe() {
  if (!catalog) return;
  const lead = catalog.tracks.find(track => track.id === selectedLead);
  const backing = catalog.tracks.filter(track => track.family === 'backing' && enabled[track.id]);
  summary.value = `我的聖誕音樂選擇\n主旋律：${lead.label} ${volumes[lead.id]}%\n伴奏：${backing.length ? backing.map(track => `${track.label} ${volumes[track.id]}%`).join('、') : '不加入伴奏'}\n小號：${enabled.trumpet ? `${volumes.trumpet}%` : '關閉'}\n組合音量：${master.value}%`;
}
function playingLabel() {
  return solo ? `正在單聽：${catalog.tracks.find(track => track.id === solo).label}`
    : `正在播放我的組合：${catalog.tracks.find(track => track.id === selectedLead).label}＋${catalog.tracks.filter(track => track.family === 'backing' && enabled[track.id]).map(track => track.label).join('、') || '無伴奏'}`;
}
function updateSoloButtons() {
  for (const [id, button] of soloButtons) {
    const active = solo === id && engine?.isPlaying;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '單聽中' : '單聽';
  }
}
function changed(clearSolo = false) {
  if (clearSolo) solo = null;
  engine?.setLevels(levels()); describe(); updateSoloButtons();
  if (engine?.isPlaying) status.textContent = playingLabel();
}
async function start(id = null) {
  players.forEach(player => player.pause());
  solo = id;
  const track = catalog.tracks.find(item => item.id === id);
  if (track?.family === 'lead') { selectedLead = id; selectionInputs.get(id).checked = true; }
  describe();
  await engine.play(levels());
}
function renderTrack(track) {
  volumes[track.id] = track.volume; enabled[track.id] = track.enabled;
  const card = document.createElement('article'); card.className = 'instrument'; card.dataset.instrument = track.id;
  const label = document.createElement('label'); label.className = 'instrument-label';
  const select = document.createElement('input'); select.type = track.family === 'lead' ? 'radio' : 'checkbox';
  select.name = track.family === 'lead' ? 'lead' : track.id; select.value = track.id;
  select.checked = track.family === 'lead' ? track.id === selectedLead : track.enabled;
  const name = document.createElement('span'); name.textContent = track.label;
  label.append(select, name); selectionInputs.set(track.id, select);
  const description = document.createElement('p'); description.textContent = track.description;
  const controls = document.createElement('div'); controls.className = 'instrument-controls';
  const audition = document.createElement('button'); audition.type = 'button'; audition.className = 'solo secondary';
  audition.textContent = '單聽'; audition.setAttribute('aria-label', `單獨試聽${track.label}`); audition.setAttribute('aria-pressed', 'false');
  audition.addEventListener('click', () => { void start(track.id); }); soloButtons.set(track.id, audition);
  const volume = document.createElement('label'); volume.className = 'volume-label'; volume.append('音量');
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '120'; slider.step = '5';
  slider.value = String(track.volume); slider.setAttribute('aria-label', `${track.label}音量`);
  const output = document.createElement('output'); output.textContent = `${track.volume}%`;
  volume.append(slider, output); volumeInputs.set(track.id, { slider, output });
  slider.addEventListener('input', () => { volumes[track.id] = Number(slider.value); output.textContent = `${slider.value}%`; changed(); });
  select.addEventListener('change', () => {
    if (track.family === 'lead') selectedLead = track.id;
    else enabled[track.id] = select.checked;
    changed(true);
  });
  controls.append(audition, volume); card.append(label, description, controls);
  document.querySelector(track.family === 'lead' ? '#lead-tracks' : '#backing-tracks').append(card);
}

for (const player of players) {
  player.volume = .85;
  player.addEventListener('play', () => {
    players.forEach(other => { if (other !== player) other.pause(); });
    engine?.pause(); updateSoloButtons(); pause.disabled = false;
    status.textContent = `正在播放範例：${player.getAttribute('aria-label')}`;
  });
  player.addEventListener('ended', () => { status.textContent = '範例試聽結束，可以往下比較音色與樂器。'; pause.disabled = true; });
  player.addEventListener('error', () => { status.textContent = '範例暫時無法播放，可以使用下方的 MP3 下載連結。'; });
}
play.addEventListener('click', () => { void start(); });
function pauseEverything() { players.forEach(player => player.pause()); engine?.pause(); }
pause.addEventListener('click', pauseEverything);
master.addEventListener('input', () => {
  document.querySelector('#master-output').textContent = `${master.value}%`;
  engine?.setMaster(Number(master.value) / 100); describe();
});
reset.addEventListener('click', () => {
  selectedLead = 'crystal-clear'; solo = null;
  catalog.tracks.forEach(track => {
    volumes[track.id] = track.volume; enabled[track.id] = track.enabled;
    selectionInputs.get(track.id).checked = track.family === 'lead' ? track.id === selectedLead : track.enabled;
    const { slider, output } = volumeInputs.get(track.id); slider.value = String(track.volume); output.textContent = `${track.volume}%`;
  });
  master.value = '80'; document.querySelector('#master-output').textContent = '80%'; engine.setMaster(.8); changed(true);
});
document.querySelector('#copy-choice').addEventListener('click', async () => {
  const message = document.querySelector('#copy-status');
  if (!catalog) { message.textContent = '樂器選單尚未準備好，可以先聽上方範例。'; return; }
  describe();
  try { await navigator.clipboard.writeText(summary.value); message.textContent = '已複製，貼回對話就能告訴我你的選擇。'; }
  catch { summary.focus(); summary.select(); message.textContent = '請複製上方已選取的文字，貼回對話即可。'; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseEverything(); });
window.addEventListener('pagehide', pauseEverything);

try {
  const response = await fetch('./catalog.json');
  if (!response.ok) throw new Error('catalog unavailable');
  catalog = await response.json(); catalog.tracks.forEach(renderTrack);
  engine = createAuditionMixer({ tracks: catalog.tracks, onState(state, detail) {
    play.setAttribute('aria-busy', String(state === 'loading'));
    pause.disabled = state !== 'playing' && state !== 'loading';
    status.textContent = state === 'loading' ? `正在載入音色 ${detail}…`
      : state === 'playing' ? playingLabel()
        : state === 'error' ? detail : '已暫停；可繼續挑選，或播放我的組合。';
    updateSoloButtons();
  } });
  play.disabled = reset.disabled = false; describe();
  status.textContent = '點各樂器的「單聽」，或直接播放我的組合。';
} catch {
  status.textContent = '樂器選單暫時無法載入，上方兩段 MP3 仍可直接試聽。';
}
