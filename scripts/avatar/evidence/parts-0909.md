# 第三方匯出檔的部件對照表，2026-09-09：宣告了十六組彈簧，沒有一組動得了頭頂

`springsim.ts` 要一份 `<model>.parts.json` 才知道哪個 primitive 是頭髮、哪個是臉、
腰線在哪。那份檔案由 `build.py` 隨身體一起產出，VRoid Studio 的換裝成品沒有，
`deriveManifest` 於是改從檔案本身推導。推導的結果是 0 個 `Hair_*` 部件，
`runClip` 停在 `manifest has no Hair_* part`。

    沒有 R3-B-clean-base-dressup.parts.json，部件改由檔案本身推導：
    0 個會動的髮部件（彈簧驅動 ≥40%），臉取表情驅動的 mesh，其餘全歸 Body_Skin。
    Error: manifest has no Hair_* part

## 為什麼推導找不到頭髮

推導把「彈簧主導 ≥40% 的 primitive」當頭髮。這個檔沒有任何 primitive 到得了那個
比例，因為它沒有任何 primitive 有一絲彈簧權重可言。

`VRMC_springBone` 有 16 組 spring，展開後 29 個節點；其中出現在任何 skin 的
`joints` 清單裡的有 6 個，全是胸部，攤成 4 個相異骨名：

    node   4 J_Sec_L_Bust1     node   7 J_Sec_R_Bust1
    node   5 J_Sec_L_Bust2     node   8 J_Sec_R_Bust2
    node 102 J_Sec_L_Bust2     node 104 J_Sec_R_Bust2   （另外兩個同名節點，spring [11][12]）

另外 23 個節點不在任何 skin 裡，所以沒有任何頂點是它們能搬動的：9 條
`transferable_HairJoint-*` 的 18 個關節、帽兜與兩條帽繩的 3 個 `_end` 尖端、
以及胸鏈自己的 2 個 `_end`。逐 primitive 掃過去，帶彈簧權重的只有
`InnerTop.baked[0]` 與 `InnerBottom.baked[0]`，各 21.71 的權重總和分布在
3295 個頂點裡的 270 個，單點最大 0.141。

三種退化在同一個檔裡同時出現：

    [ 0][ 1]  J_Sec_?_Bust1        鏈長 127.4 mm  頂端 y 1.1874   ← 唯一真的會動的
    [ 2..10]  transferable_HairJoint-*-2   鏈長 32.7–59.6 mm      不在任何 skin
    [11][12]  J_Sec_?_Bust2        鏈長   0.0 mm                  另外兩個同名節點，無子節點
    [13..15]  Hood / HoodString    鏈長   0.0 mm                  鏈上只有 `_end` 尖端，無子節點

頭髮本身（`N00_000_00_HairBack_00_HAIR`，也就是全模型最高的那 746 個頂點）
的權重是 `J_Bip_C_Head` 715.5、`J_Bip_C_Neck` 28.8、`J_Bip_C_Chest` 1.5、
兩邊 Shoulder 合計 0.3。它是剛體，由 humanoid 擺出來的。

## 這改了 springsim 的一道關卡

`runClip` 原本在 `hairJoints` 回空時無條件 `throw`，所以這具身體的 clearance 一份也
產不出來。

擋它的理由不成立。頭頂是「manifest 列出的所有部件裡最高的那個頂點」，而不論 manifest
把哪個 primitive 叫做頭髮，solver 都會把檔案裡每一條彈簧跑完，所以頭頂本來就帶著該有
的甩幅。量給自己看：拿出貨的 milfy，把 65 個 `Hair_*` 部件全部改名成 `Fluff_*`、讓
唯一的 `Hair_*` 指向臉，兩支 clip 的頭頂與兩個機位的投影完全一樣：

    clip    manifest   rigidHair   頭頂     column    waistUp    jump
    spin    正確        false      1.5886   1.6107    1.5958     12.4° HairTailL_2
    spin    錯名        true       1.5886   1.6107    1.5958      0.0°（無骨）
    dance   正確        false      1.6647   1.7087    1.7000     21.7° HairTailR_5
    dance   錯名        true       1.6647   1.7087    1.7000      0.0°（無骨）

