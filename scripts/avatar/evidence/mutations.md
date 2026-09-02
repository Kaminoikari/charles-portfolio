# 這一輪新防線的 mutation 收據

本檔出現的 VRM 檔案 sha（b2de2d7dcd48fdbd 等）都是「當時那一次建置」的值。
`make.py` 的位元組不是決定性的（Blender 匯出器每次替兩顆髮髻的索引陣列排出
不同順序），所以每跑一次就換一個檔案 sha 而模型不變；這些 sha 在這裡的用途
是「同一次比對的兩個檔案相不相同」，不是指現在出貨的那一份。穩定的識別碼是
vertex sha b9807e3cb3dc7fc6。

規則：每道防線單獨拿掉一次，確認對應的檢查會紅；全部還原後控制組要綠。
還原基準一律是「原檔的位元組複本」，不是 `git checkout --`：第 1–10 條做的時
候修正還沒 commit，那時 checkout 會連修正一起抹掉；第 11–14 條做的時候已經
commit 在 b3da0f1，但仍然沿用複本，因為同一套做法對兩種情況都成立。每次替換
都斷言 pattern 命中數為 1，pattern 靜默失配就當場失敗——第 14 條就是這樣被擋
下來的，那個 pattern 在檔案裡出現兩次。

種子固定 15：那一輪會抽中 Acc_Bandage_Thigh，也就是唯一同時承載
Hutomomo_big 與 Hutomomo_slim 的部件，刪掉它才會逼出這一類缺陷。

## 1. prune_shapes 停用
    EVIDENCE guard=prune_shapes control=RESULT-True mutated=RESULT-False
    EVIDENCE guard=selftest:shape-key-parts control=ok mutated=FAIL
    EVIDENCE guard=selftest:manifest-displace control=ok mutated=FAIL
`customise.apply` 的 `orphan_keys = prune_shapes(...)` → `orphan_keys = []`
    [FAIL] every shape key names live parts
    [FAIL] 6 shape keys in the manifest still displace
    RESULT False

## 2. 檔案側的 target 刪除停用（manifest 照樣重建）
    EVIDENCE guard=selftest:file-in-manifest control=ok mutated=FAIL
    EVIDENCE guard=prune_shapes control=RESULT-True mutated=RESULT-False
`prune_shapes` 的 `keep = {ti for ti, _ in survives}` → `keep = set(range(len(names)))`
    [FAIL] 6 shape keys in the file are all in the manifest
    RESULT False

註：第一版的 prune_shapes 把 manifest 的 key 從「刪除後剩下的位置」取回來，
兩個寫入互相依賴，這一條 mutation 只會拋 KeyError 而不是讓檢查變紅。改成
manifest 依名字重建之後兩者才各自可斷。一道拆不開的防線等於證明不了它有效。

## 3. palette 清理停用
    EVIDENCE guard=selftest:palette-parts control=ok mutated=FAIL
`remap` 的 `pal['parts'] = [p for p in ... if p in manifest['parts']]` → `pass`
    [FAIL] every palette entry names live parts
    RESULT False

## 4. sparse min/max 的條件停用
    EVIDENCE guard=loose_sparse_bounds control=0 mutated=4
`glb.add_sparse_accessor` 的
`lo, hi = values.min(...), values.max(...)` ＋ `if len(indices) < count:` 那兩行
→ 還原成無條件 `np.minimum(..., 0.0)` / `np.maximum(..., 0.0)`，重建到
out/mut-milfy.vrm（不是 /tmp：blender 資產是相對輸出路徑找的，寫到 /tmp 會
靜默退回手刻服裝，整個模型換一份，mutation 等於沒做——第一次就踩到了）
    sparse accessors with wrong min/max: 4
    accessor 676 declares min.z 0.0,           resolves to 0.00045328843
    accessor 698 declares max.x 0.0,           resolves to -0.00577684864
    accessor 699 declares min.x 0.0,           resolves to 0.00318034808
    accessor 702 declares min.y 0.0,           resolves to 0.00003032929
正好是 code reviewer 在修正前的出貨檔上點名的那四個。

## 6. customise.apply 的材質清掃停用
    EVIDENCE guard=selftest:no-idle-material control=ok mutated=FAIL
    EVIDENCE guard=sweep_materials control=RESULT-True mutated=RESULT-False
