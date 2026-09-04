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

## 第二輪：-6 出貨後使用者截圖同一種缺口仍在

使用者在實際網站（fullscreen 角色軌、`AVATAR_FRAMING_DEFAULT` 那顆相機）截
到兩張圖，缺口位置在馬尾中段（大約肩到手肘高度），不是綁點附近。用同一顆
相機參數（fov 27、`(0, lookAtY+0.1, distance)`、`lookAt(0, lookAtY, 0)`）＋
`dance.vrma` 重跑，t4–t5 附近同樣的位置重現黑色楔形缺口——證實 -6 沒有修好
使用者實際看到的那個缺口，只修了綁點附近那一個。

**排除幾何洞**（同法）：`t5` 這個缺口位置的權重全綠（100% 綁尾巴鏈），代表
是完全在 SCALP_GAP/BLEND 過渡帶「之外」（`fade` 恆為 1）的位置，`fade=1`
時新舊公式的答案相同（`s=r`）——**這裡的缺口跟第一輪修的那個公式無關，是
另一個機制**。同一位置關掉描邊，缺口一樣消失，確認仍是描邊 pass 折疊。

新增 `debug=normals` 探針，把每個頂點的法向量編碼成 RGB 頂點色（標準
normal-map 慣例）直接畫出來：缺口位置有一塊邊界清楚的白色三角形，跟周圍
連續的黃綠色漸層明顯不連續，肉眼就能看出法向量場在那裡斷開。

**根因（第二層）**：把一片相對扁平的瀏海捲成一束接近圓形的馬尾，不是單純
的水平縮放——原始瀏海的法向量大多朝前後（±z），捲成圓管後要朝四面八方，
相鄰頂點的法向量要轉將近 90°。`normal_horizontal_scale` 這類「每個頂點只
看自己的 (fade, r)」的解析公式，本質上只能算單一頂點的縮放，算不出「這一
帶的法向量場需要整體怎麼轉」。用 Python 直接讀出貨檔（-6，已套第一輪修
正），對每個雙馬尾頂點比較「公式算出的法向量」與「從實際變形後三角形重
算出的平滑法向量」，兩者最大夾角到 **90°**，分布在兩條尾巴的近乎全長（rest
y 從 0.77 到 1.37，涵蓋綁點到近尾尖），不只是過渡帶。

## 第二輪修法

刪掉 `normal_horizontal_scale`，改用 `twintail.smooth_normals(positions,
indices)`：對變形後的實際三角形做面積加權平均（`cross(p1-p0, p2-p0)` 逐面
算面法向量，用 `np.add.at` 累加到三個頂點，最後正規化）。直接讀「已經變形
好的網格本身在哪裡」，不會跟真實幾何矛盾。`twintail_test.py` 改成四條測平
坦四邊形、翻轉纏繞方向會翻正負號（mutation：交換 `cross` 兩個運算元順序，
三條轉紅）、折線（hinge）兩片 90° 夾角面共用頂點時算出來是兩個面法向量的平
均而非任一單面、以及直接證明「單一頂點的縮放公式不可能同時對兩個相差 90°
的面都對」。

## 第二輪驗證

- `python3 twintail_test.py`：4/4 綠；把 `cross(p1-p0,p2-p0)` 換成
  `cross(p2-p0,p1-p0)`（纏繞方向 mutation）後 3/4 轉紅，改回修正後再次全綠
  （檔案備份對換，未 commit 前不用 `git checkout --`）。
- `python3 -m unittest discover -s scripts/avatar -p '*_test.py'`：48/48 綠
  （`pytests-0904-gapfix2.log`）。
- `npx vitest run`：24 檔 370 條全綠。
- `python3 make.py`：六道 gate 全 `compare=[]`，健檢十項全 0，`backwards-
  wound primitives: 0`，PASS（`build-0904-gapfix2.log`）。vertex sha 換成
  ced0856058098d77。
