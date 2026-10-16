export function createFullscreenControl(button, target, onError = () => {}, doc = document) {
  const request = target.requestFullscreen || target.webkitRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  const supported = typeof request === 'function' && typeof exit === 'function';

  function activeElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function sync() {
    const active = activeElement() === target;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? '離開全螢幕' : '進入全螢幕');
    button.querySelector('.fullscreen-icon').textContent = active ? '×' : '⛶';
    button.querySelector('.fullscreen-label').textContent = active ? '離開' : '全螢幕';
  }

  async function toggle() {
    try {
      if (activeElement()) await exit.call(doc);
      else await request.call(target);
    } catch (error) {
      console.warn('Unable to change fullscreen mode:', error);
      onError('此瀏覽器目前無法切換全螢幕，仍可繼續旋轉與縮放聖誕樹。');
    }
  }

  if (!supported) return { show() {}, dispose() {} };
  button.addEventListener('click', toggle);
  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('webkitfullscreenchange', sync);
  sync();

  return {
    show() { button.hidden = false; },
    dispose() {
      button.removeEventListener('click', toggle);
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener('webkitfullscreenchange', sync);
    },
  };
}
