import test from 'node:test';
import assert from 'node:assert/strict';
import { isDesktopHandCamera } from '../src/integrations/hand-camera-platform.js';

test('camera gestures exclude phones and tablets, including desktop-mode mobile browsers', () => {
  for (const device of [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet)' },
    { userAgentData: { mobile: true }, userAgent: 'Mozilla/5.0' },
    { userAgentData: { mobile: false, platform: 'Android' }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 },
  ]) assert.equal(isDesktopHandCamera(device), false, JSON.stringify(device));
});

test('camera gestures remain available on desktops, including touch-enabled Windows', () => {
  for (const device of [
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 10 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', userAgentData: { mobile: false, platform: 'Linux' } },
  ]) assert.equal(isDesktopHandCamera(device), true, JSON.stringify(device));
  assert.equal(isDesktopHandCamera(null), false);
});
