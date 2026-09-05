# bonemap-0905：Phase 1 骨骼自動對應（bonemap.py）的收據

骨架泛化計畫第二步。`outfit.py` 原本靠一張 16 筆的人工 `MAP`（鍵是 MellowHeart 的
確切拼法）加兩行 `_L`→`.L` 的分隔符補丁；2026-09-02 外套只對上 4 根骨、擬合拒跑，
就是這種表對新拼法的反應。現在 `outfit.load` 向 `bonemap.resolve` 要錨點：
override（`bonemap/<vendor>.json`）＞ alias（`canonical()` 剝分隔符／數字尾碼／
側別／已知前綴，再查 `ALIASES`）＞ topology（只填 alias 沒填到的軀幹與四肢）。
`bonemap.require` 拒收缺 hips、缺上身錨點、錨點少於 8 根、或有帶權重卻沒對應祖先的
骨的對應，訊息指名缺哪一根。

出貨檔 `public/avatar/mika-milfy-10.vrm` 不動。

## 兩份服裝檔的對應表（`bonemap-0905-equiv.log:31-61`，make.py 印的）

bodice 組（mellow.glb，197 根骨）：16 根錨點、181 根鏈骨，全部 alias，與舊 `MAP` 的
16 筆一模一樣（`bonemap_test.VendorFiles.test_the_bodice_set_maps_exactly_what_the_hand_table_did`）。

cardigan 組（mellow_outer.glb，128 根骨）：10 根錨點、118 根鏈骨，全部 alias：
Hips／Spine／Chest／Neck／Shoulder_L・R／Upper_arm_L・R／Upper_leg_L・R。
與舊 `MAP` 對這個檔的結果相同。

## 偏離計畫：cardigan 的前臂／手／拇指先不當錨點（`bonemap-0905-16anchors.log`）

resolver 讀得到 `Lower_arm_*`／`Hand_*`／`Thumb Proximal_*`（後者靠 vendor 檔的
alias），第一次重建用了全部 16 根當錨點：

```
服裝擬合 mellow_outer.glb：縮放 x1.188，對位骨最大殘差 0.00mm，錨點 16 根   （出貨 build 是 x1.153、10 根）
服裝 shape key：(No bra)Breasts_Cow 6249 點/平均 5.3mm                      （出貨 build 是 6214 點/5.2mm）
vertex sha e8907a240c13ee5c                                                  （出貨是 ad8f3adc45f87430）
grafted shape keys that tear their mesh: 1
FAIL Body.baked#22 "(No bra)Breasts_Cow" stretches an edge 2.0x and flips 1 faces
make.py exit 1
```

純平移的逐骨修正把袖子拖到 VRoid 的前臂位置，嫁接在上身的 shape key 跟著撕裂。
這是 Phase 2 旋轉感知擬合要解的問題，不是 Phase 1（「對應變、幾何不變」）能收的。
所以 `bonemap/mellowheart.json` 用 `ignore` 把這三組骨留在鏈骨（跟著上臂走，
與 2026-09-05 以前相同），理由與上面的數字寫在檔案的 `_comment`；
`test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on` 釘住這個
檔，`test_the_resolver_can_name_the_cardigans_arm_and_thumb` 證明沒有 ignore 時
resolver 對得到。**Phase 2 解除 ignore 時要附收據。**

## 等價性：整條 make.py 重建前後（`bonemap-0905-equiv.log`，16:16:06–16:17:04）

```
出貨位元組 sha（重建前）: e6a2272871063584
vertex sha（重建前）: ad8f3adc45f87430
make.py exit 0
vertex sha（重建後）: ad8f3adc45f87430   相同
算圖 final-front.png 差異像素 0
算圖 final-back.png 差異像素 0
算圖 final-three_quarter.png 差異像素 0
算圖 final-face.png 差異像素 0
已還原 8 個檔
出貨位元組 sha（還原後）: e6a2272871063584
```

