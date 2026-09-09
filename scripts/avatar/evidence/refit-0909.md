# 匯入服裝的側身跟著上臂走，2026-09-09：懸空的布沒有身體可以複製

R3 的 VRoid Studio 換裝成品在 `verify.torn_bindings` 上 FAIL：`Tops.baked`
（連帽外套）在 `leftUpperArm +60°` 與 `rightUpperArm −60°` 各長 46.478 mm，
門檻 25 mm。同一個檔案的其他每一個網格都通過，它自己蓋住的那具身體最壞只有
16.42 mm。

修正已套回原檔，所以 `R3-B-clean-base-dressup.vrm`
（`6135e4295d169e5130e52cf3d3c1180c4228d7c6f819ecb68114620e5c64971c`，
14,728,128 bytes）現在是修好的那一份；本文所有「修正前」的量測來自保留下來的
`R3-B-clean-base-dressup-torn.vrm`
（`c062e296a0875cb977f66c1b48406795c630027ec45d6d9241fa1731a1d56b07`，
14,686,304 bytes），位元組與 R3 當初匯出的完全相同。

## 這在出貨動作範圍內會發生

`BIND_BENDS` 的 ±60° 是壓力測試，出貨的十支 clip 沒有一支到得了。逐支量左上臂
相對 T-pose 的最大抬起角：stretch +36.0°、scratchHead +25.0°、spin +12.6°、
squat +10.6°、dance +2.7°，其餘為負（idle −75.4° 是把手臂放下，正是通過的那個
方向）。所以不能用 idle 的姿勢幅度替這個 FAIL 背書。

改量真正到得了的角度，缺陷仍然超標：

    左上臂抬起          25°      36°      45°      60°
    修正前             21.71    30.31    36.81    46.48 mm
    修正後             11.39    15.66    18.74    22.99 mm

stretch 實際到達的 +36° 上，R3 就已經 30.31 mm 高於 25 mm 門檻。

## 重現與畫面

`render.render(..., posed=pose.skinned(doc, views, {leftUpperArm: 60°}))`。
抬左手時外套整片左側從下擺被拉成一條直線通到腋下，下擺兩側不等高；右側（手臂
維持水平）的 armhole 是正常的。截圖 `refit-0909-before-60.png`。

## 根因

外套的權重整體是「最近身體頂點的複製」：全網格 1754 點與最近身體點的手臂權重差
中位數 0.0000、p90 0.0674。問題出在**那塊布底下沒有身體**，而那正是分布尾巴。

    撕裂邊 v1007–v1013（靜止 49.77 mm，60° 時 96.25 mm）
      v1007  離身體表面 97.2 mm   最近身體點在肋骨    該點手臂權重 0.069
      v1013  離身體表面 90.6 mm   最近身體點在上臂下緣  該點手臂權重 0.919
      複製後外套自己拿到 0.265 與 0.562，單邊 Δw = 0.297

這兩點與其來源的偏差是 0.196 與 0.357，遠在 p90 之外：XWear 在那裡已經做了部分
混合，混得不夠。所以「整體是複製」與「這兩點偏離複製」同時成立，撕裂發生在後者。

外套是寬版的，腋下外側整片飛離身體 66–97 mm（全外套中位數 32.3 mm，袖子 33 mm）。
「最近」在那片空隙裡抓到什麼算什麼，一邊抓到肋骨、隔壁抓到上臂下緣。

放大它的是力臂：那塊布距肩關節 181.4 mm，身體自己的同一段過渡只在 64 mm 處。
`Δw × 2r × sin(θ/2)` = 0.297 × 2 × 0.1814 × sin30° = 53.9 mm，實測 46.48 mm。
身體的權重梯度其實更陡（p99 0.039/mm 對外套 0.014/mm），它不裂只是因為它的布
就在關節旁邊。

## 為什麼擴散修不好

這一次的機制與 [armpit-0906](armpit-0906.md) 不同。0906 是**貼身**的布在皺褶處
抄錯，`garment.smooth_weights` 16 pass 把 63–77 mm 壓到 ≤14.9 mm，那個結論仍然
成立，`build.py` 的 `MELLOW_BIND_SMOOTH` 至今照用。0909 是布底下根本沒有身體，
擴散沒有正確的鄰居可以抹平。

過渡帶（左側 r>150 mm、手臂權重 0.05–0.95）的 r 中位數 200.4 mm，門檻換算成
每條邊只准 25/200 = 0.125 的權重差；帶內權重跨度 0.890，至少需要 8 條邊接力，
而那塊空隙大約只有 4 條。實測見 [refit-0909-sweep.log](refit-0909-sweep.log)：

    原始                                          46.48 mm
    garment.smooth_weights 2/4/8/16/24/32 pass    39.68 / 36.39 / 33.16 / 31.52 / 30.81 / 30.53 mm
    懸空處整條權重換成最近軀幹頂點的 ＋8/＋16 pass    34.66 / 31.60 mm
    貼身布當固定邊界、空隙解調和場 200/600/2000 迭代   38.88 mm（三者相同）
    refit 但兩種擴散都不做                          101.27 mm
    refit 但脫離場不擴散（權重仍擴散 12 pass）         31.93 mm
    refit 但權重不擴散（脫離場仍擴散 24 pass）         30.86 mm
    refit 預設（脫離場 24 pass、權重 12 pass）        22.99 mm

