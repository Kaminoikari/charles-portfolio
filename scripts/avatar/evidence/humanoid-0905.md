# humanoid-0905：Phase 0 單一 humanoid reader 的收據

骨架泛化計畫第一步：Python 端 12 個模組 16 處、TypeScript 端 3 檔 7 處各自 inline 讀
`extensions.VRM.humanoid.humanBones` 的站點，全部改走一個 reader
（`scripts/avatar/humanoid.py` 與 `src/components/chat/vrmHumanoid.ts`），
reader 同時認 VRM 0.x 與 1.0。`vrmrig.py` 從 `~/vtuber-kit/bin` 搬進
`scripts/avatar/`（那個目錄沒有 git）。

出貨檔 `public/avatar/mika-milfy-10.vrm` 不動：這一步只搬讀取，不改任何幾何。

## 等價性：整條 make.py 重建前後

完整輸出在 `humanoid-0905-equiv.log`（2026-09-05 13:08:44–13:09:44）。重建前先 byte copy
八個輸出檔（out/ 與 public/ 的 .vrm、.parts.json、四張 final 算圖），跑完比對再還原。

```
出貨位元組 sha（重建前）: e6a2272871063584
vertex sha（重建前）: vertex sha ad8f3adc45f87430
make.py exit 0
vertex sha（重建後）: vertex sha ad8f3adc45f87430
算圖 final-front.png 差異像素 0
算圖 final-back.png 差異像素 0
算圖 final-three_quarter.png 差異像素 0
算圖 final-face.png 差異像素 0
已還原 8 個檔
出貨位元組 sha（還原後）: e6a2272871063584
```

重建位元組 sha 是 7b05318b50adcdc7（≠ e6a2）：head.py 的兩顆髮髻讓 make.py 位元組
不決定性（memory `project_milfy_replica_pipeline`），所以等價判準是 vertex sha ＋
四視角像素差，不是檔案位元組。

`verify.py` 對出貨檔：sha `ad8f3adc45f87430`、springs 4、colliders 17、groups 15，
與改前相同，只是這三個數字現在由 `humanoid.springs`／`humanoid.expression_names` 讀出。

## 測試基線（改後）

```
python3 -m unittest discover -s scripts/avatar -p '*_test.py'   → 90 tests OK
npx tsc -b                                                       → 0 errors
npx tsc --noEmit --strict … scripts/avatar/springsim.ts scripts/measure-motions.ts → 0 errors
npx vitest run rigProbe avatarVariants vrmHumanoid springsim measure-motions → 5 files, 138 tests pass
python3 ~/vtuber-kit/bin/check_variants.py --models ~/portfolio/public/avatar → 兩具出貨身體與 AvatarSample_B 骨架相同，exit 0（humanoid-0905-check-variants.log；不帶 --models 時 kit 的 models/ 是空的，CLI 自己回 exit 1）
```

## Mutation：十七道守衛各自轉紅

每道：byte copy 原檔 → 字串替換（命中數必須恰為 1，否則 ABORT）→ 跑該守衛的
單一測試 → byte copy 還原 → 還原後 sha256 必須等於原檔。十七道全部 RED、
`restored=True`。不用 `git checkout --`（修正尚未 commit）。逐道的確切指令與
紅字輸出在 `mutations-0905-humanoid.md`。M1–M9 是第一輪；M10–M16 是 diff reviewer
指出「新守衛沒有收據」與「registry 表情測試被 `?? []` 弄弱」之後補的第二輪；
M17 是 spec reviewer 指出 `vrmrig.py` 標頭宣稱 `vrm_version` 有收據但其實沒有之後補的。