`idle_materials = sweep_materials(doc) if drop else []` → `= []`
種子 2（會抽中 Acc_Crown）
    [FAIL] no material is left painting nothing
    RESULT False
還原後同一顆種子全綠。

## 7. prune_shapes 的 manifest 欄位耦合（不是 selftest 抓得到的，直接量）
    EVIDENCE guard=prune_shapes control=4-targets mutated=6-targets
`shapes = manifest.get('shapes') or {}` → 還原成「沒有就 early return」
用一份拿掉 shapes 區塊的 manifest 刪 Acc_Bandage_Thigh：
    mutated:  targetNames 六個原封不動（兩個死滑桿留著）
    restored: targetNames 剩四個
selftest 走不到這條路徑（它的 manifest 一定有 shapes），所以這一項沒有測試
守著，只有這次的量測。

## sweep 追不到 sparse view 的實際後果（第 1 輪第 4 項的數字來源）
種子 15（刪 Acc_Ribbon_Hair、Acc_Bandage_Thigh、Hair_Side_L）
    乾淨版                    views dropped 191
    兩個半邊都拿掉            views dropped 351，寫得出檔，讀 target 時
                              IndexError: index 65536 is out of bounds
                              for axis 0 with size 2418
    只拿掉「收集」那半        sweep 當場 KeyError: 664
第 1 輪的註解寫「393／129」而沒說是哪一組刪件，數字重現不出來，已改成上面
這組並在註解裡標明種子。

## 8. 材質清掃落在 make.py 第 2 步上的端到端等價檢查（不是 mutation）
`apply` 加了 sweep_materials 之後，make.py 第 2 步（strip VRoid 服裝）也會清。
把 partition → strip → skin → proportion → build 整條重跑一次比對最終位元組：
    重跑後 out/milfy.rerun.vrm  sha b2de2d7dcd48fdbd
    出貨的 out/mika-milfy.vrm   sha b2de2d7dcd48fdbd
相同。逐步輸出在 rerun.log，產物 out/milfy.rerun.vrm 保留在工作樹上供覆核
（第一次做這個比對時把中間檔清掉了，reviewer 無法覆核，這次留著）。差別只在中間 log：第 2 步現在會印「掃掉 5 個」（F00_* 那五個），
build.py 結尾印「掃掉 5 個」（Milfy_* 那五個），之前是結尾一次印 10 個；
連帶描邊從改 13 個材質變成 10 個、邊光從寫進 19 個變成 14 個。

## 9. sweep_materials 的兩個成對寫入，各自單獨破（第 3 輪 code review 第 1 項）
    EVIDENCE guard=selftest:matprops control=ok mutated=FAIL
    EVIDENCE guard=sweep_materials control=RESULT-True mutated=RESULT-False
第 3 輪之前只有 materials 那半被釘住：把 materialProperties 那一行單獨拿掉，
當時的 selftest 十六條全綠、verify 八項全 0，寫出來的檔是 30 個材質配 34 個
materialProperties（加了新檢查之後才變成十七條與九項）。加了逐位置比對名字的檢查（verify 與 selftest 各一條）之後：

`doc['extensions']['VRM']['materialProperties'] = [props[i] for i in keep]` → `pass`
種子 2
    [FAIL] materialProperties still line up with materials
    RESULT False

`doc['materials'] = [doc['materials'][i] for i in keep]` → `pass`
種子 2
    [FAIL] retinted materials are still on the model
    [FAIL] no material is left painting nothing
    [FAIL] materialProperties still line up with materials
    RESULT False

兩個半邊現在都單獨可斷。第二個會同時點亮三條是因為它把整個材質陣列留在原地，
本來就是比較大的破壞。

## 控制組（全部還原）
    python3 selftest.py out/mika-milfy.vrm out/mika-milfy.parts.json 20 → PASS
    （逐輪輸出在 gates.log 的 `=== selftest 20 rounds ===` 區塊，以該區塊末尾
      的 `20 rounds: PASS` 收尾。這裡刻意不寫行號：這份收據前後被行號害過兩
      次——先是指到已改名的檔案，再是指到 gates.log 重跑後偏移掉的行區間，而
      兩次錯的指標都照樣讀起來像有憑有據。標記字串會跟著內容走，行號不會。）
    python3 verify.py out/mika-milfy.vrm → PASS（sparse min/max 0）
    python3 verify.py out/mika-milfy.vrm <baseline> → PASS

