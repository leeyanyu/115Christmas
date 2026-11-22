/** 格致聖誕森林：圖片收件服務。先執行一次 setupForest，再部署為網頁應用程式。 */
const FOREST_HEADERS = ['id', 'editHash', 'title', 'author', 'blessing', 'imageFileId', 'createdAt', 'updatedAt', 'status', 'lastRequestId'];
const FOREST_MAX_IMAGE_BYTES = 180000;
const FOREST_MAX_WORKS = 2000;

function setupForest() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('FOREST_SHEET_ID'), folderId = props.getProperty('FOREST_FOLDER_ID');
  if (!sheetId) { const book = SpreadsheetApp.create('格致聖誕森林｜作品清單'); sheetId = book.getId(); props.setProperty('FOREST_SHEET_ID', sheetId); }
  if (!folderId) { const folder = DriveApp.createFolder('格致聖誕森林｜作品圖片'); folderId = folder.getId(); props.setProperty('FOREST_FOLDER_ID', folderId); }
  const book = SpreadsheetApp.openById(sheetId); let sheet = book.getSheetByName('Trees');
  if (!sheet) { sheet = book.getSheets()[0]; sheet.setName('Trees'); }
  if (sheet.getLastRow() === 0) sheet.appendRow(FOREST_HEADERS);
  if (sheet.getMaxRows() < FOREST_MAX_WORKS + 1) sheet.insertRowsAfter(sheet.getMaxRows(), FOREST_MAX_WORKS + 1 - sheet.getMaxRows());
  sheet.getRange(2, 1, FOREST_MAX_WORKS, FOREST_HEADERS.length).setNumberFormat('@');
  sheet.setFrozenRows(1); sheet.getRange(1, 1, 1, FOREST_HEADERS.length).setFontWeight('bold').setBackground('#d8c18e');
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(['published', 'hidden'], true).setAllowInvalid(false).build();
  sheet.getRange(2, 9, FOREST_MAX_WORKS, 1).setDataValidation(rule);
  console.log('作品清單：' + book.getUrl()); console.log('圖片資料夾：' + DriveApp.getFolderById(folderId).getUrl());
  console.log('設定完成。請部署為「網頁應用程式」，執行身分：我；存取權：任何人。');
}

function forestSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOREST_SHEET_ID');
  if (!id) throw new Error('請先由管理者執行 setupForest。');
  const sheet = SpreadsheetApp.openById(id).getSheetByName('Trees');
  if (!sheet) throw new Error('找不到 Trees 工作表，請重新執行 setupForest。');
  return sheet;
}
function forestRows_() {
  const sheet = forestSheet_(), count = sheet.getLastRow();
  return count < 2 ? [] : sheet.getRange(2, 1, count - 1, FOREST_HEADERS.length).getValues();
}
function forestText_(value, limit) { return String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, limit); }
function forestCell_(value) { return /^[=+\-@]/.test(value) ? "'" + value : value; }
function forestID_(value) { return typeof value === 'string' && /^[\w-]{16,80}$/.test(value); }
function forestHash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join(''); }
function forestCacheGet_(key) { try { return CacheService.getScriptCache().get(key); } catch (error) { return null; } }
function forestCachePut_(key, value, seconds) { try { CacheService.getScriptCache().put(key, value, seconds); } catch (error) { console.warn('快取暫時不可用，仍保留正式資料。'); } }
function forestJSON_(data, callback) {
  const json = JSON.stringify(data).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (callback && !/^__gjForest_[A-Za-z0-9_]{8,80}$/.test(callback)) throw new Error('無效的讀取請求。');
  return ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
function forestPublic_(row) { return { id: row[0], title: row[2], author: row[3], blessing: row[4], createdAt: String(row[6]), updatedAt: String(row[7]) }; }
function forestPublished_(row) { return row[8] === 'published'; }
function forestReadImage_(row) {
  const key = 'image_' + forestHash_(row[0] + ':' + row[7]);
  const cached = forestCacheGet_(key); if (cached) return cached;
  const blob = DriveApp.getFileById(row[5]).getBlob();
  const data = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (data.length < 80000) forestCachePut_(key, data, 600);
  return data;
}

function doGet(e) {
  const p = e && e.parameter || {};
  try {
    if (p.action === 'health') { forestSheet_(); return forestJSON_({ ok: true, service: 'gj-forest-images-v1' }, p.callback); }
    if (!p.action) return forestJSON_({ ok: true, service: 'gj-forest-images-v1', message: '聖誕森林收件服務。網站端設定此部署的 /exec 網址即可連接。' }, p.callback);
    if (p.action === 'receipt') {
      if (!forestID_(p.id) || !forestID_(p.requestId)) throw new Error('無效的收件查詢。');
      const cached = forestCacheGet_('receipt_' + p.requestId);
      if (cached) { const receipt = JSON.parse(cached); if (receipt.id === p.id) return forestJSON_(receipt, p.callback); }
      const row = forestRows_().find(r => r[0] === p.id && r[9] === p.requestId);
      return forestJSON_(row ? { ok: true, id: row[0], requestId: row[9], updatedAt: String(row[7]), visible: forestPublished_(row) } : { ok: false, pending: true }, p.callback);
    }
    const rows = forestRows_().filter(forestPublished_).sort((a, b) => String(b[6]).localeCompare(String(a[6])) || String(a[0]).localeCompare(String(b[0])));
    if (p.action === 'list') {
      let cursor = Math.max(0, Math.min(rows.length, Math.floor(Number(p.cursor) || 0))); const limit = Math.max(1, Math.min(24, Math.floor(Number(p.limit) || 24)));
      if (cursor === 0 && forestID_(p.focusId)) { const index = rows.findIndex(row => row[0] === p.focusId); if (index >= 0) cursor = Math.floor(index / limit) * limit; }
      return forestJSON_({ ok: true, items: rows.slice(cursor, cursor + limit).map(forestPublic_), total: rows.length, cursor, previousCursor: cursor > 0 ? Math.max(0, cursor - limit) : null, nextCursor: cursor + limit < rows.length ? cursor + limit : null }, p.callback);
    }
    if (p.action === 'images') {
      const ids = String(p.ids || '').split(','); if (!ids.length || ids.length > 6 || !ids.every(forestID_)) throw new Error('一次最多讀取六棵樹。');
      const images = {};
      for (const row of rows) if (ids.indexOf(row[0]) !== -1) { try { images[row[0]] = forestReadImage_(row); } catch (error) { console.warn('圖片暫時無法讀取：' + row[0]); } }
      return forestJSON_({ ok: true, images }, p.callback);
    }
    throw new Error('不支援的讀取方式。');
  } catch (error) { return forestJSON_({ ok: false, message: error.message || '森林服務暫時無法使用。' }, /^__gjForest_[A-Za-z0-9_]{8,80}$/.test(p.callback || '') ? p.callback : ''); }
}

function forestImage_(value) {
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ''));
  if (!match || match[2].length > Math.ceil(FOREST_MAX_IMAGE_BYTES / 3) * 4) throw new Error('作品圖片格式或大小不符。');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > FOREST_MAX_IMAGE_BYTES) throw new Error('作品圖片太大，請縮小後再送出。');
  const b = i => (bytes[i] + 256) % 256;
  const png = bytes.length > 8 && [137,80,78,71,13,10,26,10].every((n, i) => b(i) === n);
  const webp = bytes.length > 12 && [82,73,70,70].every((n, i) => b(i) === n) && [87,69,66,80].every((n, i) => b(i + 8) === n);
  if (!(match[1] === 'png' && png || match[1] === 'webp' && webp)) throw new Error('圖片內容與檔案格式不符。');
  return { bytes, mime: 'image/' + match[1], extension: match[1] };
}

