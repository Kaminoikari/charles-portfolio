# mutations-0905-restpose：Phase 2（outfit.py rest-pose 正規化）的 15 道 mutation

harness：`scratchpad/mutate_phase2.py`（byte copy 備份、pattern 命中數必須為 1、寫入後刪 `__pycache__`、單一具名測試、sha256 驗還原）。
R1–R11 是第一輪；R12–R14 是 review 第一輪逼出來的三道守衛（精確對角矩陣、反向拒收、繼承），R15 是第二輪的（Shoulder 不轉）。第一輪 R8 曾 GREEN：R7 與 R8 的替換等長、同一秒落地，CPython 沿用 R7 的 .pyc；harness 加刪快取後全部重跑，以下是最終原始碼上的結果。

| # | guard | result |
|---|---|---|
| R1 | (a) the turn comes from segment directions, not from the bone frames (the textbook retarget) | RED |
| R2 | (a) an agreeing segment yields None, which is what keeps the translation-only path bit-exact | RED |
| R3 | (b) a limb bone turns its cloth onto our segment (the pre-Phase-2 translation-only code) | RED |
| R4 | (c) the half turn follows the solved yaw instead of being hard-wired | RED |
| R5 | (c) a yaw off both half turns is refused | RED |
| R6 | (c) the yaw is solved from the landmarks | RED |
| R7 | (d) normals go through the blended turn | RED |
| R8 | (e) morph deltas go through the blended turn | RED |
| R9 | (f) a garment chain bone inherits its anchor turn in pieces() | RED |
| R10 | (f) a garment chain bone inherits its anchor turn in add_bones() | RED |
| R11 | (g) the trunk is translation-only by design | RED |
| R12 | (c) the snapped half turn is an exact diagonal, not sin/cos of the solved angle | RED |
| R13 | (i) an opposite-pointing segment is refused, not silently left unturned | RED |
| R14 | (h) a limb bone whose segment is not mapped inherits the turn above it | RED |
| R15 | (j) the shoulder is not a limb bone: adding it to CHILD_OF turns it and must go red | RED |