## 5. torn_shapes 從候選檔認表情網格的那段停用
    EVIDENCE guard=torn_shapes control=0 mutated=30
`verify.torn_shapes` 的 blendShapeMaster binds 三行 → `inherited = set()`
（回到只靠 baseline 認的舊行為）
    mutated:  no baseline 30 筆、with baseline 0 筆
    restored: no baseline  0 筆、with baseline 0 筆
30 這個數字與 code reviewer 在修正前量到的相同，這一次是我自己重跑的。
不帶 baseline 是 verify.py 模組 docstring 明文允許的用法，所以那 30 筆是對一
個完全正確的檔案報的假缺陷。

## 10. manifest 的鍵順序（不是 mutation，是兩條路徑比對）
第 4 輪 code reviewer 指出：`out/milfy.rerun.parts.json` 與出貨的 manifest 內容
相同、位元組不同。原因是 build.py 結尾對 `palette`／`shapes` 是「賦值」而不是
重建 dict，Python 保留插入順序，於是先前階段已經放進去的鍵保住舊位置、新鍵接
在後面——從乾淨的 out/ 跑會得到 shapes 在 palette 之前。
修法：build.py 結尾依固定鍵序 ('source','parts','palette','shapes','landmarks')
重建一次。修完之後兩條路徑比對：
    out/mika-milfy.vrm         b2de2d7dcd48fdbd
    out/milfy.rerun.vrm        b2de2d7dcd48fdbd
    out/mika-milfy.parts.json  1339868bb59e4cac
    out/milfy.rerun.parts.json 1339868bb59e4cac
VRM 的 sha 沒有因此改變（manifest 是在 VRM 存檔之後才寫的）。

第五輪追記：白名單改成排序（已知鍵固定順序、未知鍵按名字排尾端）。白名單把
「順序漂移」換成了「未來新增的區段被靜默丟掉」，而沒有任何下游擋得住後者——
verify.py 從不開 manifest、selftest 只讀 parts／palette／shapes、make.py 不比
對鍵集合，三處都逐一確認過。排序版沒有任何過濾步驟，所以丟不掉東西，不需要
再加 assert 去事後抓。改完之後重跑 make.py，manifest 的 sha 仍是
1339868bb59e4cac、鍵序仍是 source/parts/palette/shapes/landmarks，兩條路徑
一致。


## 11. verify 的三道純偵測器（把缺陷注入出貨檔的複本，確認它們叫得出來）
    EVIDENCE guard=loud_outlines control=0 mutated=1
    EVIDENCE guard=undeclared_rims control=0 mutated=1
    EVIDENCE guard=ragged_targets control=0 mutated=1
這三道不是「拿掉修正看檢查變紅」，它們本身就是檢查——對應的 mutation 是把它
們要抓的缺陷做進檔案裡，確認偵測器會響、而出貨的位元組上是 0。

控制組（out/mika-milfy.vrm 原樣）
    loud_outlines 0、undeclared_rims 0、ragged_targets 0

`loud_outlines`：把 F00_000_00_FaceMouth_00_FACE 的 _OutlineColor 設成 VRoid
原本那個酒紅 (0.2745, 0.0902, 0.1255) → out/mut-loud.vrm
    flagged F00_000_00_FaceMouth_00_FACE (0.275, 0.09, 0.126) chroma 0.184
    count 1
（0.184 遠高於 OUTLINE_CHROMA_MAX 0.04，正是這一輪從 13 個材質上拿掉的那個值。）

`undeclared_rims`，兩種形狀各驗一次：
    刪掉 F00_000_00_EyeWhite_00_EYE 的 _RimColor（原本 [0.518,0.784,0.776,1.0]）
      → out/mut-norim.vrm    flagged ['F00_000_00_EyeWhite_00_EYE']  count 1
    把 F00_000_00_FaceEyeline_00_FACE 的 _RimColor 宣告成 (0,0,0)
      → out/mut-blackrim.vrm flagged ['F00_000_00_FaceEyeline_00_FACE']  count 1
第二種是重點：three-vrm 把「沒宣告」讀成黑色，所以宣告成黑等於沒宣告，兩條路
都得攔下來，否則那個材質在瀏覽器裡會吃到站上的火星橘。