`hairJoints` 真正決定的是兩件別的事：`jump` 兩欄（tail bone 的單幀轉角），以及
`--hit`／`--gravity`／`--no-arms`／`--no-coat` 這四個只作用在髮彈簧關節上的旗標。所以
關卡改成：空清單照跑並在報告上標 `rigidHair`（表格的 `jump` 兩欄印 `—`），只有在有人
帶了那四個旗標之一時才拒絕，因為那時候執行會把旗標印在檔頭卻什麼都不做。

中間走過一條錯路，值得記下來：第一版用「帶彈簧權重的最高頂點 ＋ 2 × 最長彈簧鏈」當
上界來判斷彈簧搆不搆得到頭頂。那個上界是錯的，頂點繞骨頭轉時的位移是 2 × 頂點到鏈根
的距離，跟鏈長無關；repo 裡的 `AvatarSample_B_webp.vrm` 就是反例（鏈長 0.5724，而
`Hair001.baked` 有頂點離自己的鏈根 0.5898，上界短了 34.8 mm）。是 code reviewer 拿這具
現成的身體算出來的。

## 手寫的對照表

`build/mika-reuse/r3-studio-20260909/R3-B-clean-base-dressup.parts.json`，
副本在 [parts-0909-R3-B-clean-base-dressup.parts.json](parts-0909-R3-B-clean-base-dressup.parts.json)，
因為那個 run 目錄整個在 `.gitignore` 裡。17 個帶皮 primitive 全部列到，一個不漏（頭頂取的是所有列出部件的最高頂點，
漏列等於量錯）。三個 `springsim` 會查的角色是 `Hair_Back`、`Body_Skin`、`Face`。

`Outfit_Cardigan` 給了連帽外套：`outerShellOnly` 與 `dropSleeves` 是幾何操作，
套頭衫與開襟外套都適用。牛仔褲叫 `Outfit_Jeans`，不叫 `Outfit_Bottom`：後者是裙子的
角色，深度是拿腿部皮膚當對照量的，前提是裙子不貼腿，長褲貼腿是設計，同一個數字會
變成另一件事的量測。

### 腰線讀的是沒被挖過的那層

`landmarks.waist` = 1.0187、`waist_r` = 0.1097，用 `build.py` 的 `landmarks()`
跑在 `InnerTop.baked[0]` 上。不能跑在 `Body (merged).baked(copy).baked[0]`：
匯出時的 auto-mask 把外套蓋住的軀幹整片挖掉，搜尋範圍 0.9100–1.2143 的 29 個切片
只有 y=0.9426 那一片還有 14 個頂點，y≥1.0622 全部是 0 個。那個檔案上量到的最小值
是破洞的邊緣所在，不是身體最窄的地方。同一組搜尋跑在未挖的 `InnerTop` 上，
29 片每片 33–184 個頂點，半徑從 0.1347 平滑降到 1.0187 的 0.1097 再回升。

## 守衛與 mutation

`springsim.rigid.test.ts` 三條，四次 mutation 各自轉紅（跑完還原並 diff 為空）：

    旗標守衛永不擋            refuses a tuning flag it would have to swallow            RED（只有這條）
    rigid 恆為 false          三條全 RED
    rigidHair 恆為 false      measures the crown… ＋ gets the same crown…               RED，旗標那條仍綠
    恢復無條件 throw           三條全 RED

夾具都由出貨的 milfy 身體改出來。剛體那具把 GLB 的 JSON chunk 重打包，只留 `Bust`
那組彈簧：彈簧仍搬得動 4,178 個畫出來的頂點，而它們在頭頂下方半公尺，形狀與換裝檔
一致；manifest 照原樣把雙馬尾叫 `Hair_*`，`hairJoints` 因此回空，走的正是新的分支。
第一版只留 `TopsUpperArm`（外套下擺）是錯的：那 14 個節點雖然出現在某個 skin 的
joints 清單裡，卻沒有任何頂點對它們有一絲權重，夾具因此退化成「檔案裡的彈簧搬不動
任何東西」，跟換裝檔的形狀不是同一件事。是 code reviewer 逐組量權重才拆穿的。