這是三輪 review 的所有程式改動（thumb 改名、ignore 分隔符、override 鍵檢查、
`from_blender`、topology 守衛收斂、`build.py` 直接 `import bonemap`、第三輪的 docstring
與 P23 測試）都落地後跑的。
同一份 log 的擬合行多了「錨點 N 根」後綴與一張對應表（未對應骨按 stem 列出），所以與
`build-0904-gapfix4.log:26,28` 不是逐位元組相同；相同的是三個數字：縮放 x1.172
（bodice）、x1.153（cardigan）、殘差 0.00mm。

## 測試與工具

```
python3 -W ignore -m unittest discover -s scripts/avatar -p "*_test.py"   → 117 tests OK（Phase 0 是 90；bonemap_test 26、outfit_test 的 LoadWiring 1）
blender -b --python scripts/avatar/blender/inspect_fbx.py -- --map Milfy_Outer.fbx
   → axis check: hips world y +0.675（Blender Z-up 已轉成 glTF Y-up）
   → 不帶 vendor 檔對到 14 根（含 Lower_arm／Hand，無拇指）、114 根鏈骨（bonemap-0905-inspect-map.log）
```

`--map` 在 Blender 自己的直譯器裡跑，那裡沒有 PIL；bonemap 因此不能 import render，
世界座標改走 `vrmrig.world_matrices`（從 `rest_positions` 抽出來的純 Python 走訪）
經 `humanoid.node_world` 取得。Blender 世界座標是 Z-up，`--map` 組節點時經
`bonemap.from_blender`（(x, y, z) → (x, z, −y)）轉成 glTF 的 Y-up，否則 topology 找不到
往下的腿與往上的脊椎（第一版就是這樣，只是那份 FBX 全靠 alias 所以沒現形；
`BlenderAxes` 測試與 P20 釘住）。

第二輪 diff review 另外修的三件事：VRM 1.0 target 的拇指用 `THUMB_VRM1` 改名查（0.x 的
`Proximal` 落在 1.0 的 `Metacarpal`，不是同名的 1.0 `Proximal`；第一版會讓 Proximal 與
Intermediate 對到同一個節點，P21）；`ignore` pattern 把 `.` 與 `_` 當同一個分隔符
（P14）；vendor 檔不認得的鍵（`ignores`）直接拒收（P19）、檔案讀不到指名路徑（P22）。

## Mutation：二十四道守衛各自轉紅（`mutations-0905-bonemap.md`）

