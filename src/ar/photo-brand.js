export const CHRISTMAS_BRAND = { title: 'Light up Christmas', school: 'Ger-Jyh' };

export function photoDimensions(width, height, maxEdge = 2560) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('照片尺寸無法讀取，請換一張照片。');
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export function drawPhotoBrand(context, width, height, position = 'bottom') {
  const unit = Math.min(width, height), margin = unit * .065, small = unit * .035;
  let large = unit * .095;
  context.save(); context.textAlign = 'center'; context.textBaseline = 'alphabetic';
  context.font = `400 ${large}px Georgia, "Times New Roman", serif`;
  const measured = context.measureText(CHRISTMAS_BRAND.title).width;
  if (measured > width * .88) large *= width * .88 / measured;
  context.font = `400 ${large}px Georgia, "Times New Roman", serif`;
  const top = position === 'top', titleY = top ? margin + large : height - margin - small * 1.9;
  const schoolY = top ? titleY + small * 1.9 : height - margin;
  const depth = margin * 2 + large + small * 2;
  const gradient = context.createLinearGradient(0, top ? depth : height - depth, 0, top ? 0 : height);
  gradient.addColorStop(0, 'rgba(4,16,24,0)'); gradient.addColorStop(1, 'rgba(4,16,24,.52)');
  context.fillStyle = gradient; context.fillRect(0, top ? 0 : height - depth, width, depth);
  context.shadowColor = 'rgba(0,8,16,.8)'; context.shadowBlur = unit * .012; context.shadowOffsetY = unit * .002;
  context.lineWidth = Math.max(1, large * .018); context.strokeStyle = 'rgba(5,18,26,.6)';
  context.strokeText(CHRISTMAS_BRAND.title, width / 2, titleY);
  context.fillStyle = '#fff5db'; context.fillText(CHRISTMAS_BRAND.title, width / 2, titleY);
  context.font = `500 ${small}px Arial, sans-serif`; context.fillStyle = '#ead3a0';
  const letters = [...CHRISTMAS_BRAND.school], spacing = small * .16;
  const widths = letters.map(letter => context.measureText(letter).width);
  let x = (width - widths.reduce((sum, value) => sum + value, 0) - spacing * (letters.length - 1)) / 2;
  context.textAlign = 'left';
  letters.forEach((letter, index) => { context.fillText(letter, x, schoolY); x += widths[index] + spacing; });
  context.restore();
}

export async function renderBrandedPhoto(image, canvas, position = 'bottom') {
  const size = photoDimensions(image.naturalWidth, image.naturalHeight);
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('這台瀏覽器暫時無法製作合照。');
  context.drawImage(image, 0, 0, size.width, size.height);
  drawPhotoBrand(context, size.width, size.height, position);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('合照未能產生，請再試一次。')), 'image/jpeg', .94));
}
