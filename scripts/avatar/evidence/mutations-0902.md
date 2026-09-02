# 第三版新增測試的紅燈驗證（2026-09-02 收尾時跑）

還原基準：09-01 的修正尚未 commit，一律用位元組副本還原（cp 到 scratchpad 再 cp 回來），
不用 git checkout --（見 mutation_baseline_must_be_committed）。每個 mutation 落地前先
斷言 pattern 命中數 = 1。

## A. appearance_test.py + spring_test.py 對第二版位元組（等價於「還原修正」）
MODEL 改指 out/milfy.rerun.vrm（sha b2de2d7dcd48fdbd，第二版模型）；appearance 的
MANIFEST 用第三版的 out/mika-milfy.parts.json（部件→primitive 索引兩版相同，下面大腿
那條的失敗訊息證明解到的是正確的 primitive）。
```
FFFFFFF
======================================================================
FAIL: test_hair_material_preserves_tone_after_live_exposure (appearance_test.AppearanceTest.test_hair_material_preserves_tone_after_live_exposure)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 109, in test_hair_material_preserves_tone_after_live_exposure
    self.assert_material_tone('F00_000_Hair_00_', HAIR_FACTOR_MAX)
    ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 90, in assert_material_tone
    self.assertTrue(has_visible_tone, f'{material["name"]} 乘色為 {base}')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : F00_000_Hair_00_HAIR_01 乘色為 [1, 1, 1]

======================================================================
FAIL: test_hair_texture_keeps_visible_tone_under_mtoon_lighting (appearance_test.AppearanceTest.test_hair_texture_keeps_visible_tone_under_mtoon_lighting)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 102, in test_hair_texture_keeps_visible_tone_under_mtoon_lighting
    self.assertTrue(has_natural_tone, f'髮色中位數為 {median}')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : 髮色中位數為 [227. 218. 208.]

======================================================================
FAIL: test_skin_material_preserves_tone_after_live_exposure (appearance_test.AppearanceTest.test_skin_material_preserves_tone_after_live_exposure)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 105, in test_skin_material_preserves_tone_after_live_exposure
    self.assert_material_tone('F00_000_00_Face_00', SKIN_FACTOR_MAX)
    ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 90, in assert_material_tone
    self.assertTrue(has_visible_tone, f'{material["name"]} 乘色為 {base}')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : F00_000_00_Face_00_SKIN 乘色為 [1, 1, 1]

======================================================================
FAIL: test_skin_texture_keeps_visible_tone_under_mtoon_lighting (appearance_test.AppearanceTest.test_skin_texture_keeps_visible_tone_under_mtoon_lighting)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 96, in test_skin_texture_keeps_visible_tone_under_mtoon_lighting
    self.assertTrue(has_natural_tone, f'膚色中位數為 {median}')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : 膚色中位數為 [245. 237. 229.]

======================================================================
FAIL: test_thigh_band_diameter_matches_the_thigh (appearance_test.AppearanceTest.test_thigh_band_diameter_matches_the_thigh)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/appearance_test.py", line 126, in test_thigh_band_diameter_matches_the_thigh
    self.assertTrue(is_fitted, f'腿帶／大腿直徑比為 {ratio}')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.False_ is not true : 腿帶／大腿直徑比為 [1.4740319 1.2888373]

======================================================================
FAIL: test_short_hair_does_not_use_unstable_legacy_springs (spring_test.SpringTest.test_short_hair_does_not_use_unstable_legacy_springs)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/spring_test.py", line 34, in test_short_hair_does_not_use_unstable_legacy_springs
    self.assertEqual([], legacy_roots)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != ['HairJoint-69ab4d0b-9325-4faa-9597-bd0c6a[303 chars]ed8']

Second list contains 7 additional elements.
First extra element 0:
'HairJoint-69ab4d0b-9325-4faa-9597-bd0c6abc8780'

- []
+ ['HairJoint-69ab4d0b-9325-4faa-9597-bd0c6abc8780',
+  'HairJoint-c573865e-9332-44b5-8d9e-3c20f456bdeb',
+  'HairJoint-161c1b7f-c33b-432a-820b-dff14d25bc7a',
+  'HairJoint-b91b9ff0-e0f4-4f2e-b97c-564a60e1005b',
+  'HairJoint-0ac4a3ee-0fd3-4627-9aed-3928d863f9f6',
+  'HairJoint-a8676c3f-a6f7-492f-90a6-3a5babeed491',
+  'HairJoint-6860b79f-73ad-4520-99f0-4b3fcbd9ced8']

======================================================================
FAIL: test_twintail_springs_do_not_project_against_head_colliders (spring_test.SpringTest.test_twintail_springs_do_not_project_against_head_colliders)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/spring_test.py", line 25, in test_twintail_springs_do_not_project_against_head_colliders
    self.assertEqual([], group['colliderGroups'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != [3, 4, 7, 5, 8, 6, 9, 1, 0, 2]

Second list contains 10 additional elements.
First extra element 0:
3

- []
+ [3, 4, 7, 5, 8, 6, 9, 1, 0, 2]

----------------------------------------------------------------------
Ran 7 tests in 0.322s

FAILED (failures=7)
RED-CHECK v2 model: failures=7 errors=0 of 7
  test_hair_material_preserves_tone_after_live_exposure -> AssertionError: False is not true : F00_000_Hair_00_HAIR_01 乘色為 [1, 1, 1]
  test_hair_texture_keeps_visible_tone_under_mtoon_lighting -> AssertionError: False is not true : 髮色中位數為 [227. 218. 208.]
  test_skin_material_preserves_tone_after_live_exposure -> AssertionError: False is not true : F00_000_00_Face_00_SKIN 乘色為 [1, 1, 1]
  test_skin_texture_keeps_visible_tone_under_mtoon_lighting -> AssertionError: False is not true : 膚色中位數為 [245. 237. 229.]
  test_thigh_band_diameter_matches_the_thigh -> AssertionError: np.False_ is not true : 腿帶／大腿直徑比為 [1.4740319 1.2888373]
  test_short_hair_does_not_use_unstable_legacy_springs -> AssertionError: Lists differ: [] != ['HairJoint-69ab4d0b-9325-4faa-9597-bd0c6a[303 chars]ed8']
  test_twintail_springs_do_not_project_against_head_colliders -> AssertionError: Lists differ: [] != [3, 4, 7, 5, 8, 6, 9, 1, 0, 2]
```

