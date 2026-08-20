# Mika 手勢改用 VRM Animation

日期：2026-08-19
狀態：完成（2026-08-19）

## 為什麼

現有的手臂手勢是手打的骨骼角度，唯一的自動判準是「手臂不超出畫布寬度」
（`avatarMode.test.ts` 的 reach 系列）。手實際落在哪、掌心朝哪、有沒有插進頭裡，
從來沒有任何測試看得見，所以每次調整只能靠肉眼截圖試錯。

2026-08-19 用真實骨架做 FK 實測，10 個手臂手勢裡有 7 個是壞的：

| 手勢 | 實測 |
| --- | --- |
| `hairTouch` | 宣稱摸頭髮，手腕實際停在 y=0.892（髖部），距頭心 0.567m |
| `lookHand` | 宣稱抬手端詳，手腕停在 y=0.831（大腿旁） |
| `cheekPoke` | 食指尖距頭心 0.090m，小於頭骨半徑 0.115m，插進臉裡 |
| `doublePeace` | 左手掌心朝觀眾分量 -0.84（手背朝前），右手 +0.84 |
| `salute` | 手腕距頭心 0.134m，落在頭髮體積內；手指朝上而非朝眉 |
| `hipWave` | 掌心朝觀眾分量 0.00，觀眾看到手的側緣 |
| `handsBehindHead` | 手腕懸在頭後外側 0.242m，沒有接觸到頭 |

`hairTouch` 與 `lookHand` 的成因明確：`ARM_GESTURE_PEAKS` 裡它們的 `fore` 是正值，
把前臂折回身側。同表其他手勢在 2026-08-14 改成負值時漏了這兩個。

`doublePeace` 的成因是 `setHand()` 對 `pose.wrist` 乘了 `mirror`。繞骨骼長軸的旋轉
在左右鏡像下不變號（`M·Rx(θ)·M = Rx(θ)`），乘 mirror 讓兩手轉向相反。

## 做什麼

手臂手勢全部改由 VRoid 官方 VRM Animation 驅動，程序式手勢只留頭與軀幹的小幅偏移。
使用者於 2026-08-19 確認已取得 bundle 官方動作的授權。

### 非目標

- 不改構圖（相機距離、畫布尺寸、placement 幾何全部不動）
- 不引入 Mixamo（本輪只用官方 7 個動作。2026-08-20 之後池子已不只官方包，見文末）
- 不做 IK 層。上一輪曾提議用兩骨 IK 重寫手臂手勢，VRMA 取代掉手打角度之後
  這個需求消失了：剩下的程序式手勢只動頭與脊椎，沒有末端目標要命中。

## 驗收條件

1. `npx vitest run src/components/chat/` 全綠。
2. 新的姿勢驗證測試對每個 bundled 動作斷言：指尖不進頭骨、手不出畫框、
   需要被看見的動作掌心朝觀眾分量 > 0.6。把任一動作換成不合格的資產會轉紅。
3. `hairTouch`、`lookHand`、`cheekPoke`、`salute`、`doublePeace`、`singlePeace`、
   `hipWave`、`handsBehindHead` 不再出現在 idle 池。
4. VRMA 不進首訪關鍵路徑（lazy load）。
5. 授權要求的 credit 出現在網站可見處。

## 資產

本節寫的是這份計畫當時的範圍：VRoid Project 官方免費 7 件組（VRMA_01–07）裡的三個，
`peaceSign`＝VRMA_03、`modelPose`＝VRMA_06、`spin`＝VRMA_05。
（`shoot`＝VRMA_04 一度在列，第四輪被擴大採樣後的穿臉檢查擋下，見下。）
後續 `squat`＝VRMA_07 補進來，再後續又加了六支非官方包的，各見文末兩節。

**來源鏈（2026-08-19 證明完成）**。這三個檔案最初是從 `semperai/amica`（MIT）的
`public/animations/` 取得的公開副本，所以第一版計畫只能寫「來源鏈到 amica 為止」。
使用者當日以 pixiv 帳號從 BOOTH 下載了官方原檔 `VRMA_MotionPack.zip`
（3,453,950 bytes，sha256 `64d6e87d…`），逐檔比對結果是**位元完全相同**：

| 站上檔案 | 官方檔 | sha256 | 結果 |
| --- | --- | --- | --- |
| `peaceSign.vrma` | VRMA_03 | `6f66b6b5…` | 相同（1,335,704 bytes） |
| `spin.vrma` | VRMA_05 | `cc508712…` | 相同（632,316 bytes） |
| `modelPose.vrma` | VRMA_06 | `a2c86633…` | 相同（518,364 bytes） |

被排除的四支（`greeting`＝VRMA_02、`shoot`＝VRMA_04、`squat`＝VRMA_07、
`showFullBody`＝VRMA_01）也各自與官方檔位元相同，也就是下表的量測本來就是在官方
位元上做的。**不需要替換任何檔案**，來源鏈現在是證明過的，不是推斷。

順帶更正兩個先前的推論錯誤：三個檔案的 `asset.generator` 是 `THREE.GLTFExporter`
且沒有 `copyright` 欄位，先前據此判斷「是重新導出過的版本」，這是錯的，pixiv 原檔
就是這樣導出的。同理，`peaceSign`／`shoot`／`spin` 是 123 個 node、VRoid 原生骨骼命名
（`J_Bip_C_Hips`）、rest 全 identity，而 `modelPose` 是 53 個 node、generic 命名
（`hips`）、52 根人形骨骼裡 34 根 local rest 帶旋轉，這個不對稱存在於官方包裡面，
不是任何中間環節造成的。

**授權條款**（引自包內 `Readme_VRMA_MotionPack_EN.txt`，該檔載明「使用即視為同意」）：

- 著作權屬 pixiv Inc.，改作與否皆然
- 可自由改作，個人或法人商用皆可，需標注 credit
- 禁止項含：**未經許可，以可被綁定（rigged）或提取（extracted）的形式散布這些動作或其改作**；
  用於特定宗教或政治目的；用於性或顯著暴力內容；侵害第三方權利

以 `/avatar/animations/*.vrma` 直接提供檔案屬於「可提取的形式」。使用者於 2026-08-19
聲明已取得 bundle 官方動作的授權，正對應該條的「未經許可」例外，據此實作。

**credit 字串有兩個官方英文版本**，兩邊都是 pixiv 自己的文字：BOOTH 商品頁寫
`Character animation credits to pixiv Inc.'s VRoid Project`，包內 readme 寫
`Animation credits to pixiv Inc.'s VRoid Project`。日文版兩邊一致，是
「キャラクターアニメーション: ピクシブ株式会社 VRoidプロジェクト」。站上採用 BOOTH
商品頁那一版，因為它是現行的店面文字，也比較貼近日文原句的 キャラクター。
這是刻意的選擇，不要「修正」成 readme 那版。

實測每個動作 retarget 到 `AvatarSample_B_webp.vrm` 之後的空間佔用。

**左右是畫面的左右，不是她的左右。** `rotateVRM0` 把她轉過來面對鏡頭，所以她的右手
出現在觀眾的左邊，probe 空間的 `+x` 對應畫面左側。這一條在 code review 第三輪才被
抓出來：原本的 `reachRight` 記的是 `max(probe x)`，濾的是完全沒被切到的那一側。
跨越邊界的推理都走 `rigProbe` 的 `screenX()`，不過那個過濾本身當天就被移除了。

畫框：launcher/docked 是 y 0.768–1.872、兩側都是 ±0.742；fullscreen column 是
y 0.430–1.602、兩側 ±0.675。兩側同一個預算，理由見「畫布寬度過濾的生與死」。

waist-up 的上下緣 2026-08-20 從 0.618–1.722 整段抬高 0.15，見下方「上緣切手」。

