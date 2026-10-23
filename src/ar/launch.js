export function arPlatform(device, quickLookSupported = false) {
  const ua = device?.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(device?.platform || '') && device?.maxTouchPoints > 1);
  if (ios) return quickLookSupported ? 'quick-look' : 'ios-browser';
  if (/Android/i.test(ua) || device?.userAgentData?.platform === 'Android') return 'scene-viewer';
  return 'desktop';
}

export function arLaunchURL(tree, platform, pageURL, baseURL) {
  const base = new URL(baseURL, pageURL);
  if (platform === 'quick-look') return new URL(tree.usdz, base).href;
  if (platform !== 'scene-viewer') return null;
  const params = new URLSearchParams({
    file: new URL(tree.glb, base).href, mode: 'ar_only', title: tree.title, resizable: 'true',
  });
  const fallback = new URL(pageURL);
  fallback.search = new URLSearchParams({ tree: tree.id, 'ar-fallback': '1' }).toString();
  fallback.hash = '';
  return `intent://arvr.google.com/scene-viewer/1.0?${params}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback.href)};end;`;
}

export function arShareURL(tree, pageURL) {
  const url = new URL(pageURL);
  url.search = new URLSearchParams({ tree: tree.id }).toString(); url.hash = '';
  return url.href;
}
