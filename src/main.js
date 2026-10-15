import './style.css';
import { createWorld } from './scene/world.js';

const button = document.querySelector('#awaken');
const label = document.querySelector('#button-label');
const status = document.querySelector('#status');
const reveal = document.querySelector('#reveal');
let world;
try {
  world = createWorld(document.querySelector('#tree-canvas'), () => {
    reveal.classList.add('visible');
    document.querySelector('main').classList.add('awakened');
    reveal.setAttribute('aria-hidden', 'false');
    label.textContent = '聖誕樹已點亮';
    status.textContent = 'Light Up Christmas 2026 · 12 月 18 日，與你相見';
  });
  button.addEventListener('click', () => {
    button.disabled = true;
    label.textContent = '星光正在甦醒';
    status.textContent = '讓光沿著枝葉，慢慢抵達星空…';
    world.awaken();
  });
} catch (error) {
  console.error('Unable to initialize the 3D invitation:', error);
  button.disabled = true;
  label.textContent = '無法啟動 3D 場景';
  status.textContent = '請使用支援 WebGL 2 的瀏覽器，並開啟硬體加速後重試。';
}
if (import.meta.hot) import.meta.hot.dispose(() => world?.dispose());