| # | 守衛 | mutation | 紅在哪 |
|---|---|---|---|
| P1 | `canonical()` 認 `_L` 分隔符（四種拼法對應相同且全走 alias） | 尾端側別 regex 拿掉 `_` | `how` 集合多出 `topology`（中央骨仍走 alias，帶側別的 16 根被 topology 從形狀填回來，結果相同；第一次 GREEN，加 `how` 全為 alias 的斷言後才紅） |
| P2 | 鏈骨 stem 不得 alias 到 humanoid 骨 | 加 `'breast': 'chest'` | `Breast_L.001` 對到 chest |
| P3 | topology 從形狀填匿名四肢 | resolve 裡改成不呼叫 topology | 21 根全 None |
| P4 | override 勝 alias | 交換查表順序 | `Toe.L` 對到 leftToes 而非 leftFoot |
| P5 | `require` 指名缺 hips | 拿掉 hips 檢查 | 沒有拋錯 |
| P6 | `require` 拒收沒對應祖先的帶權重骨 | 拿掉祖先檢查 | 沒有拋錯 |
| P7 | topology 不拿胸部鏈當手臂 | `NEVER_HUMANOID = ()` | `Breast.L` 被對到 |
| P8 | vendor 檔把 cardigan 釘在 10 根錨點 | json 的 `ignore` 清空 | 對到 16 根 ≠ 10 根 |
| P9 | 接線：`outfit.load` 把 vendor 檔傳給 resolver | `resolve(src, tbones, None)` | `leftLowerArm` 出現在錨點 |
| P10 | 通用表認得 `Lower_arm` | 刪 `'lowerarm'` alias | `leftLowerArm` 找不到 |
| P11 | `mirror` 交換左右 | 忽略 mirror | `leftHand != rightHand` |
| P12 | `ignore` pattern 有作用 | `ignored()` 恆 False | `Toe.L` 仍被對到 |
| P13 | `canonical()` 先剝 `.001` 再讀側別 | 不剝尾碼 | `('breastl001', None) != ('breast', 'L')` |
| P14 | `ignore` 把 `.`／`_` 當同一分隔符 | 不做正規化 | `Toe.L` 仍被對到 |
| P15 | `require` 拒收沒有上身錨點的對應 | 拿掉 chest／neck 檢查 | 沒有拋錯 |
| P16 | `require` 拒收少於 8 根錨點 | 拿掉數量檢查 | 沒有拋錯 |
| P17 | merge：topology 的名字已被 alias 用掉就丟 | 不查 `taken` | `Bone.003` 拿到第二個 `neck` |
| P18 | topology 不改名 alias 已命名的軀幹節點 | 拿掉 `node not in known` | `'chest' != 'upperChest'` |
| P19 | vendor 檔不認得的鍵被指名拒收 | 不檢查鍵 | 沒有拋錯 |
| P20 | `from_blender` 把 Z-up 轉成 Y-up | 原樣回傳 | Hips 以外 20 根 None（hips 靠「≥3 條鏈的根」判定，不看 Y；腿與脊椎在 Z-up 下找不到） |
| P21 | VRM 1.0 target 的拇指走改名查表 | 不偵測 Metacarpal | `22 != 100`（0.x Proximal 落在 1.0 同名 Proximal） |
| P22 | vendor 檔讀不到時以 `BadMapping` 指名路徑 | 原樣拋 `FileNotFoundError` | 不是 `BadMapping` |
| P23 | topology 不改名 alias 已命名的 neck（neck/head 迴圈的 per-node 守衛） | 拿掉該迴圈的 `node not in known` | `'head' != 'neck'`（沒有 Head 的 rig，`head` 沒被佔用，merge 攔不住） |
| P24 | alias 階段：已被用掉的名字不給第二根骨（`.00N` 家族的 vendor alias 相撞） | 拿掉 `vrm in taken` | `leftHand` 出現三次（Hand.L 與兩根 Support_bone 都拿到） |

P1–P13 第一輪後，第二輪把 `ignored()`、topology 的守衛與 merge 改寫，所以 P1–P22 全部
重跑；P12 因舊 pattern 命中 0 而 ABORT，換 pattern 後單獨重跑 RED。P17／P18 是同一條測試
的兩道守衛，各自 mutation 各自紅（第一版 assign 裡還有一道 `name in inv` 與 merge 互相
遮蔽，已拿掉）。第三輪 diff reviewer 指出 neck/head 迴圈還有一道 per-node 守衛沒有測試、
且在有 Head 的 rig 上被 merge 遮蔽；補「沒有 Head、Chest 與 Neck 之間多一根無名骨」的
rig 測試與 P23，連同 P17／P18 重跑仍各自 RED。第三輪同時指出 alias 階段的 `vrm in taken`
（`.00N` 家族的 vendor alias 會讓多根骨同名）沒有測試，補相撞 rig 測試與 P24。每道 byte copy
還原、還原後 sha256 相等。

## 這一步沒做的事

- cardigan 前臂／手／拇指錨點（見上，Phase 2）。
- topology 只做 hips／脊椎／頸頭／四肢，不做手指、眼睛；手指靠 vendor 檔的 alias。
- alias 階段同名相撞（如 `Breast_L` 與 `Breast_L.001` 剝掉尾碼後相同）先到先得，落敗者
  進 `unmapped_nodes`，在對應表的 stem 列裡看得到（`breast×6`），沒有單獨標「相撞」。
- `outfit.py` 的擬合本身沒動：仍是 yaw 硬寫 π、純平移逐骨修正（Phase 2）。
