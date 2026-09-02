# mutation 收據 2026-09-03（第六版）

受測檔 `public/avatar/mika-milfy.vrm`，sha256 開頭 `c536746e81e17b0d`，
vertex sha `ae7f90eecb9784d9`。

每一次 mutation 都先斷言 pattern 在檔案裡剛好命中 1 次、且改寫後檔案內容真的變
了，再重建。還原用的是位元組副本（`shutil.copyfile` / `cp`），不是
`git checkout --`：這一輪的修正還沒 commit，`git checkout` 會把修正一起抹掉。
每一輪結束後都比對還原後的 sha，三處都回到 `c536746e81e17b0d`。

重建走的是 `python3 build.py out/proportioned.vrm ... out/parts.json ...`，只跑
建置那一步。這條路徑產出的模型比 `make.py` 少 10 個材質（Blender 那幾件沒有進
去），所以它只用來驗貼圖層的斷言；不是貼圖層的結論一律回到 `make.py` 的出貨位
元組上量。M9 那一輪順帶出現的「找不到 Milfy_Gold_ramp 的材質」就是這個差異，不
是缺陷。

## 後腦色帶（test_hair_reads_as_one_tone_from_scalp_to_tail）

現況：貼頭層暖度 22、自由段 19，差 3，上限 12。

| # | mutation | 結果 |
|---|---|---|
| M1 | `build.HAIR_EVEN` 0.85 → 0.0 | **RED** 貼頭層 40、自由段 16，差 24 |
| M2 | `customise.hue` 拿掉 `even` 的明度那一行 | GREEN |
| M3 | `customise.hue` 拿掉 `even` 的飽和那一行 | GREEN |

M2 與 M3 在上色重解之前是紅的（差 23 與 22），重解之後變綠，原因寫在這裡以免
下次誤讀成「防禦失效」：同一個色帶現在有三個東西在壓它——`even`、`HAIR_LIFT`
0.42、`HAIR_SAT` 0.65。拿掉 `even` 的一半，另外兩個還撐得住。整個 `even` 拿掉
（M1）就撐不住。互相遮蔽的那兩道各自有自己的 mutation 落在髮色帶那條測試上
（M6／M8／M9），不是沒有人看著。

## 髮色與膚色對參考圖

現況：膚貼圖中位數 (252,221,213)／(253,221,225)，髮 (224,214,201)／(228,220,209)。

| # | mutation | 結果 |
|---|---|---|
| M4 | `customise.CLIP_BUDGET` 0.01 → 0.0（停用加法位移，退回 lift） | **RED** 臉的貼圖亮度 p10–p90 從 0.410 掉到 0.151 |
| M5 | `SKIN_TARGET` 退回 (244,190,172) | **RED** 最亮通道 244 < 245 |
| M6 | `HAIR_SAT, HAIR_LIFT` 退回 0.75, 0.0 | **RED** 最亮通道 205 < 215 |
| M7 | `SKIN_TARGET` → (252,200,180)（一樣亮，但偏橘） | **RED** 暖度 73 > 48 |
| M8 | `HAIR_SAT` → 1.20（保持提亮，飽和拉高） | **RED** 暖度 42 > 30 |
| M9 | `HAIR_LIFT` → 0.0（保持 SAT 與 EVEN） | **RED** 最亮通道 202 < 215 |

M5/M6 打的是帶子的下緣、M7/M8 打的是上緣：這一輪的缺陷是「太暖」，而舊的單邊
斷言（只有最亮通道上限與色度下限）對太暖沒有意見，所以帶子兩側都要有專屬的
mutation，否則等於只驗了一半。
