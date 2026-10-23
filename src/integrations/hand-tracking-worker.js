import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let detector;
let loaded = 0;
async function download(url, label) {
  const response = await fetch(url);
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`${label}下載失敗，請重新整理後再試。`);
  const reader = response.body.getReader();
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); length += value.length; loaded += value.length;
    self.postMessage({ type: 'progress', phase: 'download', loaded, label });
  }
  const data = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  // Some hosts transparently decode gzip; never decompress a second time.
  if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      loaded = 0;
      const [wasm, model] = await Promise.all([
        download(`${data.assetBase}vision_wasm_module_internal.wasm.gz`, '辨識引擎'),
        download(`${data.assetBase}hand_landmarker-fbc2a300.task.gz`, '手部模型'),
      ]);
      if (wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109 || model.length < 1000000) {
        throw new Error('手勢資源不完整，請重新整理後再試。');
      }
      self.postMessage({ type: 'progress', phase: 'initialize', loaded });
      const files = await FilesetResolver.forVisionTasks(data.assetBase, true);
      const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
      files.wasmBinaryPath = wasmUrl;
      try {
        detector = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .5 });
      } finally { URL.revokeObjectURL(wasmUrl); }
      self.postMessage({ type: 'ready', id: data.id });
    } else if (data.type === 'frame') {
      try {
        const result = detector.detectForVideo(data.bitmap, data.time);
        self.postMessage({ type: 'result', id: data.id, landmarks: result.landmarks[0] ?? null });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error.message || '背景手勢辨識無法啟動。' });
  }
};
