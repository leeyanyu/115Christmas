const runtimeBase = `${import.meta.env.BASE_URL}hand-tracking/0.4.1675469240/`;
let loading;

function loadRuntime() {
  if (window.Hands) return Promise.resolve();
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${runtimeBase}hands.js`;
    script.onload = resolve;
    script.onerror = () => { script.remove(); loading = null; reject(new Error('無法載入手勢辨識，請檢查網路後重試。')); };
    document.head.append(script);
  });
  return loading;
}

export async function createHandDetector() {
  await loadRuntime();
  const hands = new window.Hands({ locateFile: file => `${runtimeBase}${file}` });
  let result = null;
  hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .65, minTrackingConfidence: .65, selfieMode: false });
  hands.onResults(value => { result = value.multiHandLandmarks?.[0] ?? null; });
  try { await hands.initialize(); }
  catch (error) { await hands.close(); throw error; }
  return {
    async detect(video) { result = null; await hands.send({ image: video }); return result; },
    close: () => hands.close(),
  };
}
