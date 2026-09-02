> 【入庫註記 2026-09-02】本檔是第二版第 9 輪 review 當時的凍結索引，整份原樣
> 搬入 repo。它點名的部分工作檔（review-diff.txt、adv-*.md、bcheck.html、
> gates-final.log 等）屬那一輪 session 的 scratchpad，未一併入庫；本檔在這裡
> 的角色是收據內容的原文出處，不是 evidence/ 目錄的索引。

# Milfy 第二版 — 稽核用證據索引（第 9 輪，兩位 reviewer 第 8 輪皆 FAIL 後）

出貨檔：public/avatar/mika-milfy.vrm
sha256 開頭 015cca16bc902f71，11,551,728 bytes
（out/mika-milfy.vrm 與它逐位元組相同）

**檔案 sha 怎麼讀。** `make.py` 的位元組不是決定性的：Blender 的 glTF 匯出器
每次替兩顆髮髻排出不同的索引順序，所以每跑一次就換一個檔案 sha 而模型不變。
穩定的識別碼是 vertex sha b9807e3cb3dc7fc6，從第二版定稿至今沒變過。

這一輪把 build.py 的 manifest 鍵序從白名單改成排序，重跑 make.py，檔案 sha
因此從 b2de2d7dcd48fdbd 變成 015cca16bc902f71。**模型沒有變，而且是量出來的：**
- 1026 個 bufferView 逐一比對，只有 2 個不同，都是 Hair001.baked 第 61、64 個
  primitive 的 INDICES，也就是 Hair_Bun_L 與 Hair_Bun_R。
- 那兩個 primitive 的三角形集合相同、只有排列順序不同；POSITION 逐位元組相同。
- JSON chunk 完全相同（`json.dumps(sort_keys=True)` 比對）。
- 兩份位元組各自送進同一支 render.py，四個固定機位逐像素相減：差異像素 0、
  最大通道差 0。
- 前一份位元組保留在 out/prev-bytes-b2de2d7d.vrm 供覆核。
- manifest 的 sha 不受影響，前後都是 1339868bb59e4cac。

## 檔案
- review-diff.txt   本輪全部程式碼改動 ＋ 新檔 avatarRim.test.ts 全文
- gates.log         六道 gate 一次跑完的逐字輸出，沒有併接（657 行）。起跑
                    14:56:59、跑完 15:14:05，受測檔的 sha 兩次都是
                    015cca16bc902f71；四份出貨物的 mtime 都是 14:55:31，早於
                    起跑，所以 gate 期間沒有任何一份被寫過。verify 跑兩次：
                    帶 baseline 與不帶。retarget 十支完整列出。
                    第 5 輪那份留在 gates-v5-superseded.log。
- mutations.md      每一道守衛的 mutation 收據。這裡刻意不寫條數：件數寫在
                    兩個地方就會有一邊過期，第 6 輪 reviewer 正是抓到這個（本
                    檔寫 14、凍結表寫 16）。涵蓋率的覆核方式是 RESULT.txt 第六
                    節每一列末尾的收據編號，翻到本檔對應那一節即可；每一節都帶
                    一行 EVIDENCE 摘要該次 mutation 的前後結果。（原本有一支
                    receipts.py 自動做這件事，第 45 項說明為什麼拿掉。）
- scripts/avatar/RESULT.txt   交付紀錄。第五節第 38–41 項是本輪修正

## 第 1 輪兩位 reviewer 的發現，逐項處置

### code reviewer
1. `remap` 不清 `manifest['shapes']`，刪件後留下指向死部件的滑桿
   → 新增 `customise.prune_shapes`（sweep 之前跑），從檔案與 manifest 兩邊
     一起拿掉。連帶抓到 `palette` 有同一個洞，一併修。
     `selftest` 改成讀 `apply` 寫出來的 manifest（原本稽核輸入那份，看不到）。
     shape key 檢查改成雙向：manifest 指名的要真的位移，檔案宣告的要在
     manifest 裡。三道防線各自 mutation 過（見 mutations.md）。
2. sparse accessor 的 min/max 無條件併入 0.0，4 個全 patch 的 target 界線違規
   → `glb.add_sparse_accessor` 改成只在 `len(indices) < count` 時併入。
     新增 `verify.loose_sparse_bounds` 當常設防線，mutation 後正好抓回那 4 個。
3. `torn_shapes` 不帶 baseline 就對正確檔案報 30 個 FAIL
   → 改成從候選檔的 `blendShapeMaster` binds 認出表情網格。
     實測 `torn_shapes(出貨檔, None)` 30 → 0；帶 baseline 仍是 0。
4. 兩處註解把 sweep 的失效寫成「靜默歸零」，實際是 IndexError
   → 兩處都改成實測到的行為（393 個 view 被掃、sparse 索引越界）。

### spec reviewer
1. `Acc_Belt_Waist` 650 tris → 實際 4,890。已改，並標明第一版數字。
2. `Acc_Bandage_Thigh` 1,300 tris → 實際 5,498。已改，同上。
3. 蝴蝶結對腰封 4.3mm 重現不出來 → 照 build.py 同一套定義重量是 1.82mm。
   兩處都改，並標明 4.3 是第一版腰封 650 面時的值。
4. compare.png／mtoon-*.png／side-check.png 是第一版算圖
   → 四張定機位、compare.png、三張 mtoon、side-check 全部對
     b2de2d7dcd48fdbd 重新產生（12:15–12:18）。