擴散到 32 pass 停在 30.53 mm。16 pass 時最壞邊在 r = 192.3 mm 處、Δw = 0.150，
該處的預算是 25/192.3 = 0.130，仍然不夠；該處四槽上限只吃掉 4–5% 的權重
（v1000 0.0438、v1007 0.0540），卡住的原因在網格邊數，槽位不是瓶頸。

## 修法與量測

`refit.rehome`：離身體越遠的布，把它手臂鏈的那一份還給手臂懸掛的宿主骨
（走節點祖先鏈找，本檔是 `J_Bip_C_Chest`，我們自己的 milfy-12 是
`J_Bip_C_UpperChest`），比例是一個 0→1 的「脫離場」，先在布自己的 welded 邊上
擴散過再用。

    ramp 45→75 mm、脫離場 24 pass、權重 12 pass
    Tops.baked 全彎曲最壞邊   46.48 mm -> 22.99 mm
    整檔 torn_bindings        FAIL -> PASS
    structure-check           7 PASS / 5 NOT_SUPPORTED / 0 FAIL，exit 0
    袖子保留的下臂權重中位數    0.983

ramp 取 45–75 mm 是量出來的：袖子離它包覆的手臂 33 mm，撕裂的側身離任何身體頂點
66–97 mm，兩者分得開。參數兩側各測一組共 10 組全部通過，範圍 21.97–24.41 mm，
袖子權重 0.952–0.986，不是撞中的單點；明細在同一份 sweep log。

畫面：`refit-0909-after-60.png`（同機位）與 `refit-0909-after-60-quarter.png`。
下擺回到水平，外套本體垂直下垂，抬起那側的袖子照常跟手。

## 沒有跑的關卡

**這一輪沒有跑穿模 gate**。`motion.check` 要一份 `parts.json`，寫這份收據時這個檔
還沒有；同日補了一份手寫的（[parts-0909](parts-0909.md)），gate 當時仍然跑不了，因為
`pierce.py` 的 `SKIN` 寫死是 `('Body_Skin', 'Face')` 兩個名字，這具身體的皮膚分在
三個 mesh 上，`InnerTop` 與 `InnerBottom` 兩層會被當成布。`inside.py` 的體積法不是
替代品，`motion.py:182` 的註解已記明它答的是另一個問題。

同日稍晚把皮膚名字改成由 manifest 決定之後 gate 跑完了，結果是 FAIL：帽 T 動態最差
779 px 為上限的 5.19 倍，貼圖算圖看得見。收據在 [parts-0909](parts-0909.md) 與
`pierce-0909.log`。下面那組距離量測因此不再是唯一能講的話，但它量的仍是這次權重
修正本身的風險，兩者不互相取代。

0906 的教訓是改權重可能只被 motion gate 抓到（襪子在 scratchHead t=4.02s 從
5px 變 233px）。這一輪能做的是直接量修改本身的風險，即外套與身體的最近距離有沒有
變差：

    抬手 36°   修正前 min 2.71 mm / p1 6.52 / 中位 31.88    修正後 min 3.01 / p1 6.54 / 中位 31.73
    抬手 60°   修正前 min 2.71 mm / p1 6.52 / 中位 31.56    修正後 min 3.01 / p1 6.52 / 中位 31.54

淨空距離沒有變差。這是距離量測，不等於通過像素穿模 gate，而 gate 後來跑出來是
FAIL：兩者並不矛盾，這裡量的是修正前後的差，gate 量的是修正後的絕對水準。

## 套回原檔後的完整驗收

修正套回 `R3-B-clean-base-dressup.vrm` 之後，R3 當初跑過的那一整套重跑一次，
輸出在同一個 run 目錄的 `final-*`：

    structure-check            7 PASS / 5 NOT_SUPPORTED / 0 FAIL，exit 0（含 torn_bindings PASS）
    measure-candidate          10 clips、13 組 numeric candidate placement、approvedAllowlist=[]
    capture-candidate          4 views、21 PNG、18 expressions，全部載入／driving／繪製成功
    verification-snapshot      PASS：21 份 JSON、17 個 model reference、84 個 screenshot
                               reference、9 個產物、138 張 evidence PNG

`approvedAllowlist` 仍是空集合：缺的是模型專屬 crown clearance，這次修的是權重，
兩者無關，數字與修正前相同。人工檢視 `final-browser` 的 face-neutral 與
quarter-neutral，確認 R3 原本修好的兩件事仍在（頸部連續、領口沒有白色尖角）。

