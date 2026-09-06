# 腋下穿模，2026-09-06：匯入服裝的最近頂點綁定在皺褶處撕裂

使用者截圖（雙馬尾造型、dance 中手臂近水平）：兩側腋下各有一塊黑色與薄荷色
交錯的碎片，問是不是穿模。出貨檔 mika-milfy-11。

## 重現

`armpitprobe.html`（本輪新增，診斷頁）把兩條上臂從 T-pose 逐步放下
0／10／20／30／45／60／75°，每個角度拍兩側腋下的前／下／後三個特寫。-11 從
20° 起兩側腋下出現鋸齒狀黑色楔形與薄荷色碎片，30° 最大，60–75°（idle 的手臂
高度）仍在。黑色是 MToon 描邊殼在被拉長的三角形上摺疊，薄荷色是被拉開的內裡
背面吃到低位 cyan 補光。dance.vrma 每 2 秒一幀同樣可見（t2 的姿勢就是截圖那
一幀）。截圖：`armpit-0906-before-after-30.png`、`armpit-0906-before-after-60.png`
（每張四格，由左到右：-11 左腋前視、-12 左腋前視、-11 右腋仰視、-12 右腋仰視）。

## 根因

`garment.bind` 把每個服裝頂點綁成**離它最近的一個身體頂點**的權重。腋下是凹
的：袖子底部某個頂點最近的皮膚是肋骨（全胸權重），隔壁那個頂點最近的是上臂
（全臂權重），權重在一條邊上從 0 跳到 1（最壞那條靜止 11mm，60° 時 74mm）。量法：`verify.torn_bindings`
用真蒙皮（`pose.skinned`，真 IBM）把單一關節轉過去，量每條邊的絕對伸長。

    -11 外套（Body.baked#22）         最壞邊伸長
      leftUpperArm  +60° / -60°       63.2mm / 71.9mm
      rightUpperArm +60° / -60°       77.1mm / 70.0mm
      leftLowerArm  +90°（手肘）       49.2mm
      rightLowerArm +90°              51.6mm
    身體自己的皮膚（Body.baked#0）     最壞 17.3mm（手肘）、14.7mm（腋下）

手肘也撕（袖管離手臂 20mm，最近皮膚在上臂／前臂之間翻面），只是袖子鬆、不
如腋下顯眼。用比值量會被胸口 1mm 的小邊主導（-11 的襯衫 1.0→4.7mm 比值 4.6x
卻看不見），所以守衛與這份表都用毫米。

## 修法：`garment.bind(smooth=N)` → `garment.smooth_weights`

抄完最近頂點權重後，在服裝自己的網格上擴散 N 次（每次一半自己一半鄰居均
值；按位置焊接 UV 島縫，否則擴散到縫就停、縫保持原跳變），最後每頂點留四個
最大的 joint 重新歸一（JOINTS_0 只裝得下四個）。候選方案都用真蒙皮＋四槽截
斷量（`kernel_experiment.py`，本輪 scratch，不進版）：

    外套，最壞邊伸長 mm             上臂+60  上臂-60  手肘90
      shipped（最近頂點）            63.2     71.9     49.2
      nearest + diffuse 4            16.1     26.7     18.0
      nearest + diffuse 8            10.8     20.0     13.8
      nearest + diffuse 16            9.2     14.9      9.9   ← 採用
      nearest + diffuse 24            9.7     12.2      9.4
      nearest + diffuse 48           14.8     17.4      9.0（截斷開始吃掉權重）
      idw k=24 + diffuse 8           22.4     23.8     10.0
      gauss σ=15mm + diffuse 4       22.3     23.3     10.2
    身體自己的皮膚                    3.3     14.7     17.3

空間核（idw／gauss）在四槽截斷前看起來更好（8.6／12.2／10.0），截斷後反而
輸：它們把 5–8 根骨頭混進同一個頂點，砍到四根再歸一就是新的跳變。擴散 16 次
是最小的、三個數字都不高於身體自己皮膚的那一檔。