量測採樣的是**全部十六個手部關節加上手臂、腿、頭的輪廓骨**。第四輪之前只採樣手腕與
食指指尖，那個窄採樣正是 `shoot` 通過認證的原因（見下表後）。

**採樣的是關節座標，不是皮膚表面。** 這個模型的指尖 end node 落在 distal 關節之外
約 0.020m，所以 guard 讀到的值比實際輪廓保守。`spin` 是唯一逼近邊界的一支：guard
讀 0.658，蒙皮後的實際極值約 0.674，離畫布邊 0.6mm（342px launcher 畫布上約 0.15px）。
它沒有越界，但那 16mm 不能當成餘裕看。彈簧骨頭髮不在任何量測範圍內。

| 動作 | 時長 | 畫面左伸 | 畫面右伸 | 髖部下沉 | 手部對臉 | 掌心 | 轉身° | 判定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `peaceSign` | 11.7s | 0.587 | 0.444 | 0.056 | 2.02 | 0.96 | 23 | bundled |
| `modelPose` | 7.5s | 0.318 | 0.286 | 0.019 | 12.39 | 0.35 | 33 | bundled |
| `spin` | 9.3s | 0.658 | 0.509 | 0.048 | 6.33 | 0.98 | 178 | bundled |
| `shoot` | 9.6s | 0.462 | 0.231 | 0.048 | **0.90** | 1.00 | 23 | 排除 |
| `greeting` | 7.3s | 0.438 | 0.548 | **0.573** | **0.65** | 1.00 | 15 | 排除 |
| `squat` | 11.5s | 0.622 | 0.616 | 0.218（是動作本身） | 2.69 | 0.23 | 4 | bundled |
| `showFullBody` | 11.8s | **0.713** | 0.588 | 0.057 | 37.99 | **0.32** | 179 | 排除 |

**`shoot` 是這一輪最重要的一筆，因為它一路通過認證、進了 staging，差一步就發佈。**
（本輪工作至今一次都沒有 commit，所以沒有訪客看過它；說它「已經上線」是錯的。）
把採樣從「手腕＋食指指尖」擴大到全部十六個手部關節之後，它的右拇指在 t=3.35–3.60s
（577 格裡的 16 格）落在臉的橢球內，徑向最深 **4.9mm**（沿座標軸分別是 6.8／8.8／
8.0mm）。只看食指它是 1.19，乾乾淨淨。Mutation 兩邊都驗過：擴大採樣把 `shoot` 加回去，
穿臉那條轉紅；把採樣縮回食指指尖，同一支 clip 立刻變綠。

（那個 4.9mm 我第一次寫成「7–10mm」，是拿 k=0.900 線性外推而沒有去讀腳本印出來的
實際距離。橢球是內接在臉部網格 bounding box 裡的，離軸方向會低估頭的實際範圍，
所以真正的穿透只會比 4.9mm 更多，不會更少。）

「指尖對臉」是橢球方程式值，1 是臉的表面，小於 1 代表插進臉裡。上表是用
`rigProbe` 的 `sampleTimes`（全部軌道 key time 的聯集：`peaceSign` 702、
`modelPose` 452、`spin` 560、`shoot` 577）重測的，與 `rigProbe.test.ts` 各道防線讀的
是同一組數字。

畫框的門檻本來想做成**看得見的**半寬：fullscreen column 的畫布刻意超出視窗右緣，
所以右側有一段在螢幕外。這條路走過兩個版本，最後在同一天被需求本身推翻，過程記在
下面「畫布寬度過濾的生與死」，這裡只留結論：**認證的門檻就是畫布半寬**，畫布之外的
事情由擺位負責，不由動作池負責。

當時量到的可見半寬仍然有用，因為它是 sign error 那條線的證據：

| 視窗 | column 畫布 | 當時的可見半寬 | peaceSign（畫面右伸 0.444） |
| --- | --- | --- | --- |
| 1920×1080 | 1136px | 0.6365 | 裝得下 |
| 1440×900 | 929px | 0.6281 | 裝得下 |
| 1024×768 | 606px | 0.6033 | 裝得下 |
| 900×900 | 390px | 0.5639 | 裝得下 |
| 768×1024 | 160px | 0.4051 | 切掉 0.039 |

768×1024 是 iPad 直立開全螢幕聊天。落在螢幕外那一段裡的是她的**左**手：peaceSign
畫面右側的極值點是 `leftMiddleDistal`。這張表在第四輪之前自己就把邊講反了一次，
寫成「她的右手」。

第一版把 1440×900 當成「column 最寬的情況」，那句話是錯的：畫布寬同時隨視窗高變大、
隨視窗寬變小，1440×900 只是中間的一點。

**`spin` 的排除理由本來是錯的。** 第一版說它「橫向伸到 0.658，超出 column 可見半寬
0.628 所以會被切掉」。實際上那 0.658 在她的右手，也就是畫面左側，而畫面左側整塊都在
螢幕上；它朝畫面右側只伸到 0.509，裝得下。修正 sign 之後 `spin` 通過全部寬高檢查。

第三輪我改用另一個量測來擋它：`spin` 的髖部偏航從 −178° 掃到 +175°（`showFullBody`
是 −179° 到 +178°，其餘五支都在 ±33° 內），於是加了第七道防線
`MAX_BODY_TURN_DEG = 90`，理由是「她會把背轉向正在對話的人」。

**那道防線在第四輪被移除了。** 擁有者於 2026-08-19 指出，判準只看動作**做得到不到位**，
不看這個動作**適不適合**一個聊天嚮導；轉身多少度屬於後者。`MAX_BODY_TURN_DEG` 與
`bodyTurnDeg()` 一併刪除，轉身角度只留在上表當資料。`spin` 在所有到位性量測上通過，
因此進入動作池。

`greeting` 是這一輪最反直覺的一筆：它是官方動作，畫框也裝得下，但髖部從 y=0.306
起步，前四秒她整個人從地板升起來，而且 t=6.06s 有一根指尖穿過臉頰。第一版計畫把它
列為可用，是照著寬高判斷而沒有量髖部；驗證層補上 hips sink 這條之後才擋下來。

上表的 `modelPose`／`spin`／`squat`／`showFullBody` 四筆在 code review 之後重測過。
`rigProbe` 原本直接把 .vrma 的原始四元數寫到骨頭上，漏了
`VRMAnimationLoaderPlugin` 會先做的 rest-frame rebase（`q_parent · q_raw · q_bone⁻¹`）。
對 rest 姿態是 identity 的檔案（`peaceSign`／`shoot`／`spin`／`greeting`）兩者等價，數字沒變；
`modelPose` 的 52 根人形骨骼裡有 34 根 local rest 帶旋轉，累積到 world 之後 52 根
全部不是 identity（rebase 除掉的正是 world 這一層）。漏掉這一步會把她解成「腳在頭上、
身體前傾 90 度」的姿勢，而那個姿勢很窄，**原本五道防線全部照樣綠**。補上 rebase 之後
另外加了第六道「解剖直立」防線，它是唯一抓得到這種錯的。

## 做完的內容

