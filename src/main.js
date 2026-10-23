import './diy/style.css';
import { createDesignEditor } from './diy/editor.js';
import { loadDesign, saveDesign } from './diy/design.js';
import './style.css';
import { createWorld } from './scene/world.js';
import { createFullscreenControl } from './integrations/fullscreen.js';
import { createVoiceLight } from './integrations/voice-light.js';
import { createInteractionGuide } from './integrations/interaction-guide.js';
import { createChristmasMusic } from './integrations/christmas-music.js';
import { christmasMusicMix } from './integrations/christmas-music-mix.js';
import { createHandCamera } from './integrations/hand-camera.js';
import { isDesktopHandCamera } from './integrations/hand-camera-platform.js';

const handCameraEnabled = isDesktopHandCamera();
if (handCameraEnabled) {
  document.querySelectorAll('#hand-toggle, .hand-setup').forEach(element => { element.hidden = false; });
} else {
  document.querySelectorAll('#hand-toggle, #hand-note, #hand-capture, .hand-setup').forEach(element => element.remove());
}

const button = document.querySelector('#awaken');
const label = document.querySelector('#button-label');
const status = document.querySelector('#status');
const reveal = document.querySelector('#reveal');
const music = createChristmasMusic({ button: document.querySelector('#music-toggle'), note: document.querySelector('#music-note'),
  urls: christmasMusicMix.tracks.map(track => `${import.meta.env.BASE_URL}${track.file}`),
  levels: christmasMusicMix.tracks.map(track => track.level), masterVolume: christmasMusicMix.masterVolume,
  compression: christmasMusicMix.compression });
const fullscreenControl = createFullscreenControl(
  document.querySelector('#fullscreen'),
  document.querySelector('main'),
  message => { status.textContent = message; },
);
let world;
let voice;
let guide;
let handCamera;
let editor;
let storage;
try { storage = window.localStorage; } catch { /* Session-only editing remains available. */ }
let { design: savedDesign, active: ownTree } = loadDesign(storage);
const visit = document.querySelector('#diy-visit');
const edit = document.querySelector('#diy-edit');
function updateDesignUI() {
  document.querySelector('main').classList.toggle('own-tree', ownTree);
  visit.firstChild.textContent = ownTree ? '格致聖誕樹 ' : savedDesign ? '我的聖誕樹 ' : 'DIY 我的聖誕樹 ';
  edit.hidden = !savedDesign;
  document.querySelectorAll('[data-tree-theme]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.treeTheme === 'classic'));
    if (button.dataset.treeTheme === 'classic') button.textContent = ownTree ? '作品原色' : '經典綠';
  });
}
function openEditor() { if (world?.isChangingDesign) return; document.querySelector('#interaction-guide').close(); editor?.open(savedDesign); }
function visitTree() {
  if (world?.isChangingDesign) return;
  if (!savedDesign) { openEditor(); return; }
  ownTree = !ownTree; world.applyDesign(savedDesign, ownTree); saveDesign(storage, savedDesign, ownTree); updateDesignUI();
  status.textContent = ownTree ? `${savedDesign.title} · ${savedDesign.blessing || '你的心意，點亮了冬夜。'}` : '歡迎回到格致聖誕樹 ✧';
}
updateDesignUI();
try {
  world = createWorld(document.querySelector('#tree-canvas'), () => {
    reveal.classList.add('visible');
    document.querySelector('main').classList.add('awakened');
    reveal.setAttribute('aria-hidden', 'false');
    label.textContent = '再次喚醒聖誕樹';
    button.setAttribute('aria-label', '再次喚醒聖誕樹');
    button.setAttribute('title', '再次喚醒聖誕樹');
    button.disabled = false;
    status.textContent = '雙指旋轉縮放／拖曳＋滾輪 · 快速旋轉或連點樹頂星星找驚喜';
    document.querySelector('main').classList.add('stage-settled');
    fullscreenControl.show();
  }, () => {
    document.querySelector('main').classList.add('stage-active', 'awakened');
    label.textContent = '聖誕樹正在登場';
    status.textContent = '燈光已點亮，讓聖誕樹來到舞台中央…';
  }, (delta, turning) => music.update(delta, turning), { initial: { design: savedDesign, active: ownTree }, onActivate: visitTree });
  editor = createDesignEditor({ dialog: document.querySelector('#diy-editor'), onOpen: () => { voice?.stop(); handCamera?.stop(); music.resetMotion(); }, onSave: (design, error) => {
    if (!design) { status.textContent = error; return; }
    savedDesign = design; ownTree = true; world.applyDesign(design, true);
    const stored = saveDesign(storage, design, true); updateDesignUI();
    status.textContent = stored ? `${design.title} · ${design.blessing || '你的作品已儲存，點遠方的樹可切回格致原版。'}` : '作品已套用；瀏覽器無法儲存，關閉分頁後不會保留。';
  } });
  visit.addEventListener('click', visitTree); edit.addEventListener('click', openEditor); document.querySelector('#diy-open').addEventListener('click', openEditor);
  button.addEventListener('click', () => {
    handCamera?.stop();
    voice?.stop();
    music.resetMotion();
    reveal.classList.remove('visible');
    reveal.setAttribute('aria-hidden', 'true');
    document.querySelector('main').classList.remove('awakened', 'stage-active', 'stage-settled');
    button.disabled = true;
    label.textContent = '星光正在甦醒';
    status.textContent = '讓光沿著枝葉，慢慢抵達星空…';
    world.awaken();
  });
  voice = createVoiceLight({ button: document.querySelector('#voice-toggle'), note: document.querySelector('#voice-note'),
    meter: document.querySelector('#voice-meter'), onEnergy: amount => world.addVoiceEnergy(amount), onLevel: value => world.setVoiceLevel(value),
    onListening: active => music.setListening(active) });
  guide = createInteractionGuide({ button: document.querySelector('#interaction-help'), dialog: document.querySelector('#interaction-guide'), onTheme: theme => world.setTheme(theme), onOpen: () => voice?.stop() });
  if (handCameraEnabled) handCamera = createHandCamera({ button: document.querySelector('#hand-toggle'), note: document.querySelector('#hand-note'),
    preview: document.querySelector('#hand-preview'), capture: document.querySelector('#hand-capture'), select: document.querySelector('#hand-camera-select'),
    onInput: input => world.setHandInput(input), onLight: () => world.lightFromPalm(), canInteract: () => world.canUseHands() });
  button.disabled = true;
  label.textContent = '星光正在匯聚';
  status.textContent = '讓彩帶穿過冬夜，喚醒每一片枝葉…';
} catch (error) {
  console.error('Unable to initialize the 3D invitation:', error);
  button.disabled = true;
  label.textContent = '無法啟動 3D 場景';
  status.textContent = '請使用支援 WebGL 2 的瀏覽器，並開啟硬體加速後重試。';
}
if (import.meta.hot) import.meta.hot.dispose(() => { editor?.dispose(); handCamera?.dispose(); guide?.dispose(); music.dispose(); voice?.dispose(); fullscreenControl.dispose(); world?.dispose(); });
