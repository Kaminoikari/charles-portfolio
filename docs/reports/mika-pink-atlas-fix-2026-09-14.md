# Pink Mika 頭皮貼圖修復

根因是粉髮重繪 recipe 遺漏了 Face、Body atlas 中的原紫色頭皮與髮根。
`PINK_PASS_1` 只重繪六張 Hair atlas；`PINK_PASS_2` 對 Face、Body
整張套用皮膚的 hue／saturation／lightness 轉換，也把其中的紫色髮根提亮。

2026-09-14 查驗：

- 線上 `https://charles-chen.com/avatar/mika-pink.vrm` 與本機舊素材
  SHA-256 都是 `a757197ad394aa7f9edf5cd395b77f07db020514133e25a1babe2ce1bba1dfb1`。
- `git log -- public/avatar/mika-pink.vrm` 顯示該素材自 2026-08-30
  的 `8e4b9b5` 後未變更，後續骨架 pipeline 沒有改寫這份出貨素材。
- 真引擎 `scripts/avatar/live-preview.html?model=/avatar/mika-pink.vrm&mikadebug=1`
  可重現耳上紫色區塊及耳後、後頸紫線。暫時停用 Face／Body 材質的
  `map` 與 `shadeMultiplyTexture` 後，紫色區域消失，髮片與骨架保持原樣。
  此操作只用於診斷，沒有寫入 runtime。

修復採用 `mika-pink-2.vrm` 新 URL，配合 `/avatar/*` 的一年 immutable
快取。舊 `mika-pink.vrm` 與 Milfy pipeline 的 `baseline.vrm` 保留為原輸入。
Body atlas 也有紫色衣服印花，修復範圍必須限定在頭皮與髮根。

重建方式：

```sh
python3 scripts/repaint_vrm.py pink-repair public/avatar/mika-pink.vrm public/avatar/mika-pink-2.vrm
```

`pink` 完整重繪指令也會執行相同的修復步驟。此修復使用原髮色連通區辨認
頭皮與後頸髮根，以現有六張 Hair atlas 的 median RGB（217、166、174）
作為目標，並保留邊緣與皮膚的混色。遮罩外的 RGBA 逐像素保留。

驗證結果：

- `PYTHONPATH=scripts python3 -m unittest scripts/repaint_vrm_test.py -v`：
  9／9 PASS。涵蓋六個區域的紫色殘留與髮色匹配、皮膚／衣服／指甲／alpha
  保留、非目標 bufferViews 與骨架／表情不變、build 接線、出貨檔與重建結果一致。
- 修復前六個區域的紫色殘留斷言全部失敗；獨立 reviewer 再以原素材取代
  repair 結果，六區也全部失敗。
- `clearance.test.ts` 保留舊 `simulatedOn` 量測來源，改為核對新舊模型完整的
  非貼圖 binary 與 metadata。修改 POSITION、WEIGHTS_0 或 spring 設定都會
  被識別，避免素材改名後沿用不相容的量測。該檔 24／24 PASS。
- `npm run build` 通過。本機 production preview 的預設 Mika 讀取
  `/avatar/mika-pink-2.vrm`，10 支 motion clips 載入成功。瀏覽器下載、新素材及
  `dist/avatar/mika-pink-2.vrm` 的 SHA-256 均為
  `4c9f060dd52a722a5c83760224cde47c3ff5a1da5cc4354b344ebdb0cc0b5f1b`。
- 真引擎正面、左右側及後側視角已檢查，原紫色區塊及線條已轉成粉髮色。
  [修復前](mika-pink-atlas-before-2026-09-14.png)、
  [修復後](mika-pink-atlas-after-2026-09-14.png)、
  [對側](mika-pink-atlas-opposite-2026-09-14.png)、
  [後側](mika-pink-atlas-rear-2026-09-14.png)。截圖使用真引擎 preview，
  頁面的固定「Mika Milfy」標題未隨 `?model=` 改變，實際載入路徑如上。

兩位獨立 reviewer 對 repaint 修復、素材與 registry 接線均給出 PASS。
本次未重新執行完整 Milfy 建模 pipeline，也尚未部署至線上。

完整 TypeScript 測試最後採分批驗證，全部 1,636 個斷言通過，每批 exit code 0：

| 批次 | 通過數 |
| --- | ---: |
| 排除 `rigProbe.test.ts` 的其餘 31 個檔案 | 572 |
| `rigProbe` 一般測試及前四個 family | 344 |
| `rigProbe` 中間五個 family | 360 |
| `rigProbe` 最後五個 family | 360 |

分批的原因：單次 `npm test -- --maxWorkers=1` 雖有 1,636 個斷言通過，
仍因 `onTaskUpdate` RPC 逾時而 exit 1。已查本機 Vitest 的 RPC 期限為
60 秒，該次 `rigProbe` 同步掃描執行了 98 秒。下面分批覆蓋同一組測試，
各骨架批次的執行時間為 27、34、36 秒，沒有 worker error。未修改 runner
設定或斷言來壓掉錯誤。

```sh
npm test -- --maxWorkers=1 --exclude src/components/chat/rigProbe.test.ts
npm test -- --maxWorkers=1 src/components/chat/rigProbe.test.ts -t '^(?!bundled motions)|bundled motions on .(vroid-sample-b|vrm1-twist-sample|vroid-studio-dressup|vroid-hair-female).'
npm test -- --maxWorkers=1 src/components/chat/rigProbe.test.ts -t 'bundled motions on .(vroid-hair-male|vroid-sendagaya-shibu|vroid-victoria-rubin|vroid-vivi|vroid-sample-a).'
npm test -- --maxWorkers=1 src/components/chat/rigProbe.test.ts -t 'bundled motions on .(vroid-sample-c|vroid-darkness-shibu|vroid-sakurada-fumiriya|vroid-sendagaya-shino|vroid-vita).'
```