覆寫原檔會讓那個 run 目錄自相矛盾，因為 `clean-structure`、`clean-motion` 與
`evidence/clean-browser` 都記著舊 hash。先跑一次快照確認它抓得到（`Hash mismatch`，
exit 1），再把這四份結果檔的 `source.path` 指向 `-torn.vrm`；`sha256` 與 `bytes`
一個字都沒改，是路徑跟著它描述的位元組走。改完快照才 PASS。

保留樣本自己重跑仍是 `FAIL 2 筆`、最壞邊 46.48 mm，和修好的那份 22.99 mm 分得開。

## 守衛與 mutation

`refit_test.py` 十五條，十道守衛逐一 mutation 各自轉紅（`__pycache__` 每次先刪、
pattern 命中數斷言為 1、跑完還原並比對原檔），收據在 mutation 那一輪的輸出：

    不擴散脫離場（passes -> 0）          test_shed_field_is_smoothed_across_its_own_edges   RED
    shed 恆為 0（等於沒修）               test_flared_cloth_shed_its_limb_share_onto_the_host RED
    shed 恆為 1（連貼身布也剝掉）          test_cloth_worn_on_the_body_keeps_the_copied_limb_share RED
    host 改寫死 'J_Bip_C_Chest'          test_the_host_is_the_nearest_listed_ancestor        RED
    chain 只取根節點不取子孫               test_the_chain_is_every_node_under_the_root         RED
    chain 重複 slot 不去重                test_a_slot_the_chain_lists_twice_is_shed_once      RED
    dense 不補到四欄寬                    test_the_written_attributes_stay_four_wide          RED
    不擋零寬 ramp                        test_a_ramp_with_no_width_is_refused                RED
    沒有 move 時靜默寫回原檔               test_cloth_whose_skin_holds_no_chain_joint_is_refused RED
    `_pairs` 不檢查格式                   test_a_mesh_without_a_primitive_is_refused          RED

去重那一條要放在 ramp 中段才會紅：脫離場為 0 或 1 時，重複相加的誤差會在最後的
正規化裡被除掉，測試看起來是綠的。

`ShippedFile` 那條把 `refit.apply` 跑在我們自己的 milfy-12 外套上，跑完仍
`torn_bindings() == []`：這個操作不會是弄壞既有出貨檔的那一手。CLI 的
`_pairs` 由 `CommandLine` 兩條分開釘住，`apply` 那條沒有經過 argv。

## 範圍

`CHAIN_ROOTS` 預設只有兩條手臂，因為 `BIND_BENDS` 只轉手臂；腿的同一件事沒有量過
也就沒有宣稱。`body_distance` 量的是頂點到頂點，身體網格稀疏時 ramp 要重讀（本輪
的 pool 是三個網格共 9385 點，其中 `InnerTop.baked` 與 `InnerBottom.baked` 的
POSITION 逐位元相同，相異點為 6090；`Body (merged).baked(copy).baked` 自己 2795 點）。

## 接進流程（同日補上）

`refit.py` 原本要人工指名 cloth 與 body 的 `mesh:prim` 才能跑，而 `.xroid` 裡沒有
任何一段記錄這次修補：重新匯出一次，撕裂就一模一樣地回來，而所有看 T-pose 的關卡
照樣通過。所以修補不能是「有人記得要跑的指令」，補了 `dressup.py`（測試
`dressup_test.py`，6 條，五道防禦各自 mutation 轉紅），讓匯出檔自己決定要修什麼：

- 修哪些 primitive 由 `verify.torn_bindings` 當場量出來，不是寫死的 mesh 名單。
  同一個 primitive 被兩個彎曲各報一次，`dict.fromkeys` 收成一次，否則第二趟會讀到
  第一趟寫下去的權重。
- 身體 pool 走 `pierce.skin_parts`，與像素穿模 gate 認定皮膚的規則同一份定義。
- 寫完再量一次，還撕就 raise。`refit` 是一段 ramp 上的淡出，不是證明。

跑在本輪那個撕裂檔上：`Tops.baked[0]` 由 46.48 mm 進、`torn_bindings` 出來是空的，
自己選中 `Tops.baked[0]`，pool 是 manifest 的 4 個皮膚部件共 10 個 primitive。與手
動那一次產出的檔位元組不同（`argsort` 的平手順序不同），修補本身相同：兩個檔的
`Tops.baked[0]` 最壞邊都是 22.99 mm，權重最大差 0.0077，1,754 個頂點裡沒有一個差
超過 0.01。差別只在 pool 多了臉那 7 個 primitive，而臉離帽 T 夠遠。收據
`dressup-r3.log`。

沒有接進 `make.py`：那條線是從 base body 建 Milfy，衣服都是這裡做的、由
`binding.py` 綁的、在第 6 步過關的，從來沒有出現過這個缺陷，也沒有匯入步驟可以掛。
`dressup.py` 是「身體到的時候已經穿好衣服」那條線的入口。樣本仍是一件衣服。

這一輪沒有改 `verify.py` 的門檻、沒有改 production reader，也沒有改幾何、UV 或
morph，只換 `JOINTS_0`／`WEIGHTS_0`。