function doPost(e) {
  const p = e && e.parameter || {}; let lock, file, written = false;
  try {
    if (p.action !== 'submit' || !forestID_(p.id) || !forestID_(p.requestId) || !forestID_(p.token)) throw new Error('無效的作品送出請求。');
    const cached = forestCacheGet_('receipt_' + p.requestId);
    if (cached && JSON.parse(cached).id === p.id) return forestJSON_(JSON.parse(cached));
    const image = forestImage_(p.imageData), hash = forestHash_(p.token);
    lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) throw new Error('目前投稿較多，請稍後重試。');
    const sheet = forestSheet_(), rows = forestRows_(), index = rows.findIndex(row => row[0] === p.id), old = index >= 0 ? rows[index] : null;
    if (old && old[1] !== hash) throw new Error('無法更新這份作品，請使用原本創作的瀏覽器。');
    if (!old && rows.length >= FOREST_MAX_WORKS) throw new Error('森林目前已額滿，請聯絡活動管理者。');
    const folderId = PropertiesService.getScriptProperties().getProperty('FOREST_FOLDER_ID');
    if (!folderId) throw new Error('請先由管理者執行 setupForest。');
    file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(image.bytes, image.mime, p.id + '-' + Date.now() + '.' + image.extension));
    const now = new Date().toISOString(), status = old ? old[8] : 'published';
    const row = [p.id, hash, forestCell_(forestText_(p.title, 28) || '我的聖誕樹'), forestCell_(forestText_(p.author, 16)), forestCell_(forestText_(p.blessing, 90)), file.getId(), old ? old[6] : now, now, status, p.requestId];
    sheet.getRange(index >= 0 ? index + 2 : rows.length + 2, 1, 1, FOREST_HEADERS.length).setValues([row]);
    written = true;
    SpreadsheetApp.flush();
    const receipt = { ok: true, id: p.id, requestId: p.requestId, updatedAt: now, visible: status === 'published' };
    forestCachePut_('receipt_' + p.requestId, JSON.stringify(receipt), 600);
    if (old && old[5] && old[5] !== file.getId()) { try { DriveApp.getFileById(old[5]).setTrashed(true); } catch (error) { console.warn('舊圖片留待管理者整理。'); } }
    file = null; return forestJSON_(receipt);
  } catch (error) {
    if (file && !written) { try { file.setTrashed(true); } catch (ignored) {} }
    const receipt = { ok: false, id: p.id, requestId: p.requestId, message: error.message || '作品未能儲存，請稍後重試。' };
    if (forestID_(p.requestId)) forestCachePut_('receipt_' + p.requestId, JSON.stringify(receipt), 180);
    return forestJSON_(receipt);
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
