# AR 合照第一版

入口：主畫面右上角的 AR 圖示，或問號說明中的「AR 合照」。獨立頁面為 `ar.html?tree=gj-2026`。

## 範圍

- 使用後鏡頭，在系統 AR 中偵測水平面、放置、縮放及轉向。
- iPhone／iPad：保留 Safari 的 AR Quick Look（USDZ），不更動已在 iPhone 成功的啟動方式。
- Android：先檢查 Chrome 的 WebXR `immersive-ar` 支援；可用時優先在瀏覽器內啟動真正的 3D 空間 AR，要求 hit-test 與 DOM overlay。相機由 WebXR 系統呈現，以水平面命中姿態放置原模型，移動手機時物件保持在參考空間座標；雙指／滑桿只改大小。這不是把 3D 樹疊在一般 video 上。
- 瀏覽器空間 AR 未提供時，保留 Google 應用程式的 Scene Viewer 1.2（GLB、ar_preferred）入口；仍需可用的 Android AR 服務。S22 型號支援 ARCore，不等於能由雲端確認該台手機的服務、權限或外部 App 狀態。
- iPhone／系統檢視器合照由系統拍攝或手機截圖保存。Chrome WebXR 使用手機截圖；可隱藏工具取景。WebXR 相機影像由系統合成，不假設能從普通 canvas 讀回相機，不提供會缺少背景的網頁快門。
- AR 資產只有原版樹、裝飾、燈串、星星與 GJ 底座；無薑餅人、禮物、粒子、下雪、音樂、自轉或手勢辨識。
- 不支援的桌機顯示 3D 作品及分享入口；iOS 不支援的瀏覽器提醒改用 Safari；Android 啟動失敗回到本頁，或停留網頁超過三秒，顯示替代入口及 Google／AR 服務更新連結；從系統返回也提供排解。系統可能先開啟 3D 預覽，需選擇 AR／「在你的空間中查看」才是實景；網頁不能判定外部檢視器是否已成功追蹤平面。

## 檔案與建置

- `src/ar/model.js`：呼叫既有 `createTree()`，另建靜態 AR 模型；PBR 材質、暖燈與水平面原點，初始高度 1.65 公尺。不改主網站場景。
- `scripts/build-ar-assets.js`：沿用 Three.js 的 GLTFExporter／USDZExporter，產出 `public/ar/models/gj-2026.glb` 與 `.usdz`。`npm run dev`、`npm run build` 均會先產生，也可執行 `npm run build:ar`。不新增套件。
- `src/ar/catalog.js`：作品清單，包含 id、標題、作者、班級、祝福、GLB、USDZ 與初始尺寸。
- `src/ar/launch.js`：裝置分流、系統 AR 啟動網址、分享網址及 Android 回退頁面。`launch-feedback.js` 處理未交接及返回時的提示，不宣稱外部 AR 已成功啟動。Android 入口參照 Google model-viewer 的 Scene Viewer 啟動方式：https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts 。
- `src/ar/webxr-tree.js`：Android 的瀏覽器空間 AR、平面圓環、原模型放置、縮放、重新放置、隱藏工具與結束資源回收。`xr-session.js` 保留使用者點擊當下的 requestSession，處理取消／遲到授權／初始化失敗；`xr-placement.js` 處理水平命中及固定世界位置。
- `src/ar/preview.js`：按需繪製的靜態模型預覽；不開啟相機、音訊或辨識模型。離頁釋放模型及 GPU 資源，返回時重建。
- `ar.html`、`src/ar/main.js`、`src/ar/style.css`：獨立作品頁；Vite 設定同時建置首頁與 AR 頁，沿用 GitHub Pages 子路徑。

## 後續學生作品

每件作品需一組 GLB／USDZ 與固定 id；在 catalog 登錄後，以 `ar.html?tree=作品id` 分享。班級作品選單、學生編輯器、上傳儲存、審核及後端尚未實作。未知 id 顯示找不到作品，避免錯誤呈現其他學生的樹。

目前建置腳本只輸出格致原版樹；新增作品須另提供對應資產，不會僅新增清單就自動生成。

## 驗證

自動檢查：模型高度與落地、GJ 字樣、材質與純靜態內容、裝置分流、網址及子路徑、Android 回退、不同作品 id、手機版 UI、WebXR 點擊授權／會話回收／水平姿態與世界位置。虛擬會話可驗證邏輯，不能驗證實體相機追蹤。

Android 說明加入 Google model-viewer 的 Astronaut 遠端示範模型測試（只有觀看者主動點擊才開啟），保留同一個作品頁回退。若示範也無法開啟，優先排查系統服務／啟動；若示範成功而樹失敗，再排查 GLB 與下載。這是對照測試，不自動判定原因。

先前的畫面合成試作已移除；首頁邀請動畫與原樹美術不變。未新增套件。

實機驗收：iPhone Safari／ARCore Android Chrome 分別測試平面偵測、放置、移動手機後錨定、縮放轉向、人物站旁合照及返回原網站。雲端瀏覽器只能驗證系統 AR 入口、資產與回退，不能驗證真實空間追蹤或系統拍照。
