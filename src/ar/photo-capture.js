import { coverCrop, photoDimensions } from './photo-layout.js';

export async function capturePhoto(video, overlay, rect, createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  const size = photoDimensions(video.videoWidth, video.videoHeight, rect.width, rect.height);
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('此瀏覽器暫時無法產生合照，請使用 Chrome 或 Safari。');
  const crop = coverCrop(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
  context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  overlay.drawOn(context, canvas.width, canvas.height);
  try {
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob)
      : reject(new Error('照片未能儲存，請重試。')), 'image/jpeg', .94));
  } finally { canvas.width = 1; canvas.height = 1; }
}