套用範圍：只有跨過腋下的兩件上身衣，`MELLOW_BIND_SMOOTH = {'Outfit_Cardigan':
16, 'Outfit_Top': 16}`。第一版給了所有匯入的 Mellow 服裝，motion gate 把它擋
下來：貼著小腿的襪子擴散過之後膝蓋一彎小腿就從襪子穿出來，scratchHead.vrma
t=4.02s 的 Outfit_Socks 從 -11 的 5px 變 233px（限 88，2.63x；那一輪的 motion
log 已被最終版覆蓋，數字抄自當時的輸出）。管狀貼身件
（襪、鞋、腿帶、腰封）沒有皺褶要跨，最近頂點就是對的。裙子由 `drape` 重寫權
重；手工件（領子、鈕扣、繃帶）維持原樣。`armpit-0906-diff.log`：-11（git
HEAD）對 -12 每個部件位置逐位元組相同（0.00mm），權重只在 Outfit_Cardigan
（7844 頂點）與 Outfit_Top（6058 頂點）上不同。

### 中途踩到的一件事：外套輪廓要讀平滑前的權重

第一次重建 `appearance_test.test_scalp_layer_carries_no_tail_weight` 紅（貼頭
層一個頂點掛 5% 尾巴骨），而雙馬尾的權重逐位元組沒變、位置卻移了 14.7mm。
機制：build.py 用外套頂點的主導骨挑「軀幹片」餵 `twintail.CoatContour`，平滑
把肩袖交界一圈頂點的主導骨換了邊（torso-lead 3502→3426），輪廓變、馬尾軸線
跟著移，一個原本在 20mm 帶外的頂點落進帶內。改成先用平滑前的權重取軀幹片、
再平滑（build.py 的註解），第二次重建雙馬尾位置與 -11 相同到 0.00mm，該測試
綠。馬尾掛在外套上的位置不該隨綁定的平滑程度變。

## 守衛與收據

- `verify.torn_bindings`（health check 新增一行「skinned primitives that tear
  when an arm bends」）：六個彎（左右上臂 ±60°、左右手肘 90°），每個蒙皮
  primitive 最壞邊伸長 > `BIND_GROWTH_MAX_MM = 25.0` 即 FAIL。25 在身體自己的
  17 與 diffuse 4 的 27 之間。
- mutation A（管線接線）：`MELLOW_BIND_SMOOTH = {}` 重建，
  `armpit-0906-mutation-smooth0.log`：`skinned primitives that tear when an arm
  bends: 6`、`Body.baked#22 grows an edge by 63mm with leftUpperArm at +60
  degrees (limit 25mm)` 等六行、`健檢未過`、exit 1，未出貨。改回重建 PASS。
- mutation B（守衛本身）：`verify_test.TornBindings` 把出貨檔外套權重每頂點
  snap 到主導骨（最近頂點綁定留下的那種硬交接），`torn_bindings` 必須只點名
  `Body.baked#22` 且超過門檻，`report()` 必須 FAIL 並印出該行；出貨檔本身必
  須為空清單。
- `garment_test.Smoothing`（合成皺褶）：最近頂點抄權重把整個 0→1 交接放在一
  條布邊上（>0.9）；smooth=16 後每條邊 <0.35；焊接縫兩側的複本權重相同
  （不焊接時各自被自己的島拉走）；smooth=0 與舊行為逐位元組相同；全在單一
  骨上的布不變。
- 舊出貨檔當對照：`armpit-0906-growth.log` 對 -11 跑同一個守衛，六列超標
  （49–77mm）；-12 的外套（Body.baked#22）全部 ≤ 14.9mm，全檔最高是身體自己
  的手肘 17.3mm。

## 驗證

- `build-0906-armpit.log`：make.py 六道 gate compare=[]、健檢全 0（含新行）、
  vertex sha `d2f578d76a7b8d22`、出貨 `public/avatar/mika-milfy-12.vrm`
  （sha256 `f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6`，
  與 out/mika-milfy.vrm 相同）。/avatar/* 快取一年不可變，檔名 -11→-12，
  引用處 17 個檔案一起換（`rg mika-milfy-11` 只剩 evidence 的舊 log）。
- `armpit-0906-tests.log`：`python3 -m unittest discover` 154/154 OK（新增
  garment_test 5、verify_test.TornBindings 3）。
- `armpit-0906-vitest.log`：springsim／live-preview／avatarVariants 14/14。
- `armpit-0906-motion.log`：motion.py 十支 clip 的穿模 gate PASS，最壞
  akimbo 的裙子 0.61x（-11 是 0.60x），襪子回到 6px（第一版 233px）。
- 瀏覽器（三次重建之後的最後一版；-12 的 arm 掃描與 dance t2–t18 每 2 秒共
  63 幀）：兩側腋下三個角度 0–75° 沒有碎片，45–60° 只剩一道布料摺痕（外套
  內裡在摺線露出一線，前後都自然）。
