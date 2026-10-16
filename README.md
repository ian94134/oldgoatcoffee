# oldgoatcoffee

網站以實體靜態 HTML 發布到 GitHub Pages。首頁、菜單、包場、關於與聯絡各有可直接存取的網址；不需 React 或外部 JavaScript 就能閱讀與導覽。舊的 `#menu` 等連結仍可使用。

## 維護與建置

- `src/template.html`：優化前的完整原始頁面，保留原有文案、價格、菜單資料與照片來源。
- `scripts/build.mjs`：將原始模板的既有資料轉成五頁靜態 HTML，產生各頁 metadata、Menu 結構化資料、sitemap 與共用 CSS。
- `src/site.js`：輪播、評論展開、舊網址轉址與台灣日期標記的漸進增強。
- `assets/optimized/manifest.json`：原圖與 WebP／響應式尺寸的映射；原始照片保留。
- `assets/fonts/`：依各頁實際字元擷取的 Noto Sans TC / Noto Serif TC 可變字型，保留原字重與 OFL 授權。正常重建會重用已有字型；新增文字時會從 Google Fonts 取得新的字元子集。

```sh
npm ci
npm run build
npm start
```

預覽網址為 `http://127.0.0.1:4173/oldgoatcoffee/`。修改文案資料時仍應在原始模板維護，再重建產物；不要直接編輯產出的 HTML。

新增或替換原始圖片後，先安裝 Python Pillow，再執行：

```sh
python scripts/optimize-images.py
npm run build
```

## 驗證

啟動預覽後，在另一個終端機執行 `npm test`（需本機安裝 Chrome）。測試會渲染保留的原始模板，逐頁比對桌機與手機的可見文字、標題與描述，並檢查圖片、內部連結、無 JavaScript 閱讀、輪播、評論展開與舊連結。

Lighthouse 可分別對 `/baseline/` 與 `/oldgoatcoffee/` 執行相同條件的行動版測試。本機數值不是正式環境的流量或排名保證；Pages 的快取、壓縮與網路條件會影響實測結果。

## GitHub Pages

產物已直接放在根目錄與 `menu/`、`rental/`、`about/`、`contact/`，可由 `main` 根目錄發布，無需在正式環境安裝 Node。`.nojekyll` 避免 Jekyll 處理來源。

`sitemap.xml` 列出五個實體網址；發布後可在 Google Search Console 提交。專案目錄內的 `robots.txt` 無法控制整個 `ian94134.github.io` 網域的爬蟲規則，該規則需位在網域根目錄。