- 出貨檔（-7，真實材質）重繪 `dance.vrma` 完整 0–18 秒（0.5s 一幀，front／
  back 兩相機）目視巡過一輪，兩條尾巴全程沒有暗斑；原本第二輪缺口所在的
  t4–t5 用同一顆貼近相機（`?wide=1` 的 zoomL）重繪，缺口消失
  （`twintail-gap-0904-second-after.png` 對照 `-before.png`，同一相機同一
  幀）；第一輪修的綁點附近位置（`spin.vrma` t1.5）也重新確認仍然乾淨，沒
  有因為換掉公式而退化。

## 第三輪：-7 出貨後使用者回報同兩處缺口變成「不自然的凸點」

使用者訊息：「剛剛你補的兩個缺口有成功補上，但是看起來形成了兩個不自然的凸
點，沒有跟原本頭髮融為一體的感覺，請排查原因並修正。」

### 排查（先驗證錯的假設，再找到真因）

第一個假設：`smooth_normals`（第二輪修法）用面積加權平均三角形法向量，面積
加權會讓一片瘦長的「接縫」三角形（頂點角度小，但因為對邊長、面積跟旁邊正常
三角形差不多）拉走共用頂點的法向量幾乎跟正常三角形一樣重，比角度加權
（Max 1999 標準方法）該用的權重大得多。用真實出貨檔（-7）找到
Hair_Twintail_L primitive 6 頂點 164 三個相鄰三角形的頂點角：70.5°／11.7°／
51.1°——面積相近、角度差三倍以上，理論上會被面積加權放大成一塊法向量偏差的
亮斑。

改成角度加權（`twintail_test.py` 新增 `test_a_thin_sliver_triangle_does_not_
skew_the_shared_vertex`：合成同款瘦長三角形，面積加權算出偏差正好 45.0°，角
度加權後 <5°；mutation 還原成面積加權，新測試轉紅，其餘 4 條不受影響——證明
兩種加權在「兩面法向量本來就一致」的情況下答案相同，只有面對分歧的瘦長三角
形才分道揚鑣）。全 python 測試（49/49）、vitest（370/370）全綠，`make.py` 六
道 gate 全過，出貨為 -8。

**驗證卻發現這個假設是錯的**：direct 比對 -7 與 -8 在頂點 164 的法向量，只差
2.5°——遠低於預期。用全網格掃描（比較每個頂點的面積加權與角度加權結果，取角
度差最大的），找到真正的最大分歧點在完全不同的位置：雙馬尾各自尾尖附近
（y≈0.77–0.82，兩層加權法都算出偏差達 45–56°）與貼近綁點的後頸接縫
（y≈1.36–1.37，兩側對稱，偏差 79–80°）。用「頂點對相鄰頂點法向量夾角」直接
掃兩個出貨檔（不靠相機，純幾何）：-7 與 -8 在後頸接縫的最大夾角幾乎不變
（80.2°→75.7°／80.2°→（R 側)），角度加權對這個位置幾乎沒有改善——證明使用者
看到的凸點不是法向量加權方式的問題。

### 根因（第三層，真因）

