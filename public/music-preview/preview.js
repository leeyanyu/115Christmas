const players = [...document.querySelectorAll('audio')];
const status = document.querySelector('#playback-status');
const names = { transition: '情境切換', gentle: '輕柔冬夜', lively: '聖誕樹跳舞了' };

for (const player of players) {
  player.volume = .7;
  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
    status.textContent = `正在試聽：${names[player.id]}`;
  });
  player.addEventListener('ended', () => { status.textContent = '試聽結束，可以再聽聽另一種聖誕心情。'; });
  player.addEventListener('error', () => { status.textContent = '音檔暫時無法播放，可試試下方的 MP3 下載連結。'; });
}

function pauseAll() {
  const playing = players.some(player => !player.paused);
  players.forEach(player => player.pause());
  if (playing) status.textContent = '音樂已暫停，點選播放可繼續試聽。';
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
window.addEventListener('pagehide', pauseAll);
