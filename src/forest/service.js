export const MAX_FOREST_IMAGE_BYTES = 180000;
export const FOREST_OWNER_KEY = 'gj-christmas-forest-owner-v1';
export const FOREST_PREVIEW_KEY = 'gj-christmas-forest-preview-v1';

export function validForestEndpoint(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'script.google.com' && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash; }
  catch { return false; }
}
export function validForestImage(value) {
  if (typeof value !== 'string') return false;
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return !!match && match[2].length <= Math.ceil(MAX_FOREST_IMAGE_BYTES / 3) * 4;
}
const abortError = () => new DOMException('已取消送出', 'AbortError');
export function jsonp(endpoint, parameters, { signal, timeout = 18000, document: doc = document, window: view = window } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const callback = '__gjForest_' + crypto.randomUUID().replaceAll('-', '');
    const url = new URL(endpoint); Object.entries({ ...parameters, callback }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const script = doc.createElement('script'); let timer;
    function cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', cancel); script.remove(); delete view[callback]; }
    function cancel() { cleanup(); reject(abortError()); }
    view[callback] = value => { cleanup(); resolve(value); };
    script.onerror = () => { cleanup(); reject(new Error('森林連線未完成，請稍後重試。')); };
    script.src = url.href; script.referrerPolicy = 'no-referrer';
    timer = setTimeout(() => { cleanup(); reject(new Error('森林回應較慢，請稍後重試。')); }, timeout);
    signal?.addEventListener('abort', cancel, { once: true }); doc.head.append(script);
  });
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const cancel = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
const read = (storage, key) => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

export function createForestService({ endpoint = '', storage, request = jsonp, post = fetch, uuid = () => crypto.randomUUID(), wait = pause } = {}) {
  const configured = validForestEndpoint(endpoint), images = new Map();
  let owner = read(storage, FOREST_OWNER_KEY), pending, localPreview = read(storage, FOREST_PREVIEW_KEY);
  if (!owner || !/^[\w-]{16,64}$/.test(owner.id || '') || !/^[\w-]{16,80}$/.test(owner.token || '')) owner = { id: uuid(), token: uuid() };
  write(storage, FOREST_OWNER_KEY, owner);
  function cacheImage(id, value) { images.delete(id); images.set(id, value); if (images.size > 72) images.delete(images.keys().next().value); }
  function checked(value) { if (!value?.ok) throw new Error(value?.message || '森林服務尚未準備好，作品已保留。'); return value; }
  return {
    configured,
    get ownId() { return owner.id; },
    get preview() { return localPreview && validForestImage(localPreview.imageData) ? localPreview : null; },
    previewDesign(design, imageData) {
      if (!validForestImage(imageData)) throw new Error('作品圖片未能準備完成，請再試一次。');
      const item = { id: owner.id, title: design.title, author: design.engraving, blessing: design.blessing, imageData, updatedAt: new Date().toISOString(), local: true };
      localPreview = item; write(storage, FOREST_PREVIEW_KEY, item); cacheImage(item.id, { version: item.updatedAt, imageData }); return item;
    },
    async list(cursor = 0, signal, focusId = '') {
      if (!configured) return { ok: true, items: this.preview ? [this.preview] : [], total: this.preview ? 1 : 0, nextCursor: null, local: true };
      const result = checked(await request(endpoint, { action: 'list', cursor, limit: 24, focusId }, { signal }));
      if (!Array.isArray(result.items)) throw new Error('森林作品清單不完整，請重新載入。');
      return result;
    },
    async loadImages(items, signal) {
      const result = new Map(), missing = [];
      for (const item of items) {
        const cached = images.get(item.id);
        if (validForestImage(item.imageData)) result.set(item.id, item.imageData);
        else if (cached?.version === item.updatedAt) result.set(item.id, cached.imageData);
        else missing.push(item);
      }
      for (let start = 0; start < missing.length; start += 6) {
        const batch = missing.slice(start, start + 6);
        const response = checked(await request(endpoint, { action: 'images', ids: batch.map(item => item.id).join(',') }, { signal }));
        for (const item of batch) {
          const imageData = response.images?.[item.id];
          if (!validForestImage(imageData)) continue;
          cacheImage(item.id, { version: item.updatedAt, imageData }); result.set(item.id, imageData);
        }
      }
      return result;
    },
    async submit(design, imageData, signal) {
      if (!configured) throw new Error('尚未連接共同收件服務，目前只能預覽自己的作品。');
      if (!validForestImage(imageData)) throw new Error('作品圖片太大或未完成，請再試一次。');
      if (pending) return pending;
      pending = (async () => {
        const requestId = uuid();
        const body = new URLSearchParams({ action: 'submit', id: owner.id, token: owner.token, requestId, imageData,
          title: design.title, author: design.engraving, blessing: design.blessing });
        // A no-cors POST is opaque. Only the server's matching receipt confirms
        // that Drive AND the spreadsheet were actually updated successfully.
        try { await post(endpoint, { method: 'POST', mode: 'no-cors', credentials: 'omit', body, signal }); }
        catch (error) { if (error.name === 'AbortError') throw error; /* A redirect may fail after the write: check the receipt. */ }
        for (let attempt = 0; attempt < 18; attempt++) {
          if (signal?.aborted) throw abortError();
          const receipt = await request(endpoint, { action: 'receipt', id: owner.id, requestId }, { signal });
          if (receipt?.ok && receipt.requestId === requestId && receipt.id === owner.id) {
            const item = this.previewDesign(design, imageData); item.local = false; item.updatedAt = receipt.updatedAt;
            cacheImage(item.id, { version: receipt.updatedAt, imageData });
            return { ...receipt, item };
          }
          if (receipt?.pending !== true) checked(receipt);
          await wait(1500, signal);
        }
        throw new Error('還沒收到 Google 的收件確認，作品仍保留；請稍後重試，重試不會新增重複的樹。');
      })();
      try { return await pending; } finally { pending = undefined; }
    },
  };
}