1. **驗證層** `rigProbe.ts`：從 GLB 的 JSON chunk 重建 three-vrm 的 normalized rig，
   在 Node 裡做 FK，不需要 WebGL，整套在一秒多跑完（測試條數會隨後續改動變動，
   刻意不寫死在這裡：這份文件的數字在本次任務中已經因為抄寫而過時三次，
   凡是會漂移的計數一律不進散文）。防線：穿臉、出框（左右各自的預算）、掌心朝向、
   髖部下沉、首尾站姿、解剖直立。

   **不同的防線要用不同的 mutation 才打得到**，這點寫錯過一次：
   - 加回 `greeting`＋`squat` → 5 條紅：greeting 穿臉／站高／首尾站姿，
     squat 掌心／站高。
   - 加回 `shoot` → 穿臉那條轉紅（拇指 0.90）。把 `handJoints()` 縮回只回傳食指
     指尖，同一支 clip 變綠——這證明「擴大採樣」本身是承重的，不是裝飾。
   - 加回 `showFullBody` → 出框與掌心兩條紅。
   - 拿掉 `screenX()` 的負號（重現 code review 抓到的那個 bug）→ **不會轉紅**。
     過濾拿掉之後左右兩側讀的是同一個預算，翻號只是把兩個數字對調。這是這次改動
     真正的代價，明寫在此：`screenX` 的方向現在沒有任何測試綁住，它只剩文件價值。
   - 拿掉 rest-frame rebase → 「解剖直立」轉紅，其餘照樣綠。
   前兩組需要把被排除的 .vrma 放回 `public/`，不能只靠 repo 重現；`guard sensitivity`
   那四條合成姿勢測試留在 repo 裡，作用是讓每一種量測都有一筆 in-repo 的紅證據。
2. **播放管線**：`@pixiv/three-vrm-animation` 的 `createVRMAnimationClip` 加
   `AnimationMixer`。clip 在 materialize 結束後才抓（2.49MB 落在 5.5MB 模型之後），
   播放期間程序式的 head／neck／spine／chest／hips 寫入依 `1 - getEffectiveWeight()`
   按比例讓位（不是整段關掉，否則播放期間的摸頭會被吞掉），表情與口型不受影響。
   四個出入口全部是 fade：進場 `fadeIn(0.25)`、摸頭打斷 `fadeOut(0.25)`、
   切 mode 打斷 `fadeOut(0.3)`、**自然結束在最後 0.25 秒 fadeOut**。最後這個原本是
   硬切：clip 末格的手腕離 `ARM_PINS` 最遠 0.097m（`peaceSign`，launcher 畫布上約
   25px），`stopMotion` 一格拉回去。three 的 `PropertyMixer` 會把淡出中的 action
   往「綁定前的值」插值，而那個值正是 pin 好的休息姿勢，所以淡出結束時手臂剛好落在
   `ARM_PINS` 上。
3. **手勢池重整**：10 個手臂手勢連同 `ARM_GESTURE_PEAKS`／`armAt`／`poseReach`／
   `setHand` 等整套手臂 FK 模型一併移除；idle 池現在是三分之二機率抽動捕、
   三分之一抽 6 個程序式頭／軀幹小動作。
4. **credit**：`ContactFooter` 的 footer，與既有的 VOICEVOX 聲音 credit 並排。
5. **changelog**：`mika-motion-capture` 條目，en／zh-TW／ja 三個語系。專案規則說
   changelog 只寫重大變更、不確定就先問，使用者於 2026-08-19 回覆「可以寫」。
   舊條目照專案慣例不改寫，所以 `avatar-guide-3d` 那則仍以現在式描述「十六種小表演」
   裡已被刪掉的八個手臂手勢；新條目的作用就是接續它。

### 順手修掉的既有錯誤（範圍外，明列於此）

`avatarMode.ts` 的註解裡有三處數字在本輪之前就已經錯了，正確值本來就寫在旁邊的
程式碼字面量裡。因為要修「that reach」這個由本輪造成的懸空指涉，同一塊註解會被重寫，
留著已知錯誤的數字只會誤導下一個讀的人，所以一併更正：

| 位置 | 原文 | 實測 |
| --- | --- | --- |
| column framing 註解 | 手臂空間 `0.484m` | `0.674m` |
| canvas boxes 註解（docked 段） | `±0.484m`、`491/560` | `±0.674m`、`684/560`（`AVATAR_CANVAS_DOCKED` 就是 `{684, 560}`） |
| `AVATAR_COLUMN_ASPECT` 上方註解 | `±0.484m` | `±0.6745m`（下一行的字面量就是 `0.6745 / 0.586`） |
| `avatarSizeClass` 上方註解 | `70.14vh = 80vh × 491/560` | `97.71vh = 80vh × 684/560`（class 寫的就是 `97.71vh`） |

四處都只是註解，沒有任何行為改變。第二列與「that reach」在同一段，是為了修那個
懸空指涉必須重寫的句子；其餘三處是同一批數字散落在別段。

## 畫布寬度過濾的生與死（2026-08-19，同一天）

過濾在早上出生：`motionsFor(placement, canvasW)` 拿每支動作朝畫面右側伸多遠，比對
「這塊畫布看得見多少」，裝不下的就不給 idle picker 抽。它擋的是 column 畫布超出視窗
右緣那一段——動作伸進那一段就會被硬生生切掉。

當天下午使用者看了 1920×1080 的全螢幕截圖，說 Mika 右側還空著一大塊，要她更貼右緣，
並且明講「如果擺動作會被畫面截掉的話也沒關係」。**這句話把過濾的存在理由整個拿掉了**：
它守的正是「不要被截掉」，而截掉現在是被接受的結果。留著它只會在她越貼邊、看得見的
寬度越小的時候，把動作一支一支關掉——需求要她貼邊，程式碼卻因為她貼邊而變安靜。
所以 `screenRightReach`、`columnVisibleHalfWidth`、`motionsFor` 的寬度參數一起刪除，
認證門檻回到畫布半寬。

代價明列：`screenX()` 的方向現在沒有測試綁住（見上面 mutation 清單那一條）。

### 擺位改成量出來的

`AVATAR_COLUMN_RIGHT_INSET = -32` 這種固定 px 做不到「每個尺寸都貼齊」，因為畫布外圍
那圈透明手勢空間是隨畫布寬縮放的。第一版換成隨寬度計算，但用了
`AVATAR_COLUMN_BODY_FRACTION` 並假設她置中，推出來的邊在 0.787——**實際量測是 0.6965**，
她在 1920×1080 上因此離面板內緣還有 100px。這個數字是從 Playwright 截圖數像素數出來的：
以面板背景色為底，找出她最右邊那一欄非背景像素。三張連拍給 0.6947／0.6965／0.6965，
1440×900 另外四張落在 0.6978 以上，所以常數取 0.70。

`AVATAR_COLUMN_BODY_FRACTION` 沒有動：它回答的是「文字要讓開多少」，本來就帶著超出
她輪廓的緩衝，把它當成她的輪廓用才是這次的錯。兩個問題各自有各自的常數：

- `AVATAR_COLUMN_BODY_RIGHT = 0.70` — 她休息姿勢的右緣落在畫布寬的幾分之幾（量出來的）
- `AVATAR_COLUMN_BODY_GAP = 32` — 她的右緣與面板內緣之間留多少（是唯一的品味參數）

貼齊到 0px 的版本先做出來給使用者看過，回覆是「有點太右邊」，才有 32px 這個 gap。

實測（`right` 是 DOM 上讀到的 inline style，身體右緣＝畫布右緣 − 畫布寬 × 0.30）：

| 視窗 | column 畫布 | inline right | 身體右緣 | 面板內緣 |
| --- | --- | --- | --- | --- |
| 1920×1080 | 1136.05px | -292.818px | 1872.00 | 1904 |
| 1440×900 | 928.88px | -230.66px | 1392.00 | 1424 |
| 768×1024 | 160.25px | -0.075px | 720.00 | 752 |

768×1024 剛好落在夾擠邊界上：那塊畫布的透明邊只有 48px，扣掉 16px 面板內縮與 32px
留白之後幾乎不需要外掛，`Math.min(0, …)` 把它夾在 0。

### 接線層另外釘了一條

`avatarColumnRightInset` 的算術由 `avatarMode.test.ts` 綁住，但「ChatWidget 有沒有真的
把畫布寬餵給它」是另一回事——寫死一個常數在那裡，單元測試照樣全綠。所以
`ChatWidget.test.tsx` 多了一條端到端：把 capability gate 打開（stub 掉 WebGL2 探測）、
mock 掉 `AvatarGuide` 本體、在 1920×1080 下真的開全螢幕，讀 DOM 上的 inline `right`。
把那行換成 `-48` 或整個拿掉，這條轉紅，兩種都驗過。

