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
- 不引入 Mixamo（本輪只用官方 7 個動作）
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

動作內容是 VRoid Project 官方免費 7 件組（VRMA_01–07）裡的三個：
`peaceSign`＝VRMA_03、`modelPose`＝VRMA_06、`spin`＝VRMA_05。
（`shoot`＝VRMA_04 一度在列，第四輪被擴大採樣後的穿臉檢查擋下，見下。）

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
出現在觀眾的左邊，probe 空間的 `+x` 對應畫面左側。被切掉的是畫面右側（column 畫布
以 `right: -32px` 超出視窗），也就是 probe 的 `-x`。這一條在 code review 第三輪才被
抓出來：原本的 `reachRight` 記的是 `max(probe x)`，濾的是完全沒被切到的那一側。
現在所有跨越螢幕邊界的推理都走 `rigProbe` 的 `screenX()`。

畫框：launcher/docked 是 y 0.618–1.722、兩側都是 ±0.674（畫布整塊在螢幕上）；
fullscreen column 的畫布半寬同樣 0.674，畫面左側吃得下整個 0.674，畫面右側在
1440×900 只看得見 0.628，y 0.430–1.602。

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
| `squat` | 11.5s | 0.622 | 0.616 | **0.218** | 2.69 | **0.23** | 4 | 排除 |
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

畫框的門檻不是畫布半寬，是**看得見的**半寬：fullscreen column 的畫布刻意超出視窗
右緣（`AVATAR_COLUMN_RIGHT_INSET` = 32px），所以右側有一段在螢幕外。用畫布半寬 0.674
認證會放行一個在右緣被切掉的動作；用 1440×900 的可見半寬 0.628，`spin` 的 0.658 就被
擋下來——**這句話在第三輪被推翻了**，見上面 `spin` 那一段：它朝畫面右側只有 0.509。
擋住畫布超出視窗那一段的證據，改由 `motionsFor()` 的執行期過濾提供（mutation B5）。

**而且可見半寬不是一個數字。** 被切掉的是固定的 32px，畫布的像素寬卻隨視窗變：

| 視窗 | column 畫布 | 可見半寬 | peaceSign（畫面右伸 0.444） | 提供的動作 |
| --- | --- | --- | --- | --- |
| 1920×1080 | 1136px | 0.6365 | 裝得下 | 三支 |
| 1440×900 | 929px | 0.6281 | 裝得下 | 三支 |
| 1024×768 | 606px | 0.6033 | 裝得下 | 三支 |
| 900×900 | 390px | 0.5639 | 裝得下 | 三支 |
| 768×1024 | 160px | 0.4051 | **切掉 0.039** | 只有 modelPose |

768×1024 是 iPad 直立開全螢幕聊天，畫布有 20% 在螢幕外。落在那 20% 裡的是她的
**左**手：peaceSign 畫面右側的極值點是 `leftMiddleDistal`。這正是本節存在的理由，
而這張表在第四輪之前自己就把邊講反了一次，寫成「她的右手」。

第一版把 1440×900 當成「column 最寬的情況」，那句話是錯的：畫布寬同時隨視窗高變大、
隨視窗寬變小，1440×900 只是中間的一點。

修法是讓「能不能播」變成執行期問題：`AvatarMotionDef.screenRightReach` 記每支動作朝
畫面右側伸多少
（`peaceSign` 0.444、`modelPose` 0.286、`spin` 0.509，由測試釘在實測值上），
`columnVisibleHalfWidth(canvasW)` 算當下這塊畫布看得見多少，`motionsFor()` 只回傳裝得下的。
沒給寬度時視為最壞情況回傳空陣列，寧可不播也不播一半在螢幕外的。構圖常數一個都沒動。

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
   髖部下沉、首尾站姿、解剖直立，加上把 `screenRightReach` 釘在實測值上的宣告檢查，
   以及執行期畫布寬度過濾。

   **不同的防線要用不同的 mutation 才打得到**，這點寫錯過一次：
   - 加回 `greeting`＋`squat` → 5 條紅：greeting 穿臉／站高／首尾站姿，
     squat 掌心／站高。
   - 加回 `shoot` → 穿臉那條轉紅（拇指 0.90）。把 `handJoints()` 縮回只回傳食指
     指尖，同一支 clip 變綠——這證明「擴大採樣」本身是承重的，不是裝飾。
   - 加回 `showFullBody` → 出框與掌心兩條紅。
   - 拿掉 `screenX()` 的負號（重現 code review 抓到的那個 bug）→ 三支動作的
     「declares the reach the picker filters on」全部轉紅。這個錯誤現在是測試失敗，
     不再需要靠人看出來。
   - 拿掉 rest-frame rebase → 「解剖直立」與「宣告 reach」轉紅，其餘照樣綠。
   - 讓 `motionsFor()` 的 budget 固定為 `Infinity`（忽略畫布寬度）→ 「offers a column
     clip only while the canvas can show its reach」轉紅。
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
