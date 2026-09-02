# 瀏覽器色彩實測（2026-09-02 08:09）

工具：colorprobe.html（repo 根目錄的臨時檔，用完即刪）。
- 由 Vite dev server (localhost:5173) 載入 public/avatar/mika-milfy.vrm，
  頁內驗過 sha 前 16 碼 = 95b79fd3910eb98a，與 gate 起訖一致。
- 算圖設定逐項照抄 avatarGuideEngine.ts:400-449：ACESFilmicToneMapping、
  toneMappingExposure 1.25、AmbientLight(0xffffff, 1.1)、
  key DirectionalLight(0xffffff, 1.4)、cyan fill DirectionalLight(0x00d9ff, 0.3)。
- 取樣：全景 render 一張；每個目標材質再 render 一張深度正確的遮罩
  （目標畫白、其餘畫黑、全部可見，被衣服蓋住的皮膚在遮罩裡是黑的），
  遮罩向內侵蝕 2px 避開 MToon 描邊，然後取全景在遮罩內像素的逐通道中位數。
- 第一版遮罩（只顯示目標材質）會把被外套蓋住的軀幹當成皮膚取樣，已改掉。

實測（median RGB）：
  髮 F00_000_Hair_00_HAIR_01   6800 px  (207,206,195)
  膚 F00_000_00_Body_00_SKIN  26737 px  (215,203,196)
  瞳 F00_000_00_EyeIris_00_EYE    0 px  全身構圖太小，侵蝕後無樣本
  外套 Mellow_Outer           61594 px  (103,143,145)   cyan fill 打在深色針織上
  冠 Milfy_Gold                 719 px  (225,222,215)

對官方參考圖同一組取樣框（CIE76，去亮度 = 只看 a,b）：
  髮 browser (207,206,195) vs (254,249,245)  ΔE 16.1  去亮度  4.0
  髮 numpy   (207,185,161) vs (254,249,245)  ΔE 25.3  去亮度 12.9
  膚 browser (215,203,196) vs (254,248,246)  ΔE 15.9  去亮度  3.6
  膚 numpy   (221,178,164) vs (254,248,246)  ΔE 27.5  去亮度 16.5
  冠 browser (225,222,215) vs (228,202,175)  ΔE 15.2  去亮度 14.0
  冠 numpy   (221,192,168) vs (228,202,175)  ΔE  3.8  去亮度  1.9

判定：
- 09-01 把 SKIN_TARGET/HAIR_SAT 調暗調暖、再用 MToon 乘色補償，numpy 量貼圖
  本體必然退步（3.5 → 16.5）；瀏覽器實測畫面上的去亮度是髮 4.0／膚 3.6，
  與 08-31 出貨版的 numpy 3.5 同級。註解宣稱的機制成立，不是回歸。
- 冠的 browser 14.0 是 ACES＋白色環境光把暖金洗淡的既有性質；皇冠常數
  09-01 未動，與本批改動無關，範圍外。

## 第四版位元組的複測（2026-09-02 09:34，同一支探測頁）
sha 5b3f6492c075472a（11,896,664 bytes，collider 清理後）。五個取樣與第三版
**逐值相同**（含樣本數）：髮 (207,206,195) 6800px、膚 (215,203,196) 26737px、
瞳 0px、外套 (103,143,145) 61594px、冠 (225,222,215) 719px。清 collider 只動
JSON，畫面像素不受影響，此複測把這句話從推論變成量測。