同兩檔指回出貨檔 public/avatar/mika-milfy.vrm（95b79fd3910eb98a）：
```
Ran 5 tests in 0.262s

OK
Ran 2 tests in 0.005s

OK
```

## B. customise_test.py 的 mutation（lighten 永遠 1.0）
```
mutation landed (pattern hits = 1)

FAILED (failures=1)
-- restored --
OK
restored-identical
```

## C. outfit_test.py 的四個 mutation（各自只該紅對應那條）
### mutation A: 主環以外的 primitive 不變換（pattern hits = 1）
```
FAIL: test_companion_primitive_uses_the_same_affine_fit (__main__.RingFitTest.test_companion_primitive_uses_the_same_affine_fit)
FAILED (failures=1)
FAILED (failures=1)
```
### mutation B: 間隙只加一倍（pattern hits = 1）
```
FAIL: test_main_ring_matches_limb_diameter_with_clearance (__main__.RingFitTest.test_main_ring_matches_limb_diameter_with_clearance)
FAILED (failures=1)
FAILED (failures=1)
```
### mutation C: y 也被平移（pattern hits = 1）
```
FAIL: test_fit_preserves_vertical_positions (__main__.RingFitTest.test_fit_preserves_vertical_positions)
FAILED (failures=1)
FAILED (failures=1)
```
### mutation D: morph delta 不縮放（pattern hits = 1）
```
FAIL: test_fit_scales_morph_deltas (__main__.RingFitTest.test_fit_scales_morph_deltas)
FAILED (failures=1)
FAILED (failures=1)
```
還原後：
```
OK
restored-identical
```

## D. outfit_test.py 第五條（法線走 inverse scale；code reviewer 第一輪指出的覆蓋缺口）
### mutation E: normal_scale 用 scale 而非 1/scale（pattern hits = 1）
```
mutation landed (pattern hits = 1)
FAIL: test_fit_bends_normals_by_the_inverse_scale (__main__.RingFitTest.test_fit_bends_normals_by_the_inverse_scale)
FAILED (failures=1)
-- restored --
OK
restored-identical
```

## 後記（code review 第二輪指出）
C 段的四個收據是對「四條測試的套件」擷取的。補上第五條法線測試之後，mutation A
（主環以外不變換）會同時觸發第五條對 jewel 法線長度的斷言（未變換的法線長 √2），
在現行套件上重跑會是 failures=2 而非收據裡的 failures=1。RESULT.txt 只宣稱「各自
轉紅」沒有宣稱唯一性，所以文件不因此為假；此註記錄收據的擷取時點，避免未來重跑對不上數字時誤判收據造假。