`ragged_targets`：把 Face.baked 第 0 個 primitive 的 target 砍掉一個
→ out/mut-ragged.vrm
    counts before [56] -> after [55, 56]
    flagged [('Face.baked', [55, 56])]  count 1

## 12. SHAPE_KEY_MIN_MEAN
    EVIDENCE guard=SHAPE_KEY_MIN_MEAN control=6-keys mutated=7-keys
`build.py` 的 `SHAPE_KEY_MIN_MEAN = 0.001` → `= 0.0`，重建到
out/mut-minmean.vrm（同樣建在 out/，不是 /tmp，理由見第 4 項）
    控制組 Body.baked targetNames 6 個：
      (No bra)Breasts_Cow, Breast_big, Breast_small, Hutomomo_big,
      Hutomomo_slim, Waist_slim
    mutated 7 個：上面六個 ＋ Side adjustment
    建置 log 自己印出證據：「Side adjustment 0 點/平均 0.0mm」
也就是說門檻拿掉之後，廠商那個在 FBX 裡每個 delta 都是零的空 key 就會出貨，
變成一根拉了不會動的滑桿。還原後回到 6 個。

## 13. 前端 avatarRim.test.ts 的五條，五種 mutation 各自紅
    EVIDENCE guard=frontend:avatarRim control=5-passed mutated=1-failed-each
改 `src/components/chat/avatarGuideEngine.ts`，每次只破一處，還原用原檔的位
元組複本。每次替換都斷言 pattern 命中數為 1，pattern 靜默失配就當場失敗，不
會偽裝成「守衛有效」。

    控制組                                        Tests 5 passed (5)
    1 rimBase 不理會模型宣告的顏色（永遠回 fallback）
        紅：draws a body in the colour it states
    2 把黑色當成「已宣告」（`if (stated)`）
        紅：hands black back to the site rather than reading it as "no rim"
    3 rimBase 回傳材質自己的物件而不是 clone
        紅：returns a copy, so the per-frame scale cannot eat the base
    4 擷取時寫死常數（`base: new THREE.Color(RIM_FALLBACK)`）
        紅：asks the model, rather than capturing a constant
    5 逐幀迴圈對所有材質寫同一個顏色
        紅：scales each material by its own base in the frame loop
    還原後                                        Tests 5 passed (5)

五次各自只紅一條，而且紅的正好是對應那條——沒有互相遮蔽，每道防線都單獨可斷。

## 14. selftest 的「每個 mesh 只有一個 target 數」
    EVIDENCE guard=selftest:target-count control=ok mutated=FAIL
前面 13 條裡沒有任何一條會點亮這一條，所以它單獨補一次。破法選 prune_shapes
刪 target 時只走第一個 primitive——這是這段程式最容易寫錯的形狀，而 glTF 要求
同一 mesh 的每個 primitive 宣告相同的 target。

`prune_shapes` 的 `for pr in mesh['primitives']:` → `mesh['primitives'][:1]:`
（這個 pattern 在 customise.py 裡出現兩次，命中數斷言當場擋下來了，改用前兩行
  `if ti in keep: / continue:` 一起當錨點才唯一）
種子 15（刪 Acc_Ribbon_Hair、Acc_Bandage_Thigh、Hair_Side_L）
    [FAIL] 4 shape keys in the manifest still displace
    [FAIL] every mesh keeps one morph target count
    RESULT False
還原後同一顆種子 RESULT True。

**14b 隔離版。** 上面那個破法同時點亮兩條，而第 15 節自己立的標準是「分不開就
等於沒有單獨釘住其中任何一條」——同一份檔不能對兩條收據用兩套標準（第 7 輪
spec review 點名）。改用只讓「數量不一致」成立、而每個 manifest 指名的 key 仍
然位移的形狀：prune 完之後，在第 0 個 primitive 上多掛一個重複的 target。
（這也是真實會犯的錯：把 key 只嫁接到帶它的那個 primitive 上。）
種子 15
    [FAIL] every mesh keeps one morph target count
    RESULT False
只有這一條紅，位移那條保持綠。兩條確認互相獨立可斷。

## 15. selftest「every palette entry names a material still in the file」
    EVIDENCE guard=selftest:palette-material control=ok mutated=FAIL
第 6 輪 spec review 抓到：守衛表把這條標成收據 3，但收據 3 紅的是另一條
（`every palette entry names live parts`）。這條當時確實沒有任何收據。

