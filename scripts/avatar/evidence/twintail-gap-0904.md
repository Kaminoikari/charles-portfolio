# 雙馬尾缺口，2026-09-04

使用者回報：Mika 雙馬尾造型，兩邊的頭髮各自有一個缺口，轉身或跳舞時非常明顯。

## 排查

`motionprobe.html?f=/avatar/mika-milfy-5.vrm&clip=spin` 加一頁зoom 在
tie/肩膀交界的臨時探針（未進版，僅診斷用），back/three-quarter 各兩顆相機，
`spin.vrma` 每 0.5s 一幀。t0（靜止）乾淨，t1–t1.5 之間兩側各自在蝴蝶結下方
出現一個黑色楔形缺口（`twintail-gap-0904-before.png`），t3 附近尾巴甩到最開
時消失，t4–t6 又出現——與轉身角度相關，不是固定瑕疵。

排除幾何洞：把 Hair_Twintail_L/R 的材質換成 `MeshBasicMaterial
{vertexColors, side: DoubleSide}`，依 JOINTS_0 是否含 HairTailL_*/R_* 骨頭
著色（紅＝只綁頭骨、綠＝含尾巴鏈權重），同一批 t 值重繪。缺口消失，且紅/綠
邊界本身是連續的鋸齒（SCALP_GAP/SCALP_BAND 的預期噪訊，非破洞）。結論：幾
何連續，問題在材質層。

排除 backface culling：髮主材質 `side` 已經是 `DoubleSide`（VRoid 匯出即
如此）。改為排除 MToon 描邊：把兩側髮材質裡 `(Outline)` 那份的
`outlineWidthFactor` 設 0，其餘（含 `alphaTest:0.5`）不動，同一批 t 值重
繪——缺口消失。定位到描邊 pass。

## 根因

`twintail.py: apply()` 對頂點法向量做水平方向的逆轉置縮放，用來配合把「大
片瀏海」壓成「細馬尾」的水平壓縮。壓縮本身有兩層：`r`（該高度該壓多少）與
`fade`（這個頂點該套用多少壓縮，SCALP_GAP／SCALP_BAND／BLEND 三個過渡帶算
出的 0–1 值）。真正的水平 Jacobian 縮放係數是

    s = 1 - fade * (1 - r)

fade=1 時 s=r（舊公式對），fade=0 時 s=1（舊公式也對）。但舊公式是
`np.where(fade > 0, 1/r, 1)`——只要 fade 大於 0 就直接跳到 `1/r`，等同假設
fade 恆為 1。SCALP_GAP／SCALP_BAND／BLEND 三個過渡帶裡 fade 幾乎全部落在
(0,1) 之間（這正是缺口出現的位置：綁點與頭皮交界），法向量因此被放大了最
多到 `1/r`（尖端處 r 可以小到 0.2 左右，等於錯了 5 倍）。MToon 描邊沿法向
量外擠再以背面剔除畫出輪廓殼；法向量在這個帶內方向錯得太多，外擠出來的殼
自己摺疊，從特定角度看就是一塊黑斑——尾巴甩到某些角度時這批頂點正對鏡頭，
「轉身跳舞時特別明顯」。

## 修法

`twintail.normal_horizontal_scale(fade, r)` 回傳 `s`，取代原本的二元判斷；
呼叫端 `inv = 1 / max(s, 1e-3)`。純函式，`twintail_test.py` 四條：兩端點對
舊公式吻合、過渡帶（fade=0.1, r=0.2）算出 s≈0.92 而非舊公式的 0.2、單調、
把公式還原成舊的二元判斷後兩條測試轉紅（見下）。

## 驗證

- `python3 -m unittest twintail_test`：4/4 綠；還原成
  `np.where(fade>0, r, 1.0)` 後 `test_interpolates_through_the_transition_band`
  與 `test_old_binary_formula_would_fail_the_transition_case` 轉紅，改回修
  正後再次全綠（未用 `git checkout --`，修正尚未 commit 前用檔案備份對換）。
- `python3 -m unittest discover -s scripts/avatar -p '*_test.py'`：48/48 綠
  （`pytests-0904-gapfix.log`）。
- `npx vitest run`：24 檔 370 條全綠，未動 src/ 只有檔名 -5→-6 的字面量。
- `python3 make.py`：`gate build`／`gate skin`／`gate proportion` 全
  `compare=[]`，健檢十項全 0，PASS（`build-0904-gapfix.log`）。vertex sha
  從 ae7f90eecb9784d9 系列換成 16931555129553cb（法向量真的改了，位置/權重
  未動——`coat_intrusion` 讀數與上一版相同：-59mm／0.0%）。
- 出貨檔換材質後的 motionprobe 重繪：同一批 spin t 值（0, 1, 1.5, 2, 3, 4,
  4.5, 5, 5.5, 6）、真實材質（含描邊、alphaTest），左右兩側全部乾淨，t1.5
  的缺口消失（`twintail-gap-0904-after.png` 對照 `-before.png`，同一相機同
  一幀）。

## 範圍外

`fixed-t6-Rback.png` 右肩外套上有一條獨立的深色裂紋，是外套網格自己的接縫，
與雙馬尾無關，未處理。
