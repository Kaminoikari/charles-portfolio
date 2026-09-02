# 第四版（collider 清理＋live-preview 修正）新守衛的紅燈驗證（2026-09-02）

## A. verify.stranded_collider_groups 對真實缺陷位元組
第三版出貨位元組留存於 out/milfy.v3.vrm（95b79fd3910eb98a），10 組孤兒：
```
   collider groups no spring uses: 10
   FAIL colliderGroups[0] (J_Bip_C_Spine) is referenced by no bone group
   FAIL colliderGroups[1] (J_Bip_C_UpperChest) is referenced by no bone group
   FAIL colliderGroups[2] (J_Bip_C_Neck) is referenced by no bone group
   FAIL colliderGroups[3] (J_Bip_C_Head) is referenced by no bone group
   FAIL colliderGroups[4] (J_Bip_L_UpperArm) is referenced by no bone group
   FAIL
```

## B. spring_test 的出貨檔孤兒測試，對修正前的出貨檔（public 仍是第三版時）
```
test_every_collider_group_is_referenced_by_a_spring ... FAIL
AssertionError: Lists differ: [] != [(0, 'J_Bip_C_Spine'), (1, 'J_Bip_C_UpperC…nd')]
（重建出貨後本條必須轉綠，見 gates-0902b.log 前的重跑記錄）
```

## C. twintail.prune_stranded_collider_groups 的 mutation（PruneTest 三條）
### mutation 1: 不 remap（引用保留舊索引）（pattern hits = 1）
```
mutation landed (pattern hits = 1)
FAIL: test_every_collider_group_is_referenced_by_a_spring (__main__.SpringTest.test_every_collider_group_is_referenced_by_a_spring)
ERROR: test_surviving_references_are_remapped_to_the_same_groups (__main__.PruneTest.test_surviving_references_are_remapped_to_the_same_groups)
FAILED (failures=1, errors=1)
（remap 測試以 IndexError 紅：引用留在舊索引、指出兩元素清單之外；
 SpringTest 那條照 B 段預期本來就紅著）
-- restored --
```
### mutation 2: 不壓縮清單（孤兒留著）（pattern hits = 1）
```
mutation landed (pattern hits = 1)
FAIL: test_stranded_groups_are_removed_and_named (__main__.PruneTest.test_stranded_groups_are_removed_and_named)
FAIL: test_surviving_references_are_remapped_to_the_same_groups (__main__.PruneTest.test_surviving_references_are_remapped_to_the_same_groups)
FAIL: test_every_collider_group_is_referenced_by_a_spring (__main__.SpringTest.test_every_collider_group_is_referenced_by_a_spring)
FAILED (failures=3)
-- restored --
FAILED (failures=1)
restored-identical
（還原後 7 條中仍有 1 條紅：出貨檔此時還是第三版，孤兒測試照 B 段預期紅著，重建後轉綠）
```

## D. live-preview.test.ts 的 gesture 測試改問引擎（GESTURE_NAMES）後的 mutation
### mutation: PREVIEW_GESTURES 少列一個手勢（拿掉 toeLook）（pattern hits = 1）
```
mutation landed (pattern hits = 1)
   × Mika Milfy live preview config > offers every procedural gesture exposed by the avatar handle 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 3 passed (4)
-- restored --
      Tests  4 passed (4)
restored-identical
```

## E. spring_test 的 Skirt 語意測試，對竄改副本（Skirt 引用改成 [0,0]）
```
doctored: Skirt colliderGroups -> [0, 0] (組 0 的節點是 J_Bip_L_UpperLeg )
AssertionError: Lists differ: ['J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg'] != ['J_Bip_L_UpperLeg', 'J_Bip_L_UpperLeg']
FAILED (failures=1)
doctored copy removed
```