範圍外、已知、沒動：768×1024 時 `avatarColumnBox` 把她縮到 160×139px，她會疊在輸入框
上方。那是既有的縮放行為，這次改動只讓她從「超出面板 16px」變成「面板內縮 32px」。

## `squat` 補進池子（2026-08-20）

使用者指出七支官方動作只進了三支。重新量測四支被排除的，結論是**其中一支的排除理由
本來就是錯的**：

| 動作 | 實際擋住它的東西 | 判定 |
| --- | --- | --- |
| `squat` | `MAX_HIPS_SINK` 把「刻意蹲下」當成「retarget 沉底」 | **加進來** |
| `showFullBody` | 畫面左伸 0.713 對 0.675 預算，709 格裡 54 格（t=1.42–2.30s） | 維持排除 |
| `greeting` | 開場髖部低 0.568m 並花 2.4s 站起；另有指節深入頭部 17.0mm、67 格 | 維持排除 |
| `shoot` | 右拇指入臉 4.9mm，577 格裡 16 格（t=3.35–3.60s） | 維持排除 |

`MAX_HIPS_SINK` 原本套在**每一格**上。它存在的理由寫在自己的註解裡：
three-vrm-animation 依兩具骨架的靜止高度縮放髖部軌道卻不重新落座，所以站姿會整個
沉下去。那是 retarget 的錯，不是動作的錯——而一個蹲下的動作，髖部本來就要下去 0.218。
用同一個門檻同時管兩件事，等於規定她不准蹲。

拆成兩道，各自有各自的紅：

- **首尾站姿**加驗髖部高度：clip 的第一格與最後一格必須落在她自己的靜止高度
  ±`MAX_HIPS_SINK` 內。retarget 沒落座的錯一定在這裡現形，因為開場與收場都是站姿。
  `greeting` 開場低 0.568，直接紅。
- **不准沉出畫面**：每一格的髖部要高過該畫框的下緣（waist-up 0.768、column 0.430）。
  這是管「動作做了什麼」的那一道。`squat` 最低 0.660，只有 column 過得了，所以它是
  column-only。

Mutation（`greeting` 需要把 .vrma 放回 `public/`，repo 裡沒有）：

- 加回 `greeting` → 三條紅：穿臉、首尾站姿、沉出畫面。
- 加回 `greeting` 並**刪掉**首尾的髖部斷言 → 穿臉與沉出畫面仍紅（兩道互不遮蔽）。
- 加回 `greeting` 並把沉出畫面的預算改成 `-Infinity` → 穿臉與首尾站姿仍紅。
- 加回 `showFullBody` → 只有出框那條紅。
- 加回 `shoot` → 只有穿臉那條紅。

**沉出畫面這道在 repo 內沒有紅證據**，因為池子裡唯一往下走的 `squat` 距 waist-up
下緣還有 0.042。合成姿勢那條（`sees hips dropped through the bottom of the crop`）
釘的是量測，不是門檻：把門檻放寬它照樣綠，這一點寫在它自己的註解裡，不假裝它有守住。

`squat` 的 `showsPalm` 是 false：它的最佳掌心朝向只有 0.23，而它本來就不是一支要讓
觀眾讀手的動作。檔案是官方包的 `VRMA_07`，sha256 `b0096525…`，771,944 bytes，
與 `VRMA_MotionPack.zip` 裡的原檔逐位元相同。

### `squat` 的端到端驗證

`?mikadebug=1` 的 probe channel 多了一個 `hipsY`（髖部世界高度）。加它的理由是
probe 只證明「Node 裡的 FK 這樣算」，證明不了「引擎有沒有真的套用髖部位移軌道」——
如果 `createVRMAnimationClip` 漏掉那條軌道，蹲下會變成原地屈膝，probe 完全看不到。

引擎實測（dev server + Playwright，用 `__mikaHandle.playMotion('squat')` 直接驅動，
不等隨機 idle picker）：

- `motionClips: 4`，四支 `.vrma` 全部 200 且建成 AnimationClip
- 髖部 0.878 → **0.660**，下沉 0.218，最低點在 t=6.7s，clip 全長 11.6s 牆鐘
  ——與 Node probe 的預測逐位數相同，所以引擎與 probe 用的是同一套 retarget 數學
- 截圖比對：靜止時輪廓頂端 y=538，蹲到最低 y=593，**下降 55px**，人仍完整在框內
- 放著不動 150 秒，idle picker 四支都抽到：`peaceSign`×3、`squat`×3、`spin`×3、
  `modelPose`×1

過程中修正過一次自己的錯誤：第一次的「靜止基準」截圖其實是蹲到一半拍的，兩張只差
2px，差點得出「引擎沒套用髖部軌道」的結論。基準是靠 `__mikaState.motion` 為 null
才確定下來的。

## 再補六支，並引入 waiver（2026-08-20）

使用者要求把 `semperai/amica` 與 `heshengtao/super-agent-party` 兩個 repo 裡、官方包
以外的六支一併加入。池子從 4 支變成 10 支，`.vrma` 總量 4.67MB（模型本身 5.23MB），
全部 lazy load，不進首訪關鍵路徑。

先各量一輪。四支乾淨：

| 動作 | 時長 | 畫面左／右伸 | 最高手 | 掌心 | 判定 |
| --- | --- | --- | --- | --- | --- |
| `akimbo` | 10.7s | 0.250／0.274 | 0.938 | -0.15 | 全數通過 |
| `playFingers` | 4.8s | 0.233／0.234 | 0.954 | -0.10 | 全數通過 |
| `scratchHead` | 6.4s | 0.347／0.495 | 1.534 | 0.89 | 全數通過 |
| `idleLoop` | 10.4s | 0.337／0.035 | 0.768 | 0.28 | 髖部偏移 0.152 |

兩支帶著實測瑕疵：

| 動作 | 瑕疵 | 實測 |
| --- | --- | --- |
| `stretch` | 手高過畫框上緣 | 1.785 @1.87s；超出 waist-up 上緣 0.063（137 格裡 80 格）、超出 column 上緣 0.183（90 格） |
| `dance` | 手進入頭部 | 0.488 = 26.8mm，15 格 @8.23s（`shoot` 被擋下時是 4.9mm） |
| `dance` | 畫面左伸出畫布 | 0.6800 對 0.6745，超出 5.5mm，2 格 |
| `dance` | 收場姿勢不是站姿 | 髖部偏移 0.140、右手腕停在 1.188（門檻 1.05，fade 只有 0.25s 可走） |

### waiver：例外要申報，而且要被釘住

把斷言改鬆是最省事的做法，也是最糟的：門檻一旦變大，所有動作都跟著鬆，而且沒有人
知道當初鬆了多少。改成每支動作在 `AvatarMotionDef.waiver` 裡申報自己的實測最差值，
測試對每一項各驗兩件事：

1. 不得超過申報值——`stretch` 申報 1.79，實測 1.785，把申報值收到 1.78 就轉紅。
2. **申報了卻用不到就算錯**——把任何一項掛到乾淨的 `akimbo` 上，該條立刻轉紅。

第二件是重點：沒有它，waiver 就是一個沒人會清掉的後門，clip 換檔之後舊的例外還留著
繼續放寬門檻。有了它，例外每一次跑測試都要重新證明自己還需要存在。

五個欄位：`handTop`、`handInHead`、`reach`、`hipsDrift`、`endWrist`。十條 mutation
（五項各收緊一次、五項各掛到 `akimbo` 上一次）全部驗過會紅。

### 這一輪自己抓到的兩件事

- 臨時寫的 audit 腳本只量了畫框、穿臉、髖部下沉，**漏掉收尾姿勢**。真正的測試跑下去
  才抓到 `idleLoop` 與 `dance` 的髖部偏移，以及 `dance` 收場時手腕停在 1.188。
  教訓：驗收要跑真正的 guard，不要跑自己另外寫的簡化版。