錯名那具不動檔案，只把 manifest 裡每個 `Hair_*` 改名成 `Fluff_*` 並讓 `Hair_Wrong`
指向臉。指向 `Body_Skin` 是錯的：胸部彈簧就在身體的 skin 裡，`hairJoints` 因此不是
空的，那條測試會綠著通過而什麼也沒釘住。它是特性測試不是守衛，釘的是「換個名字頭頂
不變」這個讓空清單可以放行的前提，所以它沒有對應的 mutation。

三條放在自己的檔案 `springsim.rigid.test.ts`，理由與 `springsim.derive.test.ts` 檔頭
寫的同一條：一個 worker 連續佔住 60 秒，vitest 會在一次通過的執行上報
`Timeout calling "onTaskUpdate"`。合在一起是 9 條 183 秒並且真的報了那個錯，拆開之後
剛體 3 條 41 秒、推導 6 條 28 秒，兩邊都乾淨。錯名那次用 `spin`（9.32 秒）而不是
`dance`（26.80 秒）：改名把 65 個部件擠出 `gather` 的 stride 規則（只有 `Hair_*` 與
`Outfit_Bottom` 會抽樣），錯名的那次因此不管 `--stride` 給多少都要查六倍的頭髮。

## 十支 clip 的頭頂

    clip          crown      @t     (column) (waistUp)
    akimbo        1.6029  10.20s     1.6050    1.6019
    dance         1.6717  11.97s     1.7370    1.7008
    idleLoop      1.5990   5.37s     1.6066    1.6004
    modelPose     1.5948   0.43s     1.5880    1.5903
    peaceSign     1.5635   0.67s     1.5709    1.5648
    playFingers   1.6048   4.57s     1.6093    1.6048
    scratchHead   1.6497   0.70s     1.6542    1.6502
    spin          1.6068   6.83s     1.6435    1.6125
    squat         1.6102   8.17s     1.6030    1.6043
    stretch       1.8661   1.60s     1.8889    1.8763
    靜止 1.5982（column 1.5994、waist-up 1.5971）

頭頂是所有列出部件的最高頂點，`stretch` 的 1.8661 來自舉起來的手。

彈簧的兩欄（`jump` 與它的 `@t`）現在印 `—`（`bone` 欄本來就是空字串）：剛體頭頂沒有
tail bone，本來會印的 `0.0°` 與掉了彈簧的一次執行印出來的一模一樣。外套那四欄印的是
真的 0mm，量的是頭髮陷進外套殼的深度，剛體頭髮從來沒有進去過。`body max 10mm` 是髮根
在頭皮底下，出貨的身體也是同一回事。

## 三個模組裡跑出了兩個

`simulated`（`springsim.ts --clearance`）與 `measured`（`measure-motions.ts --write`）
都已產出，兩者的 `rigSha` 同為 `ec3b9ab3…`、`restCrownY` 同為 1.5982，而這兩個數字是
兩條獨立路徑算出來的：前者是蒙皮後所有列出部件的最高頂點，後者是
`rigProbe.deriveRestCrown`。log 在 `springsim-0909.log` 與 `measure-0909.log`。

手寫的決策模組還沒有：`crownFringe` 要在瀏覽器上量、`pans` 要宣告後反覆推導到收斂、
waiver 與 `excluded` 要逐條決定。`approvedAllowlist` 在三份齊備之前仍然是空的。

## 沒有宣稱的事

這具身體的 rig 與出貨的兩個 family 都不同（`ec3b9ab3…`，出貨的 VRoid family 是
`e2aad79e…`）：它沒有 `upperChest`，肩與頸直接掛在 `chest` 上，拇指用 1.0 的
`ThumbMetacarpal` 命名，hips 在 0.9081，出貨的兩具都在 0.8782，高 29.8 mm。所以現成的
clearance 檔套不上去，它是第三個 family。