### R1
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit
======================================================================
FAIL: test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit (scripts.avatar.outfit_test.RestPose.test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 402, in test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit
    self.assertIsNone(rot, f'bone {bundle["snames"][i]} got a rotation on an identical rig')
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: array([[ 1.0000000e+00,  4.4408921e-16,  0.0000000e+00],
       [ 4.4408921e-16, -1.0000000e+00,  0.0000000e+00],
       [ 0.0000000e+00,  0.0000000e+00, -1.0000000e+00]]) is not None : bone UpperLeg.L got a rotation on an identical rig
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R2
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit
======================================================================
FAIL: test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit (scripts.avatar.outfit_test.RestPose.test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 402, in test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit
    self.assertIsNone(rot, f'bone {bundle["snames"][i]} got a rotation on an identical rig')
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: array([[1., 0., 0.],
       [0., 1., 0.],
       [0., 0., 1.]]) is not None : bone UpperLeg.L got a rotation on an identical rig
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R3
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_a_splayed_shin_lands_on_our_shin_line
======================================================================
FAIL: test_a_splayed_shin_lands_on_our_shin_line (scripts.avatar.outfit_test.RestPose.test_a_splayed_shin_lands_on_our_shin_line)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 415, in test_a_splayed_shin_lands_on_our_shin_line
    self.assertLess(off.max(), 0.001, f'shin axis off our shin line by {off.max() * 1000:.1f}mm')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.0658204877503557) not less than 0.001 : shin axis off our shin line by 65.8mm
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

### R4
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
======================================================================
FAIL: test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn (scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 426, in test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
    self.assertAlmostEqual(scale, 1.0, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.9569237341603162 != 1.0 within 9 places (0.043076265839683825 difference)
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### R5
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
======================================================================
FAIL: test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn (scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 433, in test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
    with self.assertRaises(outfit.BadFit) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: BadFit not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### R6
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
======================================================================
FAIL: test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn (scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 426, in test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
    self.assertAlmostEqual(scale, 1.0, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.9569237341603162 != 1.0 within 9 places (0.043076265839683825 difference)
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### R7
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_normals_on_a_turned_segment_turn_with_it
======================================================================
FAIL: test_normals_on_a_turned_segment_turn_with_it (scripts.avatar.outfit_test.RestPose.test_normals_on_a_turned_segment_turn_with_it)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 450, in test_normals_on_a_turned_segment_turn_with_it
    self.assertLess(along.max(), 1e-6, f'ring normals lean {np.degrees(np.arcsin(along.max())):.2f} deg along our shin')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.17364818253298778) not less than 1e-06 : ring normals lean 10.00 deg along our shin
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

### R8
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_morph_deltas_on_a_turned_segment_turn_with_it
======================================================================
FAIL: test_morph_deltas_on_a_turned_segment_turn_with_it (scripts.avatar.outfit_test.RestPose.test_morph_deltas_on_a_turned_segment_turn_with_it)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 461, in test_morph_deltas_on_a_turned_segment_turn_with_it
    self.assertLess(across.max(), 1e-6, f'deltas lean {np.degrees(np.arcsin(across.max())):.2f} deg off our shin')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.17364817470279953) not less than 1e-06 : deltas lean 10.00 deg off our shin
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R9
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_a_garment_chain_bone_inherits_its_anchors_rotation_in_pieces
======================================================================
FAIL: test_a_garment_chain_bone_inherits_its_anchors_rotation_in_pieces (scripts.avatar.outfit_test.RestPose.test_a_garment_chain_bone_inherits_its_anchors_rotation_in_pieces)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 469, in test_a_garment_chain_bone_inherits_its_anchors_rotation_in_pieces
    self.assertLess(off.max(), 0.001, f'frill off our shin line by {off.max() * 1000:.1f}mm')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.0658204877503557) not less than 0.001 : frill off our shin line by 65.8mm
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R10
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_a_garment_chain_bone_inherits_its_anchors_rotation_in_add_bones
======================================================================
FAIL: test_a_garment_chain_bone_inherits_its_anchors_rotation_in_add_bones (scripts.avatar.outfit_test.RestPose.test_a_garment_chain_bone_inherits_its_anchors_rotation_in_add_bones)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 480, in test_a_garment_chain_bone_inherits_its_anchors_rotation_in_add_bones
    self.assertLess(off, 0.001, f'chain bone off our shin line by {off * 1000:.1f}mm')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.032910243048615284) not less than 0.001 : chain bone off our shin line by 32.9mm
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R11
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_trunk_bones_stay_translation_only
======================================================================
FAIL: test_trunk_bones_stay_translation_only (scripts.avatar.outfit_test.RestPose.test_trunk_bones_stay_translation_only)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 500, in test_trunk_bones_stay_translation_only
    self.assertIsNone(rot, f'{name} was rotated; the trunk is translation-only by design')
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: array([[ 1.00000000e+00,  1.97405474e-16, -1.72707411e-17],
       [-1.97405474e-16,  9.84807753e-01, -1.73648178e-01],
       [-1.72707411e-17,  1.73648178e-01,  9.84807753e-01]]) is not None : hips was rotated; the trunk is translation-only by design
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

### R12
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn
rray_compare(operator.__eq__, actual, desired, err_msg=err_msg,
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header='Arrays are not equal',
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
yaw 180.0
Mismatched elements: 2 / 9 (22.2%)
Mismatch at indices:
 [0, 2]: -1.2246467991473532e-16 (ACTUAL), 0.0 (DESIRED)
 [2, 0]: 1.2246467991473532e-16 (ACTUAL), 0.0 (DESIRED)
Max absolute difference among violations: 1.2246468e-16
Max relative difference among violations: inf
 ACTUAL: array([[-1.000000e+00,  0.000000e+00, -1.224647e-16],
       [ 0.000000e+00,  1.000000e+00,  0.000000e+00],
       [ 1.224647e-16,  0.000000e+00, -1.000000e+00]])
 DESIRED: array([[-1.,  0.,  0.],
       [ 0.,  1.,  0.],
       [ 0.,  0., -1.]])
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### R13
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_a_segment_pointing_the_opposite_way_is_refused
======================================================================
FAIL: test_a_segment_pointing_the_opposite_way_is_refused (scripts.avatar.outfit_test.RestPose.test_a_segment_pointing_the_opposite_way_is_refused)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 440, in test_a_segment_pointing_the_opposite_way_is_refused
    with self.assertRaises(outfit.BadFit):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: BadFit not raised
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### R14
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_a_bone_whose_segment_is_not_mapped_inherits_the_turn_above_it
perator.__eq__, actual, desired, err_msg=err_msg,
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header='Arrays are not equal',
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
Mismatched elements: 9 / 9 (100%)
First 5 mismatches are at indices:
 [0, 0]: None (ACTUAL), 0.9848077530122082 (DESIRED)
 [0, 1]: None (ACTUAL), -0.17364817766692964 (DESIRED)
 [0, 2]: None (ACTUAL), -1.8605136645455274e-18 (DESIRED)
 [1, 0]: None (ACTUAL), 0.17364817766692964 (DESIRED)
 [1, 1]: None (ACTUAL), 0.9848077530122082 (DESIRED)
 ACTUAL: array(None, dtype=object)
 DESIRED: array([[ 9.848078e-01, -1.736482e-01, -1.860514e-18],
       [ 1.736482e-01,  9.848078e-01,  2.126577e-17],
       [-1.860514e-18, -2.126577e-17,  1.000000e+00]])
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### R15
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_the_shoulder_stays_translation_only_even_when_its_segment_differs
======================================================================
FAIL: test_the_shoulder_stays_translation_only_even_when_its_segment_differs (scripts.avatar.outfit_test.RestPose.test_the_shoulder_stays_translation_only_even_when_its_segment_differs)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 512, in test_the_shoulder_stays_translation_only_even_when_its_segment_differs
    self.assertIsNone(rot, f'{name} was rotated; the shoulder is a trunk bone in all but name')
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: array([[ 9.84807753e-01,  1.73648178e-01,  1.20604166e-16],
       [-1.73648178e-01,  9.84807753e-01, -1.05514973e-17],
       [-1.20604166e-16, -1.05514973e-17,  1.00000000e+00]]) is not None : leftShoulder was rotated; the shoulder is a trunk bone in all but name
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

exit 0
