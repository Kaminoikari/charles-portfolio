# mutations-0904-blonde：第九版（金髮＋紫線修復）守衛門檻的重建收據

出貨檔 mika-milfy-5.vrm。每道 mutation 改 build.py 一個常數、重建（約 55 秒）、
跑對應的單一測試方法、再用 `git checkout -- scripts/avatar/build.py` 還原（committed
baseline 是 fd9f0d2 之後的 build.py，checkout 不會連正確修正一起抹掉）。

## test_hair_material_preserves_tone_after_live_exposure

出貨 base=(1.0, 0.8295, 0.4962) shade=(0.7918, 0.585, 0.2923)，比值
[0.7918, 0.7052, 0.5891]，warm(R−B)=0.5038。

- MUTATION-A：`HAIR_SHADE_TONE = HAIR_MATERIAL_TONE`（陰影疊回亮部，比值全 1.0）。
  紅在 shade_ratio 上限：`乘色 R−B` 未受影響（0.5038），純粹是比值 1.0 > 0.90。
- MUTATION-B：`HAIR_MATERIAL_TONE = (0.92, 0.84, 0.80)`（09-03 以前的灰米色），
  `HAIR_SHADE_TONE` 同步保持出貨比值 `(0.7284, 0.5924, 0.4713)`。紅在 warm_band
  下限：warm=0.1200 < 0.32，比值仍是 [0.7917, 0.7052, 0.5891]，shade_ratio 不受
  影響——兩道斷言互不遮蔽。
- MUTATION-C：`HAIR_MATERIAL_TONE = (1.0, 0.55, 0.15)`（過飽和琥珀），
  `HAIR_SHADE_TONE` 同步保持出貨比值。紅在 warm_band 上限：warm=0.8500 > 0.68，
  比值仍是 [0.7918, 0.7051, 0.59]。
- MUTATION-D：`HAIR_SHADE_TONE = (0.3, 0.25, 0.15)`（陰影收向黑）。紅在 shade_ratio
  下限：比值 [0.30, 0.3014, 0.3023] < 0.45，warm 不受影響（0.5038）。

四道 mutation 各自只踩自己那一條斷言，AssertionError 的訊息與行號逐一核對過。

## test_hair_texture_keeps_visible_tone_under_mtoon_lighting（HAIR_WARMTH）

出貨 HAIR_01 中位數 [222,211,180] 暖度 42、HAIR_02 [219,209,179] 暖度 40。

- MUTATION-E1：`HAIR_LIFT` 退回舊值 0.42（SHIFT／SAT 不動）。HAIR_01 中位數
  [229,221,197]，暖度 32。紅在「太低」那條斷言（32 < 36），最亮通道 229 仍
  ≥215，沒有連帶踩到亮度下限。
- MUTATION-E2：`HAIR_SAT` 推到 1.3（SHIFT／LIFT 不動）。HAIR_01 中位數
  [230,216,170]，暖度 60。紅在「太高」那條斷言（60 > 46），最亮通道 230 仍
  ≥215。
- （先試過 MUTATION-E：`HAIR_LIFT`=0.05，暖度衝到 53/51，但同時把最亮通道壓到
  213<215，先踩中 min_channel 那條斷言，不是乾淨的暖度上限證據，換成 E2。）

## test_skin_texture_keeps_visible_tone_under_mtoon_lighting（scalp_mask 排除）

Face 貼圖，`scalp_mask()` 排除頭皮蓋核心＋邊緣（243,965 px，輸入模型
mika-pink.vrm 上量）後，出貨中位數 [251,217,208]，暖度 43，落在既有帶 (22,48)
內，不必動門檻。未排除時中位數 [249,211,199]，暖度 50，超出上限——這就是
2026-09-04 稍早那條紅燈的來源。

`scalp_mask()` 擴大到含邊緣後，`test_face_texture_keeps_the_contrast_its_
features_live_in` 的對比重量到 0.1020（門檻 0.075），沒有排過頭。

## test_skin_atlases_carry_no_hair_paint（新守衛）

偵測窗沿用 purple_where.py：色相 (240,330)、飽和 >0.15、明度 (0.1,0.95)。
出貨 Face=0、Body=105。門檻 250。

- MUTATION-F：`SCALP_FRINGE_SAT = 2.0`（cap_fringe／nape_fringe 都不可能命中，
  兩個 hair_paint_pixels 呼叫的邊緣都退回空集合）。重建後 Face=6983、
  Body=1156。Face 那條單獨紅（6983 > 250）。
- MUTATION-G：Body 的 `fill_from_surroundings` 呼叫拿掉（`filled = 0`，不寫
  回貼圖）。重建後 Face=0、Body=1123。Body 那條單獨紅，Face 仍是 0——兩道
  防禦沒有互相遮蔽。

## customise_test.HairPaintPixelsTest（新單元測試，不需要重建模型）

合成圖：核心色塊（色相 261）＋跟核心相鄰的邊緣弧色塊（色相 330，在候選弧內）
＋隔著一段低飽和灰色背景、色相同樣是 330 的孤島色塊。

- MUTATION-H：`hair_paint_pixels` 回傳值的 `connected &` 拿掉（`return core,
  candidate & ~core`）。孤島色塊（25 px）被算進 fringe，斷言的 100 px 變成
  125，紅。修正版本兩者都綠：fringe.sum()==100，且孤島色塊區域
  `fringe[15:20,20:25]` 全 False。

## customise_test.PaintWeightsTest（第二輪 code reviewer 找出的覆蓋缺口）

`paint_weights` 決定 blend_fringe 把每個邊緣像素混多少髮色、多少膚色，但既有
守衛全部繞過這個計算：scalp_mask／texture_contrast 排除整個 core|fringe
（不讀混色結果），test_skin_atlases_carry_no_hair_paint 只看有沒有紫色殘留
（權重恆為 0 時邊緣全寫成純膚色，仍然沒有紫，這條照樣綠）。合成圖：膚色背景
＋一塊髮色核心＋三個邊緣像素分別寫成沿「膚→髮」那條線 0%／50%／100% 的精確
混色（不要求跟核心相鄰，paint_weights 只吃 core／fringe 兩個遮罩，連通性是
hair_paint_pixels 的事）。

- MUTATION-I：函式本體換成 `return np.zeros(rgb.shape[:2])`。50% 那個邊緣像
  素解回 0.000（應為 0.5），紅；0% 與 100% 那兩個因為剛好落在退化值上沒有被
  這道 mutation 單獨挑出來，靠 50% 那點撐住這條測試——這是唯一一個能同時跟
  「恆為 0」與「恆為 1」兩種退化區分開的取樣點，之後如果要加更多 mutation
  （例如恆傳回 1），50% 那點還是會紅。
