// Browsers cannot inspect the external viewer's AR state. Report a handoff or
// a return without claiming camera permission, plane detection or AR success.
export function createARLaunchFeedback({ links, note, help, doc = document, win = window,
  schedule = setTimeout, unschedule = clearTimeout }) {
  let timer, attempted = false, left = false;
  function clear() { unschedule(timer); timer = undefined; }
  function showHelp(message) { note.textContent = message; help.hidden = false; help.open = true; }
  function attempt() {
    clear(); attempted = true; left = false;
    note.textContent = '正在開啟系統檢視器…';
    timer = schedule(() => {
      if (!left && !doc.hidden) showHelp('系統檢視器尚未開啟。可改試下方連結，或確認 Google 與 AR 服務已啟用並更新。');
    }, 3000);
  }
  function leave() { if (attempted) { left = true; clear(); } }
  function returned() {
    if (!attempted || !left || doc.hidden) return;
    attempted = false;
    showHelp('已回到作品頁。若剛才沒有出現相機 AR 畫面，可改試下方連結，並確認 Google 與 AR 服務已更新。');
  }
  function visibility() { if (doc.hidden) leave(); else returned(); }
  links.forEach(link => link.addEventListener('click', attempt));
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('pagehide', leave); win.addEventListener('pageshow', returned);
  return { dispose() {
    clear(); links.forEach(link => link.removeEventListener('click', attempt));
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('pagehide', leave); win.removeEventListener('pageshow', returned);
  } };
}
