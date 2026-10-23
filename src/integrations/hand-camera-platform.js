// Keep projection gestures on computers, including narrow desktop windows and
// Windows touchscreens. iPadOS can identify itself as a Mac in desktop mode.
export function isDesktopHandCamera(device = globalThis.navigator) {
  if (!device) return false;
  if (device.userAgentData?.mobile) return false;
  if (/Android|iOS/i.test(device.userAgentData?.platform || '')) return false;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Windows Phone|Silk|Kindle/i.test(device.userAgent || '')) return false;
  if (/Mac/i.test(device.platform || '') && device.maxTouchPoints > 1) return false;
  return true;
}
