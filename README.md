# GJ Christmas 2026

格致中學 2026 年 12 月 18 日聖誕活動的 Three.js 互動邀請卡原型。

## 開發

需要 Node.js 22.12+（或 20.19+）與 npm。本次環境使用 Node.js 24。

```sh
cd /workspace/115Christmas
npm ci
npm run dev
```

本機開啟終端顯示的開發網址；同一區域網路的手機可使用電腦 IP 搭配 5173 埠測試（需允許防火牆）。雲端環境的預覽方式依平台支援而定。

```sh
npm run build
npm run preview
```

正式部署使用 `dist/`。不需要資料庫、登入、API 金鑰或環境變數。Google Fonts 僅用於可選字型，無法連線時使用系統字型。

## GitHub Pages

`vite.config.js` 已設定 `/115Christmas/` 路徑。到 GitHub 儲存庫的 Settings → Pages，將 Source 設為 **GitHub Actions**。推送至 `main` 或手動執行 Actions 中的 Deploy Christmas invitation to GitHub Pages，即會建置並部署。

預期網址：`https://leeyanyu.github.io/115Christmas/`。請以 Actions 成功結果與實際 HTTP 回應確認部署完成。儲存庫若為私人，Pages 可用性取決於 GitHub 方案；部署網站可能對外公開。

## 結構

```text
index.html                  邀請卡內容、按鈕與無障礙狀態訊息
src/main.js                 UI 與場景生命週期
src/style.css               桌面 / 手機排版
src/scene/world.js          渲染器、相機、觸控控制、尺寸與動畫迴圈
src/scene/tree.js           立體枝葉、裝飾球、燈串、星星及底座
src/scene/awakening.js      10.5 秒依序點亮與上升光點
src/integrations/content.js 內容群組；預留照片、GLTF 與 AR 錨點整合
```

AR 尚未實作。未來可由 MindAR adapter 管理相機 / renderer，將內容群組掛入辨識錨點；不需把 AR 邏輯塞進樹木模型。照片及模型亦可新增獨立 loader 模組後掛入內容群組。

## 手動驗收

1. 使用支援 WebGL 2 的手機或桌面瀏覽器開啟，確認深藍場景、立體樹及金色裝飾；開場自動播放彩帶匯聚，樹木接著由底向上彈性展開。
2. 滑鼠 / 單指水平拖曳，確認可以從不同角度觀看，手機仍可垂直捲動。聚焦畫布後亦可按左右方向鍵。
3. 開場結束後按「再次喚醒聖誕樹」，確認按鈕停用避免重複啟動，燈串由下向上點亮，金色光點螺旋上升，約 10.5 秒後出現 `Light Up Christmas 2026`。
4. 旋轉手機或調整視窗，確認畫面比例與操作正常。按鈕或重新整理皆可重播。

像素比例上限 1.75，背景粒子 55 顆、甦醒光點 64 顆，沒有陰影貼圖或後製 Bloom。尊重減少動態效果偏好，停用背景漂移並降低光點亮度；主要點亮動畫保留。未提供 WebGL 2 時顯示操作提示。

## 第二版視覺

樹木改用約 7,560 根實例化針葉與枝條，取代大型低面數錐體。開啟時自動播放約 10.5 秒序列：鏡頭周圍 16 條金、薄荷綠與淡粉發光彩帶朝樹的位置匯聚，再由底往上展開枝葉，各層以阻尼彈簧曲線回彈。完成後按鈕可重播。減少動態效果模式略過彩帶並使用平順展開。

## 流光開場

彩帶依參考圖改為全螢幕冰藍光流：白青核心、六條平行細絲、寬柔光暈及沿線流動亮點，以曲線透視向遠處匯聚。前 5 秒為流光匯入，約 3.8 秒起接續樹木彈性展開，總長約 10.5 秒。光暈由自訂 shader 在帶狀幾何內繪製，不使用 Bloom。開場獨立 renderer 的像素比例上限 1.25，結束後停止渲染並隱藏；減少動態偏好會略過光流。
