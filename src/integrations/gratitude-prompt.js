const hints = ['輕觸聖誕樹，讓每一份感恩慢慢發光', '用歌聲來點亮聖誕樹'];

export function createGratitudePrompt(element, reducedMotion) {
  let idle = true, elapsed = 0, index = 0, animation;
  function write(text, fade = false) {
    animation?.cancel();
    element.textContent = text;
    if (fade && !reducedMotion.matches) animation = element.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 550, easing: 'ease-out' });
  }
  return {
    show({ phase, count, total }) {
      idle = phase !== 'blooming' && count === 0;
      elapsed = 0; index = 0;
      write(phase === 'blooming' ? '每一份感恩，都讓冬夜更明亮。謝謝你 ✧'
        : count ? `感恩的光 ${count} / ${total} · 讓祝福慢慢抵達星星` : hints[0]);
    },
    update(delta) {
      if (!idle) return;
      elapsed += delta;
      if (elapsed >= 6) { elapsed %= 6; index = (index + 1) % hints.length; write(hints[index], true); }
    },
    dispose() { animation?.cancel(); },
  };
}