- `dance.vrma` 的 `VRMC_vrm_animation` 缺 `specVersion`，載入時 three-vrm 會警告一行
  「Consider updating the animation file」，假設 1.0 後照常運作。其餘九支都有。

### 引擎端驗證

- `motionClips: 10`，十個 `.vrma` 全部 200
- 逐支用 `__mikaHandle.playMotion()` 驅動，十支的髖部高度都會動，
  `rightUpperArm` 的 z 也都離開靜止值 -0.763（`dance` 最大到 -1.368，`stretch` -1.147），
  所以手臂確實由 clip 驅動
- **當時未驗**：`stretch` 手過頂那一格的實際畫面。截圖與 evaluate 是兩次往返，兩次都
  落在接近靜止的格子上，追第三次沒有意義。1.785 是 probe 的數字，而 probe 與引擎在
  `squat` 的髖部上已經對到小數第三位。
  **這個缺口就是下下節的起點**：那一格拍到之後，手是被切的。改用固定間隔重播加連拍
  才穩定抓得到峰值，見「上緣切手」。

## 畫面左緣被截：root cause 是量錯了，不是擺錯了（2026-08-20）

使用者回報「我的左邊（Mika 的右邊）邊界不夠遠，有些動作會被截掉」。

**root cause：`rigProbe` 量的是 distal 指節，畫出來的是皮膚。** 這個模型的
`J_Bip_R_Index3` 底下還有一個 `J_Bip_R_Index3_end`，離它 **20.4mm**（中指 21.0mm），
而且幾乎整條都落在手指自己的 +X 軸上，也就是她的右、畫面的左。池子裡每一支寬動作的
極值骨都是 `rightIndexDistal`，所以每一次側向量測都系統性地少算約 20mm——**正好就是
使用者看到被截掉的那一側**。

這件事本來以散文形式寫在 `avatarMode.ts` 的註解裡（「不要把剩下的 16mm 當餘裕」），
寫對了，但沒有變成量測，所以測試照樣全綠。

改用皮膚指尖之後，數字整個變樣：

| 動作 | 舊量法（distal 關節） | 新量法（皮膚指尖） | 對舊畫布 0.6745 |
| --- | --- | --- | --- |
| `dance` | 0.6800 | **0.6978** | 超出 23.2mm |
| `spin` | 0.6583 | **0.6740** | 只剩 **0.5mm** |
| `squat` | 0.6221 | 0.6296 | 餘 45mm |
| `peaceSign` | 0.5875 | 0.5998 | 餘 75mm |

`spin` 從 2026-08-19 起就是這樣在跑的，一路綠燈。

### 修法：量準，然後把框放寬

1. **指尖進骨架。** `buildRig` 為每個 `*Distal` 骨骼補一個 tip 節點，位置沿用同一條
   規則（相對父骨的 rest world 偏移、rest 旋轉 identity）。`handJoints` 每根手指因此
   回四個點而非三個，`probeHand.fingertip` 改讀 tip。
2. **手臂空間 0.6745 → 0.7415**（+67mm），三個 placement 同步，並收斂成單一常數
   `AVATAR_ARM_ROOM`，欄位 aspect 與測試都從它推導。之後 `dance` 餘 44mm、`spin` 餘 68mm。

連動常數全部重推，沒有一個是猜的：

| 常數 | 舊 | 新 | 依據 |
| --- | --- | --- | --- |
| `AVATAR_CANVAS_LAUNCHER.w` | 342 | 376 | 高度不動，寬度 ×1.10 |
| `AVATAR_CANVAS_DOCKED.w` | 684 | 752 | 同上 |
| `AVATAR_COLUMN_ASPECT` | 0.6745/0.586 | `AVATAR_ARM_ROOM`/0.586 | 手臂空間 ÷ 半高 |
| `AVATAR_COLUMN_BODY_FRACTION` | 0.5741 | 0.5222 | 身體公尺數不變 ÷ 新畫布公尺數 |
| `AVATAR_COLUMN_BODY_RIGHT` | 0.70 | 0.6819 | 身體右緣離中心的公尺數不變 |
| `AVATAR_LAUNCHER_BODY_FRACTION` | 0.415 | 0.3775 | ×342/376 |
| `AVATAR_LAUNCHER_HIT_INSET_PCT` | 24 | 26 | 點擊區絕對寬度維持（實測 180px vs 178px） |
| `AVATAR_BUBBLE_RIGHT_PX` | 256 | 273 | 對話框仍在身體左緣外 14px |

**欄位加寬是免費的**：`hFromWidth = budget / (aspect × bodyFraction)`，aspect 乘上 k、
bodyFraction 除以 k，乘積不變，所以她的尺寸、文字 reserve、文字位置全部不動。多出來的
寬度一半掛到螢幕外的右側，一半變成畫面左側的手勢空間。1920 實測：畫布 1136→1249px，
左緣 1076.8→1020（多 56.8px），身體右緣仍在 1872。

**docked 有一個要付的代價，已明寫。** `besidePanelScale` 原本用整塊畫布寬當分母，畫布
一變寬，1120px 的視窗會把她縮小 9%——為了保護透明像素而讓她變小。所以分母改成一個具名
常數 `DOCKED_ON_SCREEN_W = 684`：這個縮放保護的是她的**身體**，透明邊掛出螢幕是可以的
（使用者 2026-08-19 已接受手勢被截）。對應的測試也從「畫布不出界」改成「身體不出界」，
並且反過來釘住「在 880px 時畫布確實出界」，免得斷言被悄悄放寬。

### 一個差點漏掉的破口

六條 mutation 跑下來，**「把指尖從 `handJoints` 拿掉」竟然全綠**。原因是框放寬之後，
所有動作有沒有指尖都過得了關——也就是說這次修的東西自己沒有被任何測試釘住，改回去
不會有人發現。補上 `measures a finger to its skinned tip, not to its last joint`：
直接斷言 tip 離 distal 20.4mm、tip 比 distal 更遠離中心、而且 `handJoints` 真的有回傳
它。補完之後那條 mutation 轉紅。

其餘 mutation：拿掉 tip 骨骼（2 紅）、手臂空間改回 0.6745（3 紅）、launcher 寬度改回
342（4 紅）、docked 寬度改回 684（5 紅）、把 `dance` 已不需要的 reach waiver 放回去
（1 紅，「申報了卻用不到」那條）。

### waiver 隨之重算

- `dance` 的 `reach: 0.69` **刪除**：新框之下用不到，而用不到就是測試失敗。
- `dance` 的 `handInHead` 0.48 → **0.29**：指尖納入量測後，入頭深度從 26.8mm 變成
  **38.9mm**、15 格變 18 格。這個數字是變糟的，不是變好。
- `stretch` 的 `handTop` 1.79 → **1.77**：加寬買的是側向空間，不是高度，它照樣過頂。
  （這條 waiver 在下一節被刪掉：畫框抬高之後它不再過頂，而用不到的 waiver 是失敗。）

## 上緣切手：同一個 root cause 的垂直版（2026-08-20）

使用者回報「Mika 伸懶腰的時候手會往上舉，上方也會把手勢截掉」。

**root cause 是同一條：量的是關節，畫出來的是皮膚。** 側向那一輪補了指尖 tip 骨頭，
垂直這一輪暴露出它只補了一半。兩個量測破口疊在一起：

1. **頂端 guard 只採樣手腕與食指指尖。** `stretch` 的最高骨頭是**拇指**尖
   `leftThumbTip` 1.7971，guard 讀到的是 1.7698，短了 27mm，而畫框正是照那個小數字
   調的。改成採樣全部十六個手部關節。
