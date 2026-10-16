import './style.css';
import { createWorld } from './scene/world.js';
import { createFullscreenControl } from './integrations/fullscreen.js';
import { createVoiceLight } from './integrations/voice-light.js';

const button = document.querySelector('#awaken');
const label = document.querySelector('#button-label');
const status = document.querySelector('#status');
const reveal = document.querySelector('#reveal');
const fullscreenControl = createFullscreenControl(
  document.querySelector('#fullscreen'),
  document.querySelector('main'),
  message => { status.textContent = message; },
);
let world;
let voice;
try {
  world = createWorld(document.querySelector('#tree-canvas'), () => {
    reveal.classList.add('visible');
    document.querySelector('main').classList.add('awakened');
    reveal.setAttribute('aria-hidden', 'false');
    label.textContent = '再次喚醒聖誕樹';
    button.disabled = false;
    status.textContent = '雙指旋轉縮放／拖曳＋滾輪 · 快速旋轉或連點樹頂星星找驚喜';
    document.querySelector('main').classList.add('stage-settled');
    fullscreenControl.show();
  }, () => {
    document.querySelector('main').classList.add('stage-active', 'awakened');
    label.textContent = '聖誕樹正在登場';
    status.textContent = '燈光已點亮，讓聖誕樹來到舞台中央…';
  });
  button.addEventListener('click', () => {
    voice?.stop();
    reveal.classList.remove('visible');
    reveal.setAttribute('aria-hidden', 'true');
    document.querySelector('main').classList.remove('awakened', 'stage-active', 'stage-settled');
    button.disabled = true;
    label.textContent = '星光正在甦醒';
    status.textContent = '讓光沿著枝葉，慢慢抵達星空…';
    world.awaken();
  });
  voice = createVoiceLight({ button: document.querySelector('#voice-toggle'), note: document.querySelector('#voice-note'),
    meter: document.querySelector('#voice-meter'), onEnergy: amount => world.addVoiceEnergy(amount), onLevel: value => world.setVoiceLevel(value) });
  button.disabled = true;
  label.textContent = '星光正在匯聚';
  status.textContent = '讓彩帶穿過冬夜，喚醒每一片枝葉…';
} catch (error) {
  console.error('Unable to initialize the 3D invitation:', error);
  button.disabled = true;
  label.textContent = '無法啟動 3D 場景';
  status.textContent = '請使用支援 WebGL 2 的瀏覽器，並開啟硬體加速後重試。';
}
if (import.meta.hot) import.meta.hot.dispose(() => { voice?.dispose(); fullscreenControl.dispose(); world?.dispose(); });
