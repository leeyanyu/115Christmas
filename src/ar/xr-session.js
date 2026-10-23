// Own the native WebXR session separately from Three.js and UI rendering.
export function createXRSession({ xr, overlay, onStart, onEnd, onError }) {
  let session, pending = false, disposed = false, generation = 0, endHandler;
  async function stop() {
    generation++; pending = false;
    const outgoing = session; session = undefined;
    if (!outgoing) return;
    outgoing.removeEventListener('end', endHandler);
    endHandler = undefined;
    try { await outgoing.end(); } catch { /* Already ended by the browser. */ }
    onEnd();
  }
  function start() {
    if (disposed || pending || session) return Promise.resolve();
    const token = ++generation; pending = true;
    let request;
    // Keep this call synchronous with the user's tap; do not await model loading.
    try { request = xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: overlay },
    }); } catch (error) { pending = false; onError(error); return Promise.resolve(); }
    return Promise.resolve(request).then(async incoming => {
      if (disposed || token !== generation) { await incoming.end(); return; }
      session = incoming;
      endHandler = () => queueMicrotask(() => {
        if (session !== incoming) return;
        incoming.removeEventListener('end', endHandler); endHandler = undefined;
        session = undefined; pending = false; generation++; onEnd();
      });
      incoming.addEventListener('end', endHandler);
      try {
        await onStart(incoming, () => !disposed && token === generation && session === incoming);
        if (session === incoming) pending = false;
      } catch (error) {
        if (session === incoming) { await stop(); onError(error); }
      }
    }).catch(error => { if (!disposed && token === generation) { pending = false; onError(error); } });
  }
  return { start, stop, get active() { return !!session || pending; },
    async dispose() { disposed = true; await stop(); } };
}