2. **皮膚仍在骨頭之外。** 補完採樣把畫框抬到上緣 1.8133、比骨頭峰值高 16mm 之後，
   瀏覽器上還是切：launcher 畫布最上面一列有 10 個她的像素。實測皮膚比最高關節再高
   **12mm**（rendered top 1.8091），16mm 的餘裕被吃掉大半，加上反鋸齒就壓到邊。

第 2 點寫成常數 `SKIN_ABOVE_JOINT = 0.012`，頂端 guard 比的是**皮膚**而不是骨頭。

### 高度不像寬度，不是免費的

側向那輪把畫布加寬是零成本的（aspect 乘 k、bodyFraction 除以 k，乘積不變）。垂直沒有
這個對應：可見高度 `2·distance·tan(fov/2)` = 1.104m 由 fov 與距離決定，而距離同時決定
她畫多大；docked 畫布的高度又綁在面板上不能長。**唯一能動的是這 1.104m 擺在哪裡**，
也就是 `lookAtY`，而且上緣升多少下緣就跟著升多少。

所以它是推出來的，不是喬出來的。waist-up 池子的兩端：

- 上緣 ≥ **1.8091**（`stretch` 的手，皮膚不是骨頭）
- 下緣 ≤ **0.8225**（`peaceSign` 的髖部，把 `dance` 移出池子之後最低的一支）

窗口 1.2569 ≤ `lookAtY` ≤ 1.3747，取中心四捨五入到 10mm：**1.17 → 1.32**，
上緣 1.8722、下緣 0.7682，手上餘 63mm、髖下餘 55mm。

### 帳單

| 動作 | 變動 | 原因 |
| --- | --- | --- |
| `squat` | waist-up 移除，column-only | 髖部 0.660 低於新下緣 0.768 |
| `dance` | waist-up 移除，column-only | 髖部 0.7525，留著它上下緣只剩 4mm |
| `stretch` | column 移除，waist-up-only | column 上緣 1.602 撐不住，抬它要放棄全高構圖 |

靜止時她頭頂上的空白從 35px 變成 74px（280px 畫布）。那不是留白失手，那就是舉手要用的
空間：一支比頭頂高 0.23m 的手勢，畫框不預留就是切。

### Mutation

- `lookAtY` 壓到 1.253（上緣 1.8052，夾在骨頭 1.7971 與皮膚 1.8091 之間）→
  `stretch highest hand in waistUp` 紅。這是「guard 讀皮膚」唯一能被單獨釘住的位置。
- 同一個畫框把 `SKIN_ABOVE_JOINT` 改成 0 → 66 條全綠。那 12mm 就是那條線本身。

### 瀏覽器實測

launcher 畫布 376×280（253.5 px/m），用 5 秒間隔重播 `stretch`（clip 長 4.53s，不會有
兩份疊在一起）連拍 8 張，逐列找「同一列連續亮點 ≥ 6px」以避開背景星點與左側對話框。
最高的一格她的頂端落在畫布第 16 列，離上緣 63mm，沒有觸邊。峰值是 1.5s–2.4s 的平台區，
5mm 內平坦，所以連拍抓得到。

## 收尾太快：固定時間的線性 cross-fade（2026-08-20）

使用者回報「比完動作之後回到原始站姿時，有點不自然或者說有點太快」。

**root cause 是收尾用固定 0.25 秒的線性 cross-fade。** 兩件事同時錯，都是在跑起來的頁面
上量到的，不是推測：

1. **線性 weight 斜坡在兩端都有速度斷點。** 錄到的軌跡裡，她的左上臂在 clip 最後一秒
   每格漂移 0.0011 rad，第一個 fade 格就跳到 0.0137——一格之內快十二倍——然後精確維持
   這個速度十五格，再瞬間停住。活的東西不會這樣起步與煞車。
2. **固定時間配上會變的距離。** clip 的最後一格不等於站姿，兩者差多遠是 clip 的性質：
   `squat` 0.060m、`dance` 0.540m（手腕位移）。同樣 0.25 秒，速度差九倍，所以同一個
   收尾在某些 clip 後面像放鬆，在另一些後面像被扯回去。

還有第三件小事：fade 在 `remaining <= 0.25` 才觸發，實際只剩 0.234 秒，所以 clip 結束時
還有約 7% 的權重沒走完，被 `stopMotion` 一格切掉。

### 修法

| 項目 | 舊 | 新 |
| --- | --- | --- |
| 曲線 | three 的 `fadeOut`（線性） | smoothstep，兩端導數為 0 |
| 時長 | 固定 0.25s | `settleSeconds(距離)`，0.4s–0.75s |
| 觸發點 | clip 最後 0.25 秒（重疊） | clip 播完之後（`clampWhenFinished` 撐住末格） |
| 殘留 | 約 7% 權重被切掉 | 權重寫在 `mixer.update` 之前，最後一格就是 0 |

時長的下限 0.4s 是刻意在做主要的事：waist-up 池子八支裡有七支結束時離站姿 0.143m 以內，
只靠速度上限它們會維持原本的時序。0.18m 以上速度接手，那是 `idleLoop`（0.231m）與
`dance`（0.540m）的位置，也就是本來真的在飆的兩支。

### 一個自己種下的 regression

`setEffectiveWeight` 改的是 action 物件上的 `weight` 欄位，而 `mixer.clipAction(clip)` 每次
回傳**同一個** action，`reset()` 不清 `weight`。所以 settle 結束留下的 0 會被下一次
`fadeIn` 乘進去（0 × ramp = 0）：**同一支 clip 播第二次會整支不動**，站十一秒，然後從一個
她從來沒擺出來的姿勢收尾。瀏覽器量到才發現，單元測試碰不到這條接線。修法是 `playMotion`
明確寫回 `setEffectiveWeight(1)`。

### 量到的數字

| clip | 距離 | 舊收尾 | 新收尾 | 起步速度 | 收尾殘留 |
| --- | --- | --- | --- | --- | --- |
| `peaceSign` | 0.097m | 234ms 線性 | **398ms** | 0.0137 → **0.0028** rad/格 | 7% → **0** |
| `idleLoop` | 0.231m | 234ms 線性 | **506ms** | — | 0.0002 rad |

`idleLoop` 拿到的 506ms 與 `settleSeconds(0.231)` 的 513ms 對得上，`peaceSign` 拿到下限
398ms：兩支不同，證明引擎真的量了距離，不是一律吃下限。

### Mutation

- `settleWeight` 改回線性 → 「eases in and out」紅。
- `settleSeconds` 改回固定 0.25 → 四條紅（含 `idleLoop` 與 `dance` 的速度）。
- `SETTLE_MIN` 0.4 → 0.35 或 0.2 → 八條「settles slower than the fade it replaced」紅。
  這條是專門為了釘住下限而寫的：上限太鬆，抓不到它。

## 端到端驗證（production build + vite preview + Playwright）

- 三個 clip 全部下載並建成 AnimationClip（`motionClips: 3`）
- `peaceSign` 播放時右前臂從 rest 的 -0.25 走到 2.384 並保持約 8 秒
- clip 自然結束後手臂精確回到 `ARM_PINS`（-1.15／1.15／-0.25／0.25）
- 播放中切 mode 打斷，fadeOut 後同樣精確回到 `ARM_PINS`
- 放著不動 120 秒完全不碰，idle picker 自主抽了 10 次，三支都抽到：
  `peaceSign` ×4、`spin` ×3、`modelPose` ×3。同一段時間內沒有抽到程序式小動作；
  debug channel 確實會回報 `gesture`（直接呼叫 `playGesture('bounce')` 讀得到），
  所以那是真的沒抽到，不是量測漏掉。clip 本身佔掉大部分牆鐘時間，10 次抽選裡
  一次程序式都沒有仍屬偏低，記錄如實
- placement 三態確實傳到引擎：launcher → beside-panel → column
- footer 的 credit 字串在頁面上
- `VRMLookAtQuaternionProxy` 警告已消除（載入時手動建一個）

