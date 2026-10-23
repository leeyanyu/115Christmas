# AR 合照第一版

入口：主畫面右上角的 AR 圖示，或問號說明中的「AR 合照」。獨立頁面為 `ar.html?tree=gj-2026`。

## 範圍

- 使用後鏡頭，在系統 AR 中偵測水平面、放置、縮放及轉向。
- iPhone／iPad：Safari 的 AR Quick Look（USDZ）。Android：Scene Viewer（GLB），需支援 ARCore 並安裝 Google Play Services for AR。兩者是否支援及拍攝介面以實機為準。
- 合照由系統 AR 的拍攝功能或手機截圖保存。網站沒有自製快門、相簿，也不接收影像。
- AR 資產只有原版樹、裝飾、燈串、星星與 GJ 底座；無薑餅人、禮物、粒子、下雪、音樂、自轉或手勢辨識。
- 不支援的桌機顯示 3D 作品及分享入口；iOS 不支援的瀏覽器提醒改用 Safari；Android 啟動失敗回到本頁顯示支援條件，不假裝已進入 AR。

## 檔案與建置

- `src/ar/model.js`：呼叫既有 `createTree()`，另建靜態 AR 模型；PBR 材質、暖燈與水平面原點，初始高度 1.65 公尺。不改主網站場景。
- `scripts/build-ar-assets.js`：沿用 Three.js 的 GLTFExporter／USDZExporter，產出 `public/ar/models/gj-2026.glb` 與 `.usdz`。`npm run dev`、`npm run build` 均會先產生，也可執行 `npm run build:ar`。不新增套件。
- `src/ar/catalog.js`：作品清單，包含 id、標題、作者、班級、祝福、GLB、USDZ 與初始尺寸。
- `src/ar/launch.js`：裝置分流、系統 AR 啟動網址、分享網址及 Android 回退頁面。
- `src/ar/preview.js`：按需繪製的靜態模型預覽；不開啟相機、音訊或辨識模型。離頁釋放模型及 GPU 資源，返回時重建。
- `ar.html`、`src/ar/main.js`、`src/ar/style.css`：獨立作品頁；Vite 設定同時建置首頁與 AR 頁，沿用 GitHub Pages 子路徑。

## 後續學生作品

每件作品需一組 GLB／USDZ 與固定 id；在 catalog 登錄後，以 `ar.html?tree=作品id` 分享。班級作品選單、學生編輯器、上傳儲存、審核及後端尚未實作。未知 id 顯示找不到作品，避免錯誤呈現其他學生的樹。

目前建置腳本只輸出格致原版樹；新增作品須另提供對應資產，不會僅新增清單就自動生成。

## 驗證

自動檢查：模型高度與落地、GJ 字樣、材質與純靜態內容、裝置分流、網址及子路徑、Android 回退、不同作品 id、手機版 UI 與無相機權限請求。

實機驗收：iPhone Safari／ARCore Android Chrome 分別測試平面偵測、放置、移動手機後錨定、縮放轉向、人物站旁合照及返回原網站。雲端瀏覽器只能驗證系統 AR 入口、資產與回退，不能驗證真實空間追蹤或系統拍照。