先試「拿掉 customise.py 的 `manifest['palette'] = {... if e['parts']}`」，
種子 2：
    [FAIL] every palette entry names live parts
    [FAIL] every palette entry names a material still in the file
兩條一起紅——這個寫入端同時擋著兩條，**分不開就等於沒有單獨釘住其中任何一
條**。所以改用只有這條抓得到的缺陷形狀：palette 的鍵是材質名，把某一鍵改成
檔案裡不存在的材質，而它的部件仍然活著。

第一次挑的 victim 是 Mellow_Belt_Acc，結果兩條都綠——因為它唯一的部件
Acc_Belt_Waist 正好在種子 2 的刪除名單裡，整個條目被「沒有部件就丟掉」那一
步清掉了，根本輪不到名字檢查。這次假陰性本身值得記下來：**注入的缺陷要先確
認它真的活到被檢查的那一刻**。改挑部件不在刪除名單裡的 Mellow_Inner：

`Mellow_Inner`（部件 Outfit_Top，種子 2 不刪它）→ 鍵改名為 NoSuchMaterial_XYZ
    [ok]   every palette entry names live parts
    [FAIL] every palette entry names a material still in the file
    RESULT False
只有這一條紅，另一條保持綠。兩條互相獨立可斷，確認成立。

## 16. verify.unused_materials（不是 selftest 那條）
    EVIDENCE guard=unused_materials control=0 mutated=2
同樣是第 6 輪抓到的標錯：守衛表把 `verify.unused_materials` 標成收據 6，但收
據 6 全程沒有跑 verify.py，紅的是 selftest 的 `no material is left painting
nothing`。兩者擋的是同一件事，但分屬兩支程式，要各自有收據。

`customise.apply` 的 `idle_materials = sweep_materials(doc) if drop else []`
→ `= []`，刪 Acc_Crown，然後拿 verify.py 判產物：
    控制組   verify.unused_materials -> 0 []
    mutated  verify.unused_materials -> 2 ['Milfy_Gold', 'Milfy_GoldInner']
正是第五節第 13 項點名的那兩個材質。

## 17. verify.misaligned_material_properties（不是 selftest 那條）
    EVIDENCE guard=misaligned_material_properties control=0 mutated=1
第 7 輪 spec review 抓到，是收據 16 那個標錯的第三次：守衛表把
`verify.misaligned_material_properties` 標成收據 9，但收據 9 印出來的是
selftest 的 `[FAIL] materialProperties still line up with materials`，全程沒有
跑過 verify.py。兩者擋同一個不變量但分屬兩支程式，要各自有收據——這正是收據
16 自己寫下的規則，而同一份表在同一輪沒有把它套到第三列。

用收據 9 的同一個破法，跑在 scratchpad 的複本上（不動 repo）：
`customise.sweep_materials` 的
`doc['extensions']['VRM']['materialProperties'] = [props[i] for i in keep]`
→ `pass`，刪 Acc_Crown，然後拿 verify.py 判產物：
    控制組   verify.misaligned_material_properties -> 0 []
    mutated  verify.misaligned_material_properties -> 1
             [(-1, '32 materials', '34 materialProperties')]

為了讓這一類不再靠逐輪人工比對，第七輪加過一支 `scripts/avatar/receipts.py`。
**它在第九輪之後被移除了**（RESULT.txt 第 45 項）：第 8、9 兩輪四份 review 的
每一條 FAIL 都打在它身上，而它只是防未來回歸用的，成本高於價值。下面留著它的
紀錄，因為那是這一族缺陷最清楚的一個案例。

**它第一版的判準是錯的，這裡留著紀錄。** 當時寫的是「收據必須提到這道守衛失敗
時印出的那一行字串」——但那種字串不存在：`verify.report()` 是無條件印出每一道
偵測器名字的，通過時印 `coloured outlines: 0`，所以一段全綠輸出裡十六個字串全
都在。第八輪 reviewer 用一份「一個 mutation 都沒跑」的檔案拿到 16/16、exit 0。
現在的判準是本檔每一節的 `EVIDENCE guard=… control=… mutated=…` 行，且兩值必須
不同；散文提到守衛的名字不算數。第九輪又補了兩處：單位從「收據編號」抬到「引用
點」（編號跨列重複，會讓新增的列靜默逃掉），以及每個守衛只在自己那一列裡找引用
（否則沒有引用的列會吃到下一列的）。