未驗證：渲染出來的視覺外觀。Playwright 這裡是 software WebGL 且
`preserveDrawingBuffer: false`，canvas 讀不回像素，截圖也落不到可讀路徑。
姿勢的正確性由 rigProbe 在真實骨架上量測涵蓋，但「好不好看」仍需人眼確認一次。

## `dance` 回到每一個 placement：讓鏡頭替 clip 讓位（2026-08-20）

### 症狀

使用者「等了 10 分鐘都沒有看到 Mika 跳舞」。原因不是隨機沒抽到：同一天上午的
319036b 為了讓 `stretch` 舉高的手不被切，把 waist-up 取景的上緣抬到 1.8722，下緣
跟著抬到 0.768，而 `dance` 的臀部會沉到 0.7525，於是那次修正把 `dance` 的
`placements` 從 `['waistUp', 'column']` 砍成 `['column']`。launcher 與 docked 都用
waist-up 取景，所以那之後只有全螢幕看得到這支 clip。

### 兩個發現，第二個是原本沒人知道的

1. **waist-up 下緣**：`dance` 的臀部在 805 個取樣影格中有 14 格低於 0.76782，
   從 t=7.77s 開始，約半秒。骨架量得到。
2. **column 上緣**：`dance` 的頭髮在 1589 個實際算繪影格中有 98 格高過 column 的
   上緣 1.602，最差 t=12.05 超出 **119.5mm**（2026-08-20 那一輪的取樣；隔天更多次
   掃描把峰值推高了 6mm，見下面的 `crown`）。超出去的是頭髮與髮飾——頭骨本身沒有
   量過、也不主張——但 119mm 這個量級，切線是橫過整個頭頂的，t=12.05 與 t=19.46 的
   截圖都看得到那條平切。**這是當時正在 production 播的**。rigProbe 量不到，因為
   頭髮掛在 spring bone 上，探針沒有物理。

第 2 點是「量測 vs 模型」的教訓：以 bind-pose 的最高髮尖頂點剛體綁到 head bone 推
算，`dance` 只超出 32mm；同一輪實際算繪是 119mm。靜止時 spring 讓髮尖比 bind pose
**低** 29mm，跳起來時甩到 **高** 140mm（以隔天量到的峰值算是 146mm）。差距是四倍，
方向還不固定。

### 做法：MotionPan

clip 可以宣告「播我的時候，這個取景要移動多少公尺」。引擎在 render loop 用
`stepFramePan`（與 `stepHeadAim` 同型的 one-pole，`FRAME_PAN_SMOOTHING = 1.6`）把
`framePan` 推向目標，加在 placement 給的 `lookAtY` 上，clip 一開始收手
（`settleDur > 0`）就推回 0。epsilon 0.2mm 讓它真的停在目標上，不再每格重寫矩陣。

| frame | pan | 依據 |
|---|---|---|
| waistUp | **-0.08** | 把 clip 自己的極值（臀 0.7525、髮 1.7276，相距 0.975m）置中於 1.104m 的視野：中點 1.240，取到 1.24。上下各留 65mm／65mm |
| column | **+0.13** | **不切到頭髮的最小 pan**，也就是這支 clip 能保住的最多腿：column 的餘裕全在下方，每抬 1mm 就少 1mm 的腿。在 +0.13 掃了十八次完整全片，沒有任何一格到 row 0，最壞是 row 3（髮頂 1.7276，離上緣 1.732 還有 4.4mm）。+0.12 沒有實際掃過，是同一個實測髮頂比它的上緣 1.722 高出 5.6mm，守則因此轉紅 |

那 4.4mm 是 crown 門檻計入的**半透明髮尖邊緣**，不是看得見的頭髮：改用 alpha > 128
量，最上緣的像素三次掃描都沒有高過 row 25，離上緣還有 36.3mm。所以守則會在畫面真的
被切之前約 32mm 就先紅——一道守則要錯，就該錯在這一側。而且 `crown` 是手寫的常數，
只有人去重量才會變，薄餘裕付出的是一次重量，不是無聲的迴歸。

改成 +0.16 就是同一支 clip 換成 34mm 髮尖餘裕、少 30mm 腿。兩個值都**看不到膝蓋**：
`avatarMode.ts` 對膝蓋高度有兩個說法（575 行 0.40、283 行 0.43），不管取哪一個都低於
+0.13 的切線 0.560。這個取捨是連續的，沒有兩全的設定，2026-08-21 依擁有者指示選了
保留腿的那一端。

其餘九支 clip 不宣告 pan，鏡頭一動也不動——這是刻意的，取景是為「站著不動」構的，
只有會移動的那一支需要鏡頭配合。實測九支在 column 播完整段，`camLookY` 的最小值與
最大值都是 1.016。

### 取景切換時 pan 用「落地」而不是「緩動」

這是第一版漏掉、由 code review 抓出來的。placement 換取景是**硬切**（1.32 → 1.016，
一格 304mm），pan 卻只用 1.6/s 緩動追過去，而換 placement 並不會停掉正在播的 clip。
實測：跳舞跳到一半按全螢幕，lookAtY 停在 **0.957 約 600ms**，上緣 1.543，正好低於
髮頂 1.7276——修掉的那個切頭 bug 會在這一秒內重現。

所以 `setFraming` 與 `setPlacement` 都在同一格把 `framePan` 直接設成新取景的目標值
（`panTargetNow()`），跟著那個硬切走。兩邊都做，是為了不依賴 AvatarGuide 那兩個
effect 的宣告順序——型別系統並不保證它。

`setPlacement` 這一邊多一道 `motionFrame(next) !== before`。這道判斷不是裝飾：
`ChatWidget` 只在 column 傳 `framing`，所以 launcher ↔ beside-panel 之間只會呼叫
`setPlacement`，那裡**沒有硬切可以藏**。無條件落地會把還在緩動中的 pan 瞬間拉最多
80mm（launcher 上約 20px），把一個原本連續的轉場弄出跳動。實測加了判斷之後，單格
最大變化 4mm，就是正常的濾波步長。

### 引擎接線：一支讀原始碼的測試

`rigProbe.test.ts` 的 `frameFor()` 現在拿**平移後**的取景在量 `dance`，等於那兩條幾何
守則的成立條件變成「引擎真的會平移」。而引擎沒有單元測試（第一行就開 WebGLRenderer，
jsdom 進不去，`AvatarGuide.test.tsx` 直接把整個 handle mock 掉）——把 render loop 那段
pan 刪掉，全套測試照樣綠，兩條守則還會繼續替一支已經不合的 clip 背書。

`avatarGuideEngine.wiring.test.ts` 讀引擎原始碼，釘住把 pan 送到相機的那幾行。它是結構
測試，檔頭寫明了能證明什麼、不能證明什麼：改名字會紅（更新 pattern 即可），刪掉會紅
（不可以）。專案 memory `feedback_injection_bypasses_wiring` 描述的就是這個形狀。

### 實測（Playwright + `?mikadebug=1`，dev server，1440x900）

技術上有一點值得記：**canvas 像素現在讀得回來**。在自己的 rAF callback 裡呼叫
`canvas.toDataURL()` / `drawImage()`，時序落在引擎算繪之後、合成之前，
`preserveDrawingBuffer: false` 依然讀得到內容。上一節寫「canvas 讀不回像素」已經
過時。`__mikaState` 新增 `camLookY`（從 camera 讀回，不是回報算式）。

**vite 在這次任務中兩度供應舊版模組**（memory `project_vite_dev_serves_stale_modules`）。
兩次都是「改完量到沒生效」，`curl` 比對 server 供應的原始碼才發現。下面的數字全部是
清掉 `node_modules/.vite`、重啟、`curl` 確認過供應內容之後、在最終樹上重跑的。