5. gate log 比出貨位元組早 47 秒 → 最後改成六道一次跑完的 gates.log，前後各
   記一次 sha（第 3 輪的處置，見下）。
6. retarget 只列八支（`tail` 截斷）→ gates.log 十支完整。
7. 文件開頭承諾「衝突處都已就地標註」但兩段沒標
   → 第一版 make.py 全程輸出與第一版瀏覽器結果都補上了標註。
8. 面數保留範圍（77,490 / 89,181）→ 沒有改動，這是使用者要親自裁量的取捨，
   已在報告裡與這裡各標一次。

## 瀏覽器驗證（在最後一次 build 之後）

怎麼重跑：頁面在 scratchpad/bcheck.html。**要放到專案根目錄再開**
（`cp bcheck.html ~/portfolio/ && npx vite --port 5173`，然後
`http://localhost:5173/bcheck.html?view=front|quarter|face`）。放到 public/
沒有用——Vite 的 SPA fallback 會把 public/*.html 吃掉，回傳的是 index.html，
而那看起來像頁面載入成功。也不能從別的 port 開：Vite dev 不送 CORS 標頭，
跨來源抓 .vrm 會被擋。跑完我已經把根目錄那份刪掉。

bcheck.html（three-vrm 3.5.0，真 Chromium + WebGL），三個機位各一次：
{"ok":true,"errors":[],"bytes":11551728,"sha256_first8":"015cca16bc902f71",
 "spec":"0","bones":54,"expressions":15,"clips":10,"drew":true}
頁面自算的 sha 與 shell 的 shasum 相同。唯一的 console error 是 favicon 404；
兩則 warning 是 three-vrm 對 .vrma 檔的提醒，不是模型的問題。

## 前端
npm test 18 files / 326 tests 全綠；`tsc --noEmit` 與 eslint 乾淨。

## 第 2 輪的處置（code reviewer PASS、spec reviewer FAIL）

spec reviewer 的三項，全部是這份報告與 log 的敘述問題，模型沒動：
- RESULT.txt 的 BOW_GAP_MAX mutation 收據仍寫第一版的「乾淨版 4mm」→ 就地標註
- 「建置的位元組不是決定性的」一節的 vertex sha 是第一版的，且宣稱它對應現在
  的 public/avatar → 段首標註，並在段尾寫出現行的兩個 sha
- gates-final.log 檔尾的 post-run sha 是從舊 log 抄的，時間早於它自己的起跑
  → 檔頭改成逐一列出四個時間點，每一行都說明它是哪一次量的

code reviewer 另提兩件不阻斷的，也都修了：
- customise.apply 刪件後沒有清死材質（刪 Acc_Crown 會留 Milfy_Gold、
  Milfy_GoldInner），拿 verify.py 驗 customiser 產出會紅 → apply 加
  sweep_materials，selftest 加兩條檢查，mutation 過
- prune_shapes 的檔案側清理被 manifest 的 shapes 欄位擋住 → 改成
  `manifest.get('shapes') or {}`，實測拿掉那一節仍會刪掉死 target

另外把「393／129 個 bufferView」改成量得出來的「351／191（selftest seed 15）」
並在註解標明是哪一組刪件。

## 第 3 輪的處置（code reviewer PASS、spec reviewer FAIL）

code reviewer 第 3 輪 PASS，另提三件：
- `sweep_materials` 的兩個成對寫入只有一個被釘住 → verify 與 selftest 各加一條
  逐位置比對名字的檢查，兩個半邊現在都單獨 mutation 得起來（mutations.md 第 9 項）
- make.py 第 2 步不印材質清掃結果，報告卻描述了那行輸出 → make.py 真的印了
- 端到端重跑的產物被我刪掉，reviewer 無法覆核 → 重跑一次並保留
  out/milfy.rerun.vrm 與 rerun.log

spec reviewer 第 3 輪 FAIL 四項，全在報告敘述層：
- 「那三道 gate 只讀 pierce/pose/render」寫錯依賴集合（三支都 import glb.py，
  而 glb.py 這一輪改過）→ 不再用理由帶過，六道 gate 改成一次跑完（gates.log）
- 「23 個 primitive 一致都是 4」是刪件前的數字 → 實測刪後是 21，已改
- 第三節把頭髮寫進帶酒紅描邊的那一組，是我第 3 輪自己改錯的 → 量過 baseline，
  13 個帶酒紅（10 個臉/眼/皮膚 ＋ 3 個 CLOTH），6 個 HAIR 本來就是 (0,0,0)
- 第二版有兩個「五、」→ 後面那節改成「六、」

## 檔案更新中的注意事項
第 3 輪 reviewer 提到審查期間交付物仍在變動。這一輪的所有檔案在派出 reviewer
之前就已定稿，gates.log 是六道一次跑完的單一檔案，不再有併接。

## 審查期間的唯一改動（13:26，兩位 reviewer 已在跑）
verify.py 的模組 docstring 加了一段，說明 report() 判的是「完成的模型」，
out/ 裡的半成品照設計就過不了（它們還沒經過 build.py，本來就沒宣告 _RimColor），
而 make.py 逐步跑的 gate() 只斷言骨架。純註解，沒有行為改動，gates.log 仍然成立。
起因是我自己在等 reviewer 時對五個中間檔跑了一次 verify，發現這件事沒有寫下來。

## 第 4 輪 code reviewer（PASS）另提的四件，都修了

- RESULT.txt 第 9 項還指著已刪的 gates-final.log 與「四個時間點」→ 改成描述
  現在的做法（一次跑完、前後各記一次）
- 這份 EVIDENCE.md 的檔案清單同一個根因 → 一併改
- 「selftest 十七條全綠、verify 九項全 0」用修正後的數字描述修正前的狀態 →
  修正前是十六條與八項，已改，並標明 gates.log 的 17 個 [ok] 是修完的數字
- `out/milfy.rerun.parts.json` 與出貨的 manifest 內容相同、位元組不同（`shapes`
  與 `palette` 的鍵順序，取決於 out/ 是不是乾淨的）→ 這個真的修了程式：
  build.py 結尾把 manifest 依固定鍵序重建。兩條路徑現在連 manifest 都逐位元組
  相同（sha 1339868bb59e4cac），VRM 的 sha 不受影響（仍是 b2de2d7dcd48fdbd，
  manifest 是在 VRM 存檔之後才寫的）。

## 第 4 輪 spec reviewer（FAIL）的處置，以及審查迴圈到此為止

四輪的模式很清楚：模型本身從第 1 輪起就沒有被挑出缺陷（每一輪 reviewer 都自己
重驗 GOAL 第三組七條，每一輪都成立），FAIL 全部落在報告與證據層，而每一輪的
發現都是前一輪修正自己生出來的。第 4 輪的六項：

- 交付物在審查期間仍在變動（真的，是我的問題：兩位 reviewer 在跑的時候我還在
  改 verify.py 的 docstring 與 build.py 的 manifest 鍵序）
- gates.log 早於最後一次程式改動（真的：build.py 改於 13:40，gate 跑於 13:07）
  → 已在所有改動之後重跑一次，log 檔頭與檔尾各記 VRM 與 manifest 兩份 sha
- mutations.md 的控制組仍指著已刪的 gates-final.log → 改成 gates.log 第 49–572 行
- 「廠商 FBX 裡共 11 個 key」與它自己的 13 列表格對不上 → 我直接掃兩個 FBX 的
  BlendShapeChannel：Inner 11、Outer 2，合計 13。已改
- 第 10 項大腿環 x 範圍 -0.147..-0.009 與出貨檔的 -0.1466..-0.0076 差 1.4mm → 已改
- 13:40 那次 build.py 改動沒有寫進 RESULT.txt 第五節 → 補成第 21–25 項

依專案規則（同一發現連兩輪、或總計三輪未收斂就停止自行修正），審查迴圈到第 4
輪為止，不再派第 5 輪。上面五項可判定的事實錯誤都已修正並各自量過；「交付物在
審查期間變動」這一項無法靠再跑一輪解決，因為每一輪的修正本身就是新的變動——
這正是要停下來交給使用者判斷的理由。

================================================================================
## 第 5 輪兩位 reviewer 的處置

code reviewer PASS（連四輪）。它提的兩件都做了：
1. build.py 的白名單「把順序漂移換成未來新增區段被靜默丟掉」，失效模式比原問題
   更糟。我先確認沒有任何下游擋得住：verify.py 完全不開 manifest（0 處引用）、
   selftest 只讀 parts／palette／shapes、make.py 不比對鍵集合。改成排序（已知鍵
   固定順序、未知鍵按名字排尾端）。排序版沒有過濾步驟，丟不掉東西，所以不需要
   再加 assert 事後抓；reviewer 提的 `assert set(manifest) <= set(ORDER)` 是給
   白名單版的補救，對排序版反而會擋掉要保留的未知鍵。
2. 「78 行 diff」不精確。我自己量：shapes 區塊 78 行，`diff -u` 是 78 行刪、
   78 行加，連標頭共 174 行。改寫成量得出來的說法。

spec reviewer FAIL，四項，全在證據層（模型它再次逐項驗過，七條 GOAL 不可違反
全部成立）：
3. mutations.md 的控制組指標從死檔名換成了錯的行號（寫 gates.log 第 49–572
   行，實際 selftest 區塊是 54–582）。**這是同一類缺陷第三次出現**，所以這次
   不再換一個指標：改成引用區塊標記字串（`=== selftest 20 rounds ===` 與
   `20 rounds: PASS`），標記會跟著內容走，行號不會。
4. RESULT.txt 宣稱「每一道守衛都用 mutation 驗過」，但 loud_outlines、
   undeclared_rims、ragged_targets、SHAPE_KEY_MIN_MEAN 與前端那五條都沒有收
   據。這一輪全部補跑（收據 11–13），並在補的過程中發現 selftest 的「每個 mesh
   只有一個 target 數」也沒有任何一條收據點得亮，補了收據 14。守衛表改成逐道標
   收據編號——全稱宣告會把缺口藏起來，逐道標號不會。
5. 文件開頭的「12＋2」計數過期（第五節已編到 25 項）。改成指向第五節、不再複述
   件數。
6. 皇冠四個比值的分母「耳徑」從來沒寫出來。耳不是圓的（80.8 寬 x 81.4 高），
   用高當分母得 0.83／0.91／0.12，用寬得 0.83／0.92／0.13。已標明分母是單耳
   bbox 的高 81.4mm；同一把尺下「冠心離中線」是 0.86，原本寫的 0.85 沒有任何
   一種取法得得出來，已改。

## 第 6 輪兩位 reviewer 的處置

code reviewer PASS（連五輪）。它獨立重跑了每一條收據、注入兩個未知 manifest
區段確認都存活、自己量了 sha 變動是模型中性的，並額外查證 rim 改動對線上頭像
是 no-op。唯一一項不阻斷的發現（`diff -u` 174 vs 172）處置見下面第 3 點。

spec reviewer FAIL，一項實質、三項次要。**實質那項是第 27 項同一類缺陷連兩輪
出現**，我照實記在這裡：

1. 上一輪把全稱句改成逐道收據編號，但標錯兩個對象，缺口照樣被藏住：
   - selftest 有兩條獨立的 palette 檢查（`selftest.py:113` 指部件、
     `selftest.py:166` 指材質）。守衛表把「指得到還在的材質」標成收據 3，而收
     據 3 紅的是「指得到還在的部件」。於是前者沒有收據，後者沒列進表。
   - `verify.unused_materials` 標成收據 6，但收據 6 沒跑過 verify.py。
   兩個缺口都補了實跑的收據（15、16），守衛表把兩條 palette 檢查分列。
   我先試了 reviewer 建議的破法（拿掉 `customise.remap` 尾端那道 palette 過濾，
   現在在 `customise.py:659-662`），
   結果兩條一起紅，**分不開等於沒單獨釘住任何一條**；改用只有材質那條抓得到
   的缺陷形狀（palette 鍵指向不存在的材質、其部件仍活著）才分開。
2. 做收據 15 時撞到一次假陰性：第一個 victim 的部件正好在刪除名單裡，條目在名
   字檢查之前就被清掉，兩條都綠。換一個部件不被刪的 victim 才紅。注入的缺陷要
   先確認它活到被檢查的那一刻。
3. 「`diff -u` 連標頭共 174 行」兩個讀者算出 174 與 172（差在空白 context
   行）。我自己量是 174（`diff -u` 與 `git diff --no-index` 都是）。但同一句話
   連兩輪因為一個總數出事，而那個總數不承載論證，所以刪掉而不是辯護。
4. 帶尾「腰封下緣以下 46.6mm」重量不出來且對切線高度敏感，不承載論證，刪除，
   留全段最近距離 24.1mm。皇冠「每個比值差約 0.007」對第四個比值不成立
   （0.0009），改成逐項寫。本檔凍結清單兩個時刻寫成概略值而與實際不符——這一
   輪起凍結清單改成用 `stat` 產生，不再手打時刻。

## 第 7 輪兩位 reviewer 的處置

code reviewer PASS（連六輪）。spec reviewer FAIL。**兩位獨立抓到同一件事**，而
它是第 6 輪那一類的第三次出現，所以這一輪的處置不是再修一列：

1. 守衛表把 `verify.misaligned_material_properties` 標成收據 9，但收據 9 印出來
   的是 selftest 的 label，全程沒跑過 verify.py。補了實跑的收據 17
   （control 0、mutated `1 [(-1, '32 materials', '34 materialProperties')]`）。
2. **根因是我每次只修被指出的那一列，沒有把整張表掃過**，所以同一類連三輪出
   現。這一輪加了 `scripts/avatar/receipts.py`：十六道守衛逐一對回收據檔，判準
   是「收據必須提到該守衛失敗時印出的字串，或實作它的函式／常數名」。用印出來
   的字串當判準，正是為了抓這三次都一樣的錯——把 verify.py 的守衛記到一個只跑
   了 selftest、對同一不變量用不同措辭的收據上。
   這支檢查器自己也做了 mutation：拿掉收據 17 → 指名
   misaligned_material_properties 並 exit 1；拿掉收據 11 → 指名
   ragged_targets 並 exit 1；完整的收據檔 → 16/16、exit 0。
   （它在我補收據 17 之前就自己指出那一列是唯一沒有收據的。）
3. 收據 14 的破法同時點亮兩條，而收據 15 才剛立下「分不開等於沒單獨釘住」。補
   了隔離版 14b：在第 0 個 primitive 多掛一個重複 target，只有「每個 mesh 只有
   一個 target 數」變紅。
4. 三處散文：第 29 項說「四個比值」只列三個值（補齊）；帶尾 24.1mm 原寫「兩種
   量法都相同」而實際不同（改成寫明用頂點對頂點）；守衛表沒寫範圍（補上：只收
   「會靜默的偵測器」，那幾處 fail-fast `raise` 當場中止建置，不
   列；當時寫「五處」，第八輪查出是六處）。
5. 本檔自己的計數矛盾（第 30 行寫 14、凍結表寫 16）已消除：不再寫條數，改成指
   向 receipts.py。標題輪次也補正。

這一輪的所有 mutation 都跑在 scratchpad 的複本上，`/Users/charles/portfolio` 的
`git diff` 對 `scripts/avatar` 與 `src/components/chat` 全程為空——reviewer 在
讀的時候交付物沒有被動過。（工作樹整體的 `git status --porcelain` 並不是空的：
`rag/insights/*.ts` 有三個未 commit 的 M，加上一批根目錄的未追蹤圖檔，都與這件
工作無關。第八輪 reviewer 指出原本那句全稱說法不成立，已改成窄的那句。）

## 第 8 輪兩位 reviewer 的處置（兩位都 FAIL，打在同一處）

**第八輪是我第一次拿到 code reviewer 的 FAIL，而兩位獨立打穿的是同一個東西：
第 35 項那支為了終結這一類缺陷而寫的 receipts.py，本身就是這一類缺陷。**

1. 它的判準是「收據裡提到該守衛失敗時印出的字串」。這句話對十六道守衛全部不成
   立，因為 `verify.report()` 是**無條件**印出每一道偵測器的名字的——通過時印
   `coloured outlines: 0`。spec reviewer 據此造了一份「一個 mutation 都沒跑」、
   只貼全綠輸出的檔案，拿到 16/19… 實際是 16/16、exit 0。code reviewer 從另一
   側打穿同一處：刪掉收據 3，那一列改由收據 15 的散文滿足，而收據 15 自己寫著
   它的 mutation 分不開兩條檢查、因此哪一條都沒釘住。
2. 它只查十九列中的十六列：`customise.prune_shapes`、`customise.sweep_materials`
   與前端那列不在清單裡，刪掉它們的收據不會變紅——而表頭寫的是「不再靠人工比
   對」。宣稱大於程式做的事，正是它要擋的那一類。

改法（第 40 項）：判準改成從守衛表讀出每一列引用的收據編號，再要求**被引用的
那一份**收據帶 `EVIDENCE guard=… control=… mutated=…` 且兩值不同；十九列全納
入；表裡出現而不屬於任何已知守衛的收據編號也會紅。

用兩位 reviewer 的攻擊重測（檔案留在 scratchpad 供覆核）：

    adv-zero.md   只貼全綠輸出、零 mutation        0/19   exit 1
    adv-same.md   EVIDENCE 的 control == mutated   0/19   exit 1
    adv-no3.md    刪掉收據 3                      18/19   exit 1
    adv-no13.md   刪掉收據 13（前端那列）          18/19   exit 1
    adv-no7.md    刪掉收據 7                      19/19   exit 0
    mutations.md  完整                            19/19   exit 0

adv-no7 仍綠是正確的，不是漏抓：`prune_shapes` 引用 1、2、7 三份收據，刪掉 7 之
後前兩份仍帶著它的 EVIDENCE，這一列的證據沒有消失。

另外修的：fail-fast `raise` 是六處不是五處（glb.py 兩處），且六處都在 b3da0f1
一個 commit；本檔第 35 行的節次指標寫成 26–29（那是第五輪）已改成 38–41；標題
輪次補正；「git status 全程為空」改成成立的窄句。

## 第 9 輪之後：移除 receipts.py（使用者裁決）

第 8、9 兩輪四份 review 報告裡，每一條 FAIL 都打在 receipts.py，沒有一條打在模
型上；而它是第七輪我自己加的，不在 GOAL.md 的要求裡。它用 regex 剖析一張手寫的
中文散文表格，每修一次下一輪就找到新的剖析漏洞，三輪同族。把判斷交給使用者後，
裁決是移除。

移除後這張守衛表的保證來自哪裡，講清楚免得看起來像掃掉問題：表的正確性本來就是
三輪 spec reviewer 逐列稽核建立的（第七輪十九列全部走完，第八、九輪複驗），不是
那支工具建立的。工具只防未來回歸，而那個防護的價值低於它自己每輪產生的缺陷成
本。mutations.md 的 EVIDENCE 行留著，作為每次 mutation 前後結果的一行摘要。

## 第 9 輪的凍結清單（審查期間不會再有任何改動）

同樣的規矩：所有改動先做完、commit、再派 reviewer；派工之後不編輯任何檔案。

**這張表是用 `stat` 產生的，不是手打的。** 前幾輪這裡出現過概略時刻（「15:0x」）
而與實際不符，reviewer 抓到過一次；手打時刻本身就是一個會過期的散文，所以改成
從檔案系統讀。唯一無法自我描述的是本檔自己那一列：寫入這張表之後 EVIDENCE.md
的 mtime 必然會再往後跳幾十秒，那一列記的是產生表的時刻。

  時刻      檔案                                    sha256 前 8 bytes
  14:55:31  public/avatar/mika-milfy.vrm           015cca16bc902f71
            出貨的模型，之後沒有再重建
  14:55:31  public/avatar/mika-milfy.parts.json    1339868bb59e4cac
            manifest
  14:55:31  scripts/avatar/out/mika-milfy.vrm      015cca16bc902f71
            與 public/ 那份逐位元組相同
  14:55:35  scripts/avatar/out/final-front.png     
            四張定機位算圖之一
  15:15:08  gates.log                              
            六道 gate 一次跑完，零 FAIL
  16:15:45  mutations.md                           
            每一道守衛的收據（含 EVIDENCE 行）
  16:18:26  scripts/avatar/RESULT.txt              
            交付紀錄
  16:19:25  review-diff.txt                        
            從 commit 70c9363 重新產生
  16:19:08  EVIDENCE.md                            
            本檔

四份出貨物的 mtime（14:55:31–41）都早於 gate 起跑（14:56:59），所以 gate 期間沒
有任何一份被寫過——這比起跑／跑完各記一次 sha 更強，因為 mtime 涵蓋整段區間而不
只是兩個端點。第六輪沒有動任何程式（只改 RESULT.txt 的散文與 scratchpad 的收
據），所以模型位元組、gates.log 與四張算圖都不需要重跑，仍是 14:55–15:15 那一批。

主動揭露四點：

1. RESULT.txt 與 EVIDENCE.md 的 mtime 晚於 gates.log，跟前幾輪一樣：那些編輯只
   是把跑完的 gate 輸出抄進報告、以及記錄 review 的處置。沒有動程式、沒有動任何
   產物。覆核方式是把 RESULT.txt 的 gate 區塊逐行對 gates.log——我自己對過，145
   行裡只有 12 行不是逐字相同，全部是 5 行檔頭註解與 7 行中文小標題。
2. compare.png、mtoon-*.png、side-check.png 是對前一份位元組 b2de2d7dcd48fdbd
   產生的，不是這次重跑的。理由與量測寫在本檔開頭：兩份位元組的差別只有兩顆髮髻
   的三角形排列順序，四個機位逐像素比對差異為 0。前一份位元組保留在
   out/prev-bytes-b2de2d7d.vrm 供覆核。四張定機位算圖則是這次 make.py 產生的。
3. 為了跑 mutation，這一輪暫時改過 avatarGuideEngine.ts 與 customise.py，跑完都
   用原檔的位元組複本還原。`git diff` 對兩者皆為空，與 commit 完全相同；還原後
   另外跑過一次 selftest（seed 2）確認 17 條全綠。
4. 收據 15、16 產生的中間檔（mut-unused.vrm、bad-palette2.parts.json、probe.*）
   留在 scratchpad 供覆核，它們不是出貨物。

---

## 追加：2026-09-02 那一天的檔案（RESULT.txt 的第五版）

**版號在本檔有兩套，這裡先說清楚**：RESULT.txt 用「第 N 版」數交付版本，本檔
早先的段落用「第 N 輪」數 reviewer 迴圈，兩套數字不一樣。以下一律寫「第 N
輪」，指的是 reviewer 迴圈；這一整天的產出在 RESULT.txt 裡都屬於**第五版**。
本檔最後一節的「第六版」是 RESULT.txt 的版號，指 2026-09-03 的調色那一輪。

本檔上面的內容是第二版凍結索引，原樣保留。這一天新增的證據檔如下，
RESULT.txt 的對應章節逐項引用它們：

- `gates-0902f.log` / `gates-0902k.log` — 六道 gate 一次跑完的逐字輸出，f 是
  第 5 輪、k 是第 6 輪（雙 reviewer FAIL 後的重建）。檔頭記受測檔的 sha。
- `motion-0902f.log` — motion gate 另檔，因為它單獨跑要十分鐘，併進上面那份
  會讓 gate 起跑時間失去意義。第 6 輪那一次的 motion 輸出沒有留成檔（原本的
  `motion-0902k.log` 是 0 bytes，已刪），那一輪的 motion 結果沒有可稽核的證
  據；真正被引用的是下一節的 `motion-0903b.log`。
- `selftest-0902f.log` — selftest 20 輪（第 6 輪的 20 輪併在 gates-0902k.log）。
- `build-0902f.log` / `build-0902k.log` — 對應版本的建置全程輸出。
- `mutations-0902c.md` — 第 5 輪的守衛紅燈收據。**其中兩格已被 -0902d.md 取
  代**（y 歸零那條當時是空測試），讀的時候要一起看。
- `mutations-0902d.md` — 第 6 輪重取的收據，含失效原因。
- `clip-v4-*.png` / `clip-v5-*.png` — 外套穿模的前後對照。
- `back-v4-bald.png` / `back-v5-covered.png` / `back-v6-cap.png` — 後腦禿頭
  →補帽→帽色修正的三個階段。
- `browser-v5-*.png` / `browser-v6-*.png` — 真引擎畫面驗證。v6 的 front 與
  back34 是**第 6 輪**（補片式後腦）的畫面，不是最終版；最終版是下一節的
  `browser-v7-*.png`。v5 的 akimbo／modelpose 續用，因為 standoff 自那之後未
  再改動（見 RESULT.txt 第五版第 3 點）。

## 追加：後腦改回根因那一輪（2026-09-02 深夜）

使用者看過第 6 輪的畫面後指出後腦仍然是「東補西補」。第 7 輪把修正從「另做一
片補上去」改成「twintail 不要把貼頭皮那層帶走」，證據檔如下：

- `gates-0903b.log` — verify（帶／不帶 baseline）、pierce、retarget 的逐字輸
  出，對最終位元組 `63e4ea29837ac3a9`（vertex sha `ae7f90eecb9784d9`）跑的。
- `selftest-0903b.log` — selftest 20 輪。
- `motion-0903b.log` — motion gate 十支 clip，最差 Outfit_Cardigan 36 px／
  150 px（0.24 倍上限，modelPose t=0.94s）。
- `mutations-0903a.md` — 新機制兩道防禦的紅燈收據，並說明 -0902d.md 裡「掃髮
  帽色」那一格已隨補丁一起刪除。
- `browser-v7-back.png` / `browser-v7-front.png` — live-preview.html 上 spin
  動作的正背面與正面幀，最終位元組拍的。背面那張是這一項的驗收畫面。
- `nape-v6-patch.png` / `nape-v7-continuous.png` — 同一機位的前後對照。v6 那
  張的實機中位數已經與四周髮完全相同 (199,171,132)，畫面仍是補丁；這組是
  「中位數不是顏色不均的判準」的證據。

## 第六版：色帶壓平與髮膚重解（2026-09-03）

「第六版」在這一節是 **RESULT.txt 的版號**，指 2026-09-03 調色那一輪；本檔前面
幾節用的是 reviewer 迴圈的「第 N 輪」，兩套數字不一樣。

同一天分兩件事，都在調色那一層，證據合在一組，對最終位元組
`66871116b6263fb9`（vertex sha `ae7f90eecb9784d9`，只換貼圖，11,884,432 bytes）：

- `build-0903f.log` — 01:58 那次 `make.py` 的全程輸出。（**不要當成「出貨那一次」
  引用**，理由見下面「出貨建置的 log 指認不出來」。）
- `build-0903f-recheck.log` — 註解與 docstring 改完之後的第二次等價重建，用來證
  明那些改動沒有動到輸出（43 張貼圖逐索引位元組相同、vertex sha 相同）。
- `build-0903h-equiv3.log` — 第四次等價重建（03:45:46–03:46:28）。前面幾次蓋不到
  03:05 那次 `np.errstate` → `warnings.catch_warnings()` 的改動，這一份蓋得到：
  建置 sha `356bb89cc4af1c9c`、vertex sha 仍是 `ae7f90eecb9784d9`、43 張貼圖逐索
  引位元組全同，跑完把出貨位元組原樣放回（首尾都印 `66871116b6263fb9`）。它的驅
  動腳本把 `make.py` 的 stderr 分開接住、只在非空時印出來，而這份 log 裡沒有那個
  區塊，也搜不到 `RuntimeWarning`——前兩份的第一行都還印著
  `All-NaN slice encountered`。靜音那次改動的收據就是這一點。
### 出貨建置的 log 指認不出來

產出出貨位元組 `66871116b6263fb9` 的那一次 `make.py`，**它自己的建置輸出已經指認
不出來了**。`make.py` 不印檔案 sha，兩份 0903 的建置 log（`build-0903f.log`
01:58、`build-0903f-recheck.log` 02:34）內容除了時間戳幾乎逐行相同，而
`mut-0903f.log`（02:11:39）末行已經印 `restored; ship 66871116b6263fb9`——出貨位
元組在 02:11 之前就存在了。等價檢查那張表把 01:58 那次記成建置 sha
`ff418d7f630b6ac4`，若那筆記錄為真，`build-0903f.log` 就不是出貨那一次。兩種讀法
我都沒有辦法用留下來的檔案裁決，所以這裡不指派。

這件事不影響出貨物的可信度：出貨位元組的內容由第四次等價重建
（`build-0903h-equiv3.log`）直接驗過——現行原始碼跑出來的模型與它 vertex sha 相
同、43 張貼圖逐索引位元組相同。那道收據不需要知道原始的建置 log 是哪一份。

- `build-0903j-equiv5.log` — 第五次也是最後一次等價重建（04:21:28–04:22:07）。
  04:14–04:20 依第三輪 review 改過三個程式檔的註解與 docstring，這一份把收據補
  齊：建置 sha `956d8784999f7660`、vertex sha 仍是 `ae7f90eecb9784d9`、43 張貼圖
  逐索引位元組全同、**四張**約定機位算圖差異像素各為 0（第四次的比對腳本機位名單
  寫錯只比到兩張，這次修好了），跑完把出貨位元組原樣放回。
- `pytests-0903i.log` / `pytests-0903k.log` — 四個模組 30 條 python 測試的逐字輸
  出，兩次都全綠。`-k` 是最後一次（04:22:17），在最後一次改程式檔與最後一次等價
  重建之後。（開頭那行 `ResourceWarning: unclosed file` 是 `glb.py:44` 讀出貨檔
  沒關檔柄，與這一輪的改動無關，也不影響斷言。）
- `gates-0903h.log` — 六道 gate 在第四次等價重建之後重跑一次（03:47:56–
  03:48:14），25 行 PASS、0 個 FAIL。selftest 是亂數抽部件，兩次抽到的部件不同，
  其餘與 `gates-0903g.log` 逐行相同；RESULT.txt 引用的仍是 `-0903g`。

這一輪動到的程式檔，完整清單（七個裡六個有行為改動，只有 `twintail.py` 純改文
字）：`customise.py`、`build.py`、`appearance_test.py`、`measure.py`，以及
`render.py`／`partmap.py`（`render.py` 新增 `REPEAT`、`textures()` 由二元組改回
三元組並讀 sampler 的 wrapS／wrapT，`partmap.py` 的兩處 texmap 字面量跟著改成三
元組——這是第六版的量測層修正，會改變量到的數字）、`twintail.py`（docstring 與註
解更正，沒有行為改動）。文件端另外補了
`mutations-0902d.md` 與 `mutations-0903a.md` 兩份舊收據的稽核註記。
- `gates-0903g.log` — verify（帶／不帶 baseline）、pierce、retarget、selftest
  20 輪，一次跑完的逐字輸出。RESULT.txt 的「六道 gate」那一節逐字引用它，但**不
  是全文**：selftest 只列最後一輪（20 輪全在這裡），而那一節後面另接 measure 與
  motion 兩段，兩者都不出自這份 log。
  **先前那一輪的 gate 腳本用 `python3 -m pytest` 跑 retarget，而這台機器沒有
  pytest**，那一格印的是 `No module named pytest`、什麼也沒驗到；腳本改成呼叫
  `retarget_test.py` 自己的進入點後整份重跑，這一份是重跑的結果。
- `motion-0903f.log` — motion gate 十支 clip，另檔（單獨跑十幾分鐘）。
- `mutations-0903c.md` — 這一輪的紅燈收據：M1–M11、穩定性檢查 S8／S32、兩份重
  現舊配色的建置 B0／B1，以及註解改動之後的等價重建檢查。逐字輸出分六份：
  `mut-0903f.log`（M1–M10、S8、S32）、`mut2-0903f.log`（補明度斷言後重跑
  M1／M3／M4）、`mut4-0903f.log`（M11，含第一次選錯目標那一次）、
  `mut5-0903f.log`（B1）、`mut6-0903f.log`（M2 與 B0 重跑並留檔）、
  `mut7-0903f.log`（B0 再跑一次，背面「修正前」那張圖量的就是這一份）。收據裡每
  一個 mutant sha 都指得回其中一份。
- `mutations-0903b.md` — **已被 -0903c.md 取代**。它是同一天早先「整張往中位數
  收 85%」那個機制的收據；機制在同一天換成逐欄去趨勢，那一份的每一個數字都失
  效，留著只為對照，不要拿它的數字當現況。
- `colorprobe-0903.md` — 畫面顏色的量測收據：探針怎麼重跑、遮罩與框怎麼定義、
  正面／背面的原始 JSON、四份建置的背面對照、貼圖層的漸層逐值比較、頸縫量測、
  參考色的出處與 ΔE。RESULT.txt 引用的每一個顏色數字都能在這裡查到來源。
- `browser-v10-back.png` — 背面，後腦與四周同一個色調（探針機位）。
- `browser-v10-front.png` / `browser-v10-head.png` — 正面全身與頭部特寫。頭部
  那張是「嘴唇與腮紅沒有被提亮洗掉」的驗收畫面。
- `back-v10-before.png` — 同一個探針機位、同一組光，跑在重現第五版髮色且不去趨
  勢的建置（B0，`b4a83f5a`，收據在 `mut7-0903f.log`）上。這是「修正前」的定量對照，與 `browser-v10-back.png`
  可以逐像素比。
- `browser-v8-back-complaint.png` — 使用者指出色差時的實機畫面，作定性對照；機
  位是 live-preview 的 spin 幀，與探針不同，不能拿來比數字。
- `live-preview-v10.png` — 真實 live-preview 頁面載入出貨模型的正面畫面
  （0 個 console error），這一輪的進入點檢查。背面的驗收畫面沒有用這一頁：它在
  Playwright 的軟體 WebGL 下 rAF 會被餓死（連拍三張都是同一幀），瞄不準轉身那
  一幀；探針頁逐項複製了同一組打光，而且會把受測位元組的 sha 印在 `#out` 的
  JSON 裡（印在頁面，不在 PNG 上）。

時序（本檔與 RESULT.txt 一致）。多數項可以用檔案時間戳或 log 自印的時間戳查；
03:10:48（mtime 已被後續的重建覆蓋）、03:45:46（第四次重建的驅動腳本沒有印時間
戳，那是我啟動它的時刻）、03:47:47（那一次的測試輸出只留在 scratch）這三項查不
到，照實標在這裡。04:15:01 與 04:22:17 那兩次測試都有留檔
（`pytests-0903i.log`／`pytests-0903k.log`），第五次等價重建的起訖時間也印在它自
己的 log 首尾兩行：
出貨位元組 `66871116b6263fb9` 在 **02:11 之前**就已經存在（`mut-0903f.log` 的
02:11:39 末行印著 `restored; ship 66871116b6263fb9`），產它的那一次建置指認不出
來（見上一節）。**03:10:48** 是第三次等價重建把它放回去的時刻，全部 mutation 還
原在此之前；gate 03:11:06 起跑、03:11:23 跑完（時間戳在 log 首尾兩行）；motion
03:11:29–03:26:09；三張 `browser-v10-*.png` 03:12:15 拍。之後為了補上「現行原始
碼與出貨位元組等價」這道收據，03:45:46–03:46:28 又跑了第四次等價重建
（`build-0903h-equiv3.log`），跑完把出貨位元組原樣放回（log 首尾都印
`66871116b6263fb9`）；接著 03:46:55–03:47:00 拿出貨位元組重跑 `render.py` 產出四
張約定機位算圖，03:47:47 重跑 30 條 python 測試（`appearance_test.py` 03:18 改
過，先前那次綠燈已過期），03:47:56–03:48:14 重跑六道 gate（`gates-0903h.log`，25
行 PASS）。04:15:01 又跑了一次 30 條全綠（`pytests-0903i.log`）。04:14–04:20 依
第三輪 review 改過 `appearance_test.py`、`build.py`、`customise.py` 三個檔的註解
與 docstring（更正三個量不回來的數字），所以 04:21:28–04:22:07 跑了第五次也是最
後一次等價重建（`build-0903j-equiv5.log`，四張算圖全比、差異像素各為 0），
04:22:17 再跑一次 30 條全綠（`pytests-0903k.log`）；那之後只改 `.txt`／`.md`。出
貨檔與四張 `out/final-*.png` 的 mtime 因此是 04:22:07——那是放回去的時間，不是產
生它們的時間，sha 與大小都沒變。`back-v10-before.png` 是 03:09:52 拍的，它量的是 B0 那份建置，本來就不該是出貨位元
組。每一次探針載入都會把 fetch 到的位元組自己算一次 sha，印在與量測值同一段
JSON 裡：三張 `browser-v10-*.png` 那幾次都是 `66871116b6263fb9`，
`back-v10-before.png` 那次是 `b4a83f5a4dfea7f7`（收據 `mut7-0903f.log`）。sha 只
進頁面的 `#out`，PNG 檔本身不帶 sha，所以歸屬靠的是那段 JSON 加檔案時間戳，不是
圖自己。
