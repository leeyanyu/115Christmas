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
  const viewer = androidViewerURL(tree, pageURL, baseURL);
  const fallback = new URL(pageURL);
  fallback.search = new URLSearchParams({ tree: tree.id, 'ar-fallback': '1' }).toString();
  fallback.hash = '';
  // Scene Viewer's Google-app entry is also used by Google's model-viewer.
  // ARCore provides tracking; calling its package directly can immediately exit.
  return `intent://arvr.google.com/scene-viewer/1.2?${viewer.searchParams}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback.href)};end;`;
}

export function androidViewerURL(tree, pageURL, baseURL) {
  const params = new URLSearchParams({
    file: new URL(tree.glb, new URL(baseURL, pageURL)).href,
    mode: 'ar_preferred', title: tree.title, resizable: 'true',
  });
  return new URL(`https://arvr.google.com/scene-viewer/1.2?${params}`);
}

export function arShareURL(tree, pageURL) {
  const url = new URL(pageURL);
  url.search = new URLSearchParams({ tree: tree.id }).toString(); url.hash = '';
  return url.href;
}

export function androidReferenceURL(tree, pageURL, baseURL) {
  return arLaunchURL({ ...tree, title: 'AR 系統測試',
    glb: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb' }, 'scene-viewer', pageURL, baseURL);
}