每個 placement 都跑完整 26.8s 並逐格量測最上緣／最低臀：

| placement | canvas | 播放中 lookAtY | 最上緣餘裕 | 臀部餘裕 | 影格數 |
|---|---|---|---|---|---|
| launcher | 376x280 | 1.24 | 78.9mm | 64.7mm | 1619 |
| beside-panel | 752x560 | 1.24 | 80.9mm | 64.7mm | 1618 |
| column | 1021x807 | 1.146 | 4.4mm（看得見的髮 36.3mm） | 192.5mm | 1620 |

三欄的「最上緣餘裕」不能互相比較，也不是固定值。canvas 解析度不同，半透明髮尖能不能
過 alpha > 8 的門檻就不同（launcher 376x280 的一個像素是 3.9mm，column 1021x807 的是
1.5mm）。加上 spring 峰值本來就逐次跳動，launcher 在不同輪次量到 78.9mm 與 110.4mm，
差的是 8 個像素。上表取的是最終樹上同一輪的實測值。

三個 placement 都沒有任何一格被切。clip 結束後相機精確回到 placement 的值
（column 讀到 `=== 1.016`），之後播 `modelPose` 也不再移動。切換路徑另外量了兩條：
launcher → beside-panel（同 frame）單格最大變化 4mm（2026-08-20 量的；該路徑同 frame、
只用這輪未動過的 -0.08，不受 column pan 影響）；beside-panel → column（跨 frame）
在硬切那一格 `camLookY` 直接是 **1.146**，也就是 column 的 1.016 加上 +0.13，1.24 與
1.146 之間沒有任何過渡值——pan 是落地，不是追過去。

`crown = 1.7276` 是 +0.13 下十八次掃描的**觀測最大值**（區間 1.7175–1.7276，相當於
row 3 到 row 10），不是理論上界；+0.16 下另外九次的最大值是 1.7215。spring 由當下的
影格時距驅動，峰值本來就會跳動，量到更高的值要當成結果，不是雜訊——這一輪就是掃到第
十四次才第一次量到 row 3，把先前記的 1.7262 頂掉。

它同時是「alpha > 8/255 的最上緣像素」，計入半透明的髮尖與髮飾邊緣。換門檻量出來的
數字不能互相比較：alpha > 128 的最壞是 row 25，比 alpha > 8 的 row 3 低 32mm。

column 只剩 4.4mm 餘裕，小於觀測到的 10mm 抖動——所以重量時風險是**守則轉紅**，不是
畫面被切（畫面那一側還有 36mm）。而 `crown` 是手寫常數，不會自己變動。模型、clip、
取景任一改變就要重量。

### 已知限制（量過，決定不修）

換 placement 會中斷正在播的 clip，而 pan 在殘影還在的期間就先鬆開。最終樹上逐格量
beside-panel → column：硬切那一格落在 1.146（正確），接著隨 settle 一路降回 1.016，
上緣從 1.732 掉到 1.602，而這段期間畫的仍是 clip 的姿勢，髮頂還在 1.7276 附近。訪客
剛好在頭髮甩到最高的那 ~0.6 秒內切換，就會在這段回程裡看到切頭。

+0.13 讓這個窗口比 +0.16 稍微難躲：上緣只要從 1.732 掉 4.4mm 就碰到髮頂，+0.16 時要
掉 34mm。回程本身也不等長——+0.13 是 1.732 → 1.602 共 130mm，+0.16 是 1.762 → 1.602
共 160mm——但髮頂是在回程剛起步時就被越過的，所以 +0.13 這一側暴露得更早、可見時間
更長。性質不變。

要修的做法是讓 pan 乘上 settle weight，使取景精確追隨畫面上實際畫出來的東西（settle
期間畫的仍是 clip 的姿勢，只是權重遞減）。沒有做，理由是發生條件要「中斷剛好落在那
0.6 秒」，而那一刻畫布本身正在改變大小；這是目前唯一值得考慮的後續。

### 順手量到、但沒有動的事

同一套掃描量了全部十支 clip 在 column 的最高算繪像素：`spin` 1.6053、`playFingers`
1.6053、`scratchHead` 1.6068、`idleLoop` 1.6024，對上緣 1.602 各超出 0.4mm 到 5mm
（2-3px）。這是既有狀態，與這次改動無關，沒有處理。`peaceSign` 1.5748、`modelPose`
1.5806、`squat` 1.5835、`akimbo` 1.5632 都在裡面。`stretch` 只在 waist-up 播，它的最
高點是手不是頭髮，由既有的 handTop 守則涵蓋。

### 守則與 mutation

- `dance stays inside every frame it declares` 現在對照**平移後**的取景，並加量
  `def.crown`（算繪量到的髮頂，1.7276）：拿掉 column pan、改成 +0.10、改成 +0.12
  都紅。
- `dance keeps her hips inside the crop` 同樣對照平移後的下緣：拿掉 waistUp pan 或
  改成 -0.01 都紅。
- `%s declares no pan it does not need`：替 `peaceSign` 加一個不需要的 pan 紅；替
  `stretch` 宣告一個它不播的 frame 的 pan 紅。
- `the idle pool > offers dance wherever she is rendered`：把 `placements` 改回
  `['column']` 紅、把 `dance` 從 `IDLE_MOTIONS` 拿掉也紅——這條直接釘住這次的回歸。
- `stepFramePan` 五條：拿掉 epsilon 紅三條、拿掉 dt 比例紅一條、改成瞬間到位紅兩條。
- `avatarGuideEngine.wiring.test.ts` 七條：刪掉 render loop 的 pan 區塊、`aimCamera`
  拿掉 `+ framePan`、`setPlacement` 不落地、`setFraming` 不落地、`panTargetNow` 寫死
  frame、`panTargetNow` 忽略 settle、`setPlacement` 改成無條件落地（那道 frame 判斷
  自己也要有人釘），各自紅。

上列每一個 mutation 都確認落地（pattern 命中數 ≠ 1 即中止）。

2026-08-21 把 column pan 從 +0.16 降到 +0.13 之後重跑了六條：讀 `avatarMotions.ts`
數值的三條（+0.12、+0.10、拿掉 column pan）各自弄紅 `dance stays inside every frame
it declares`，`stepFramePan` 的三條各自轉紅（拿掉 epsilon 紅三、把 `dt * 1.6` 換成固
定的 `1.6/60` 紅一、改成瞬間到位紅二）。後三條要重跑，是因為它們要靠的斷言
`avatarMode.test.ts` 的目標值這輪從 0.16 改成 0.13——程式碼沒動不代表斷言沒動。

那條 dt mutation 的**寫法有陷阱**：直接把 `dt` 從 `Math.min(1, dt * 1.6)` 拿掉會得到
`Math.min(1, 1.6) = 1`，那是「一格到位」，跟下一條完全同義，而 `covers the same
ground whatever the frame rate` 在它底下照樣綠。要真的破壞比例關係，得換成固定步長。

其餘沒有重跑的是 waistUp pan、`declares no pan`、idle pool 與 wiring 那幾條：它們讀的
值與程式碼這輪一個字未改，而降低 column 上緣只會讓其中會受影響的那些更容易紅。

2026-08-20 那一輪裡**有兩個 mutation 第一次跑是綠的，而那兩次才是該輪最有價值的東西**：

- `setPlacement` 不落地 → 綠。原因是斷言的正則用了沒有邊界的 `[\s\S]*?`，從
  `setPlacement` 一路走進 `setFraming` 的 body，在那裡找到同一行。改成先切出每個
  handler 的 body 再斷言。
- `setPlacement` 改成無條件落地（也就是還原成會跳動的版本）→ 綠。原因是那道 frame
  判斷本身沒有任何斷言釘著。補上第五條之後轉紅。

兩次都是「測試綠 ≠ 防禦有效」的實例：斷言的形狀不對，跟沒有斷言一樣。