| # | 守衛 | mutation | 紅在哪 |
|---|---|---|---|
| M1 | `vrmrig.human_bones` 讀 VRM 1.0 dict 形 | VRMC_vrm 分支改 `return {}` | `{} != {'hips': 0, 'spine': 1}` |
| M2 | `humanoid.body_skin` 走 manifest 的 Body_Skin mesh，不是 `skins[0]` | `return 0` | `0 != 1`（VRoid 身體在 skin 1） |
| M3 | `vrmrig.forward_z` 隨版本翻 | 恆回 `-1` | `-1 != 1` |
| M4 | 接線：`scripts/avatar/*.py` 沒人 inline 讀 humanBones | `pose.py` 塞回 `doc['extensions']['VRM']['humanoid']['humanBones']` | `['pose.py'] != []` |
| M5 | `readHumanoid` 讀 VRM 1.0（`rigProbe.buildRig` 吃出貨身體的 1.0 孿生） | 刪 `VRMC_vrm` 分支 | `not a VRM: neither extensions.VRM (0.x) nor extensions.VRMC_vrm (1.0)` |
| M6 | `parseGlb` 認 4-byte chunk padding | `offset += 8 + length`（不補 pad） | BIN chunk 找不到，`parsed.bin === null` |
| M7 | `readAccessorRows` 認 `byteStride` | stride 固定 `ncomp * size` | `[1, 0, 0.035, 0.035] != [1, 0, 0, 1]` |
| M8 | `readAccessorRows` 對 normalized 整數除以 255 | divisor 固定 1 | `[255, 0, 0, 255] != [1, 0, 0, 1]` |
| M9 | 接線：`src/`＋`scripts/` 的 .ts 沒人 inline 讀 humanBones | `springsim.ts` Poser 塞回 `extensions.VRM.humanoid.humanBones` | `these files read humanBones themselves … scripts/avatar/springsim.ts` |
| M10 | `vrmrig.spring_bones` 讀 VRM 1.0 的 `VRMC_springBone` | `sb = {}` | `0 != 1`（1.0 側 groups 為空） |
| M11 | `vrmrig.expression_names` 讀 1.0 的 preset＋custom | `expr = {}` | `[] != ['blink', 'aa', 'wink']` |
| M12 | `vrmrig.required_missing` 指名缺的必要骨 | `return []` | `'head' not found in []` |
| M13 | 接線：`scripts/**/*.py` 任何拼法的 `vtuber-kit` 路徑都被抓 | `make.py` 塞回 `sys.path.insert(0, os.path.expanduser('~/vtuber-kit/bin'))` | `['avatar/make.py'] != []` |
| M14 | 接線：`humanoid.py` 以外沒人直接 `import vrmrig` | `pose.py` 塞回 `import vrmrig` | `['avatar/pose.py'] != []` |
| M15 | `readExpressions` 讀 1.0 表情、兩個 extension 都沒有時拋錯 | 刪 1.0 分支與 throw，改 `return []` | `expected [] to deeply equal ['blink', 'aa', 'wink']` |
| M16 | registry 表情測試走 `readExpressions`，且 reference 必含 `Blink`／`A` | 0.x 分支改 `return []` | `expected [] to include 'Blink'` |
| M17 | `vrmrig.vrm_version` 對 `VRMC_vrm` 檔回 `'1'` | 1.0 分支改回 `'0'` | `'0' != '1'` |

M16 第一次跑是 GREEN：registry 測試只比「每個 variant 的名單相等」，reader 對三個
0.x 身體都回空時 `'' === ''` 照樣過，正是 reviewer 指的靜默 no-op。加上 reference
必含引擎會播的 `Blink`／`A` 之後才 RED；`mutations-0905-humanoid.md` 兩次輸出都留著。

M6／M7／M8 三道踩的是從 `rigProbe.ts` 搬出來的容器讀取（原本沒有測試）；
M5 的 1.0 孿生是測試內從 `AvatarSample_B_webp.vrm` 改寫 JSON（list→dict、scene root
轉 π、`extensionsUsed` 換名）產生的，斷言 `leftUpperArm.x ≈ +0.081`、
`rightUpperArm.x ≈ −0.081`、`head.y ≈ 1.32`、`leftEye.z > head.z`。

## 這一步沒做的事（記給後面的 phase）

- `rigProbe.applyMotion` 的 x/z 翻軸仍是 VRM0 專用；1.0 身體只有 rest pose 讀得對，
  動作要到 Phase 6a 才依 `humanoid.version` 條件化。
- `springsim.ts` 仍走 three-vrm 的私有 `_v0Import`；1.0 的 `VRMC_springBone` 要到
  Phase 6a 改 public `afterRoot()`。
- build 端 writer（`build.py`／`customise.py`／`twintail.py`）全寫 VRM0 結構
  （`proportion.py` 只動幾何，不寫 extension）；1.0 夾具進 `make.py --base` 要先過
  Phase 3.5 的入口轉換。