`twintail.apply()` 裡 `free = clip((scalp.query(p)[0] - SCALP_GAP) /
SCALP_BAND, 0, 1)` 是逐頂點各自對頭皮點雲做最近鄰查詢，這個查詢不知道「這兩
個頂點在同一根髮束上、拓樸相鄰」。用 debug print 直接讀 build 中間產物
(`out/proportioned.vrm`，套用 twintail 之前）確認：Hair_Twintail_L primitive
3 的頂點 23／24／25 彼此原始距離只有 13–27mm，但 `free` 分別是 0.0000／
0.6294／0.0281——頂點 24 被拉向尾巴軸線 63%，兩側幾乎不動的鄰居把它們的共同
表面撕出一個真實的幾何摺痕（不是著色問題）。SCALP_BAND=15mm 原意是讓「貼頭
皮」到「收進尾巴」漸變、避免撕裂，但這個判準只保證「距離」漸變，不保證漸變
落在網格自己的相鄰頂點之間——同一根髮束上相距 15–27mm 的兩個頂點，可以落在
15mm 過渡帶的兩端，之後的位置混合把它們拉開到數十公分，形成真實的摺痕。這
就是為什麼換法向量加權方式救不了它：法向量正確反映了實際存在的摺痕（round 2
"cannot disagree with the surface that is actually there" 這句話仍然成立，
只是這次表面本身真的摺了）。round 1／2 修的是法向量計算，這條摺痕從一開始
就在，只是先前錯誤的公式把它畫成暗洞，round 2 修好法向量計算後改畫成亮斑，
round 3 才第一次修到位置本身。

### 第三輪修法

新增 `twintail.smooth_scalar(values, indices, passes=2)`：對 `free` 做拓樸
平滑（沿三角形實際相鄰關係取鄰居平均，跟頂點 0.5:0.5 混合，兩次），在 `free`
拿去乘進 `fade`、驅動位置混合之前先跑。跟 `smooth_normals` 同一個手法：讀網
格自己的鄰接關係，不是逐點各自對點雲查詢。`twintail_test.py` 新增
`SmoothScalarTest` 三條：孤立頂點被鄰居拉走預期量、`passes` 真的疊代兩次會
比一次更接近鄰居、沒有三角形碰到的頂點（`values` 比 `indices` 覆蓋的頂點多）
不能被除以零拖去 0。三條各自 mutation（拿掉 `passes` 迴圈只跑一次／拿掉
`cnt>0` guard／把混合公式改成 no-op）全部轉紅。

### 第三輪驗證

- `python3 twintail_test.py`：8/8 綠；三條新測試各自 mutation 後轉紅，改回
  修正再次全綠（檔案備份對換，未 commit 前不用 `git checkout --`）。
- `python3 -m unittest discover -s scripts/avatar -p '*_test.py'`：52/52 綠。
- `npx vitest run`：24 檔 370 條全綠。
- `python3 make.py`：六道 gate 全 `compare=[]`，健檢十項全 0，骨架
  `compare(baseline,this)=[]`（bones=54，未變），雙馬尾在外套輪廓內最深讀數
  與 -8 相同（-59mm／0.0%，證明頭皮覆蓋範圍沒有跟著退化），PASS
  （`build-0904-gapfix4.log`）。vertex sha 換成 62121d3a0c70455f。
- 幾何層面（不靠相機）：全網格「頂點對相鄰頂點法向量夾角」掃描，-9 的後頸接
  縫在兩側 TOP-6 最大夾角清單裡完全消失（原本 -7／-8 都是榜首 79–80°），
  >30° 的邊數從 -8 的 1232／1260（左／右）降到 -9 的 790／860，降幅約
  33%／32%。剩下的最大夾角全部集中在尾尖附近（y≈0.77–0.83），是另一個從未
  被回報過的獨立位置，這輪不處理（範圍外，見下）。
- 視覺驗證：`_gapprobe_tmp.html`（診斷用，未進版）用與現場引擎相同的相機
  參數（`avatarMode.ts` 的 `AVATAR_FOV`／`AVATAR_CAMERA_TILT`／
  `AVATAR_FRAMING_DEFAULT`）重繪 `dance.vrma` t3.5–t6，-7 對 -9 逐幀像素差
  在多個時間點都有數千到兩萬多像素的差異（遠大於 -7 對 -8 只有數百到一千像
  素的差異）；t4.5-zoomR／t6-zoomR 兩幀原本清楚可見的大片亮白硬邊三角凸塊
  在 -9 完全消失，取而代之的是與周圍髮束一致的平滑漸層，只剩正常髮束分岔
  該有的小凹痕。另外用 `spin.vrma`（第一輪原始診斷用的轉身片段）在 back 相
  機重繪 t0.5–t3，後頸接縫區域同樣有像素級差異，肉眼在放大截圖中兩版都乾
  淨（差異落在細部漸層，非可見瑕疵形狀）。

### 範圍外

尾尖附近（y≈0.77–0.83，雙馬尾對稱）的法向量夾角在 -9 仍有 56–72°，是這輪
掃描新發現、過去三輪回報都沒提到的獨立位置，不確定是否為視覺上可辨識的瑕
疵、也不確定是否為同一種「free 鄰接跳變」機制（該區 fade／free 理論上都已
經是 1.0，不太可能是 SCALP_GAP 過渡帶問題，更可能是尾尖收束處髮束本身的幾
何造成的獨立瘦三角形）。這次不處理，留給下一次回報或下一輪主動排查。
