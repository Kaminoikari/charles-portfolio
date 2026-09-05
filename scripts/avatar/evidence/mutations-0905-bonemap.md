# mutations-0905-bonemap：Phase 1 骨骼自動對應（bonemap.py）二十四道守衛的 mutation 輸出

由 session scratch 的 mutate_phase1.py 產生：每道 byte copy 原檔 → 字串替換（命中數必須恰為 1，否則 ABORT）→ 跑該守衛的單一測試 → byte copy 還原 → 還原後 sha256 必須等於原檔。

第一輪 P1–P13：P1 第一次 GREEN（拼法測試只比對應結果，`_L` 讀不到時 topology 照樣從形狀把四肢填回來；加上「how 必須全是 alias」的斷言後才 RED）；P3／P7 在 topology 改走 humanoid.node_world 之後重跑。第二輪（diff reviewer 之後）：加 P14–P22，並因 ignored()／topology 守衛改寫全部重跑；P12 在第二輪 ABORT（舊 pattern 命中 0），改 pattern 後單獨重跑 RED。第三輪：diff reviewer 指出 neck/head 迴圈的 per-node 守衛沒有測試且被 merge 遮蔽，補 rig 測試與 P23，並連同 P17／P18 重跑。第三輪另一項：alias 階段的 vrm in taken 沒有測試，補相撞 rig 測試與 P24。所有輸出都留著。

## 第一輪 P1–P13（P1 GREEN）

P1 GREEN (mutation NOT caught)  restored=True
P2 RED  restored=True
P3 RED  restored=True
P4 RED  restored=True
P5 RED  restored=True
P6 RED  restored=True
P7 RED  restored=True
P8 RED  restored=True
P9 RED  restored=True
P10 RED  restored=True
P11 RED  restored=True
P12 RED  restored=True
P13 RED  restored=True

| # | guard | result |
|---|---|---|
| P1 | canonical() reads the `_L` separator (the 2026-09-02 cardigan failure) | GREEN (mutation NOT caught) |
| P2 | a garment chain stem (breast) must not be aliased onto a humanoid bone | RED |
| P3 | topology fills anonymous limbs from the rig shape | RED |
| P4 | the vendor override outranks the generic alias table | RED |
| P5 | require() names a missing hips instead of counting anchors | RED |
| P6 | require() refuses a weighted joint with no mapped ancestor | RED |
| P7 | topology never takes a breast chain for an arm | RED |
| P8 | the vendor file pins the cardigan to its ten tuned anchors | RED |
| P9 | wiring: outfit.load passes the vendor file to the resolver | RED |
| P10 | the generic table names the cardigan forearm (Lower_arm_L) | RED |
| P11 | mirror swaps L/R | RED |
| P12 | ignore patterns are applied | RED |
| P13 | canonical() drops Blender .001 suffixes before reading the side | RED |

### P1
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Spellings.test_four_side_spellings_map_alike
----------------------------------------------------------------------
Ran 1 test in 0.001s
OK
```

### P2
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Chains.test_garment_chain_bones_map_to_nothing
======================================================================
FAIL: test_garment_chain_bones_map_to_nothing (scripts.avatar.bonemap_test.Chains.test_garment_chain_bones_map_to_nothing)
Breast, skirt and support chains hang off humanoid bones but are
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 149, in test_garment_chain_bones_map_to_nothing
    self.assertEqual(got, {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck'})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck', 'Breast_L.001': 'chest'} != {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck'}
- {'Breast_L.001': 'chest', 'Hips': 'hips', 'Neck': 'neck', 'Spine': 'spine'}
?  -------------------------
+ {'Hips': 'hips', 'Neck': 'neck', 'Spine': 'spine'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P3
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape
======================================================================
FAIL: test_anonymous_bones_are_placed_by_shape (scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape)
Bone.000 .. Bone.020 with VRoid geometry: nothing to alias, so the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 162, in test_anonymous_bones_are_placed_by_shape
    self.assertEqual(got, EXPECTED)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: {'Hips': None, 'Spine': None, 'Chest': None, 'Neck[319 chars]None} != {'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest[475 chars]oes'}
Diff is 1101 characters long. Set self.maxDiff to None to see it.
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P4
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_override_beats_the_generic_alias
======================================================================
FAIL: test_override_beats_the_generic_alias (scripts.avatar.bonemap_test.Overrides.test_override_beats_the_generic_alias)
A vendor whose 'Toe' bone is really the foot: the override must
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 216, in test_override_beats_the_generic_alias
    self.assertEqual(mapping['names'][index['Toe|L']], 'leftFoot')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftToes' != 'leftFoot'
- leftToes
+ leftFoot
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P5
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_a_missing_hips_is_named
======================================================================
FAIL: test_a_missing_hips_is_named (scripts.avatar.bonemap_test.Require.test_a_missing_hips_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 239, in test_a_missing_hips_is_named
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P6
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_a_weighted_joint_with_no_mapped_ancestor_is_named
======================================================================
FAIL: test_a_weighted_joint_with_no_mapped_ancestor_is_named (scripts.avatar.bonemap_test.Require.test_a_weighted_joint_with_no_mapped_ancestor_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 256, in test_a_weighted_joint_with_no_mapped_ancestor_is_named
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P7
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb
======================================================================
FAIL: test_topology_never_takes_a_chain_bone_for_a_limb (scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb)
Breast chains leave the chest sideways like arms do. Without the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 193, in test_topology_never_takes_a_chain_bone_for_a_limb
    self.assertNotIn(index[n], mapping['names'], n)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 14 unexpectedly found in {1: 'hips', 6: 'leftUpperLeg', 7: 'leftLowerLeg', 8: 'leftFoot', 9: 'leftToes', 10: 'rightUpperLeg', 11: 'rightLowerLeg', 12: 'rightFoot', 13: 'rightToes', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 14: 'leftUpperArm', 15: 'leftLowerArm', 16: 'leftHand', 17: 'rightUpperArm', 18: 'rightLowerArm', 19: 'rightHand'} : Breast.L
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P8
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.VendorFiles.test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on
cardigan's scale x1.153 -> x1.188
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 323, in test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on
    self.assertEqual(names_of(mapping, doc), self.TODAY_OUTER)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'Hip[90 chars]r', 'Upper_arm_L': 'leftUpperArm', 'Lower_arm_[300 chars]Leg'} != {'Hip[90 chars]r', 'Shoulder_R': 'rightShoulder', 'Upper_arm_[109 chars]Leg'}
  {'Chest': 'chest',
-  'Hand_L': 'leftHand',
-  'Hand_R': 'rightHand',
   'Hips': 'hips',
-  'Lower_arm_L': 'leftLowerArm',
-  'Lower_arm_R': 'rightLowerArm',
   'Neck': 'neck',
   'Shoulder_L': 'leftShoulder',
   'Shoulder_R': 'rightShoulder',
   'Spine': 'spine',
-  'Thumb Proximal_L': 'leftThumbProximal',
-  'Thumb Proximal_R': 'rightThumbProximal',
   'Upper_arm_L': 'leftUpperArm',
   'Upper_arm_R': 'rightUpperArm',
   'Upper_leg_L': 'leftUpperLeg',
   'Upper_leg_R': 'rightUpperLeg'}
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### P9
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.LoadWiring.test_load_uses_the_resolver
======================================================================
FAIL: test_load_uses_the_resolver (scripts.avatar.outfit_test.LoadWiring.test_load_uses_the_resolver)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 39, in test_load_uses_the_resolver
    self.assertNotIn('leftLowerArm', named)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftLowerArm' unexpectedly found in {'rightUpperLeg', 'rightHand', 'rightLowerArm', 'rightUpperArm', 'hips', 'rightShoulder', 'leftShoulder', 'leftHand', 'leftUpperLeg', 'spine', 'chest', 'leftLowerArm', 'leftUpperArm', 'neck'}
----------------------------------------------------------------------
Ran 1 test in 0.011s
FAILED (failures=1)
```

### P10
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.VendorFiles.test_the_resolver_can_name_the_cardigans_arm_and_thumb
======================================================================
FAIL: test_the_resolver_can_name_the_cardigans_arm_and_thumb (scripts.avatar.bonemap_test.VendorFiles.test_the_resolver_can_name_the_cardigans_arm_and_thumb)
Without the vendor file's ignore list the cardigan's forearm, hand
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 312, in test_the_resolver_can_name_the_cardigans_arm_and_thumb
    self.assertIn(name, got.values(), name)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftLowerArm' not found in dict_values(['hips', 'spine', 'chest', 'neck', 'leftShoulder', 'leftUpperArm', 'leftHand', 'leftThumbProximal', 'rightShoulder', 'rightUpperArm', 'rightHand', 'rightThumbProximal', 'leftUpperLeg', 'rightUpperLeg']) : leftLowerArm
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### P11
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_mirror_swaps_the_sides
======================================================================
FAIL: test_mirror_swaps_the_sides (scripts.avatar.bonemap_test.Overrides.test_mirror_swaps_the_sides)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 229, in test_mirror_swaps_the_sides
    self.assertEqual(mapping['names'][index['Hand|L']], 'rightHand')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftHand' != 'rightHand'
- leftHand
+ rightHand
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P12
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_drop_bones_before_anything_else
======================================================================
FAIL: test_ignore_patterns_drop_bones_before_anything_else (scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_drop_bones_before_anything_else)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 223, in test_ignore_patterns_drop_bones_before_anything_else
    self.assertNotIn(index['Toe|L'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 17 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 6: 'leftShoulder', 7: 'leftUpperArm', 8: 'leftLowerArm', 9: 'leftHand', 10: 'rightShoulder', 11: 'rightUpperArm', 12: 'rightLowerArm', 13: 'rightHand', 14: 'leftUpperLeg', 15: 'leftLowerLeg', 16: 'leftFoot', 17: 'leftToes', 18: 'rightUpperLeg', 19: 'rightLowerLeg', 20: 'rightFoot', 21: 'rightToes'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P13
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Spellings.test_numeric_suffix_before_the_side_is_still_a_side
======================================================================
FAIL: test_numeric_suffix_before_the_side_is_still_a_side (scripts.avatar.bonemap_test.Spellings.test_numeric_suffix_before_the_side_is_still_a_side)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 124, in test_numeric_suffix_before_the_side_is_still_a_side
    self.assertEqual((stem, side), ('breast', 'L'))
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Tuples differ: ('breastl001', None) != ('breast', 'L')
First differing element 0:
'breastl001'
'breast'
- ('breastl001', None)
+ ('breast', 'L')
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```


## P1 第二次

P1 RED  restored=True

| # | guard | result |
|---|---|---|
| P1 | canonical() reads the `_L` separator (the 2026-09-02 cardigan failure) | RED |

### P1
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Spellings.test_four_side_spellings_map_alike
======================================================================
FAIL: test_four_side_spellings_map_alike (scripts.avatar.bonemap_test.Spellings.test_four_side_spellings_map_alike)
The 2026-09-02 cardigan failure: the bodice spells Shoulder.L and
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 123, in test_four_side_spellings_map_alike
    self.assertEqual({mapping['how'][index[n]] for n in EXPECTED}, {'alias'}, f'spelling {style!r}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the first set but not the second:
'topology' : spelling '_L'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```


## P3／P7 重跑（node_world 重構後）

P3 RED  restored=True
P7 RED  restored=True

| # | guard | result |
|---|---|---|
| P3 | topology fills anonymous limbs from the rig shape | RED |
| P7 | topology never takes a breast chain for an arm | RED |

### P3
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape
======================================================================
FAIL: test_anonymous_bones_are_placed_by_shape (scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape)
Bone.000 .. Bone.020 with VRoid geometry: nothing to alias, so the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 165, in test_anonymous_bones_are_placed_by_shape
    self.assertEqual(got, EXPECTED)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: {'Hips': None, 'Spine': None, 'Chest': None, 'Neck[319 chars]None} != {'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest[475 chars]oes'}
Diff is 1101 characters long. Set self.maxDiff to None to see it.
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P7
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb
======================================================================
FAIL: test_topology_never_takes_a_chain_bone_for_a_limb (scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb)
Breast chains leave the chest sideways like arms do. Without the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 196, in test_topology_never_takes_a_chain_bone_for_a_limb
    self.assertNotIn(index[n], mapping['names'], n)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 14 unexpectedly found in {1: 'hips', 6: 'leftUpperLeg', 7: 'leftLowerLeg', 8: 'leftFoot', 9: 'leftToes', 10: 'rightUpperLeg', 11: 'rightLowerLeg', 12: 'rightFoot', 13: 'rightToes', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 14: 'leftUpperArm', 15: 'leftLowerArm', 16: 'leftHand', 17: 'rightUpperArm', 18: 'rightLowerArm', 19: 'rightHand'} : Breast.L
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```


## 第二輪 P1–P22 全部重跑（P12 ABORT）

P1 RED  restored=True
P2 RED  restored=True
P3 RED  restored=True
P4 RED  restored=True
P5 RED  restored=True
P6 RED  restored=True
P7 RED  restored=True
P8 RED  restored=True
P9 RED  restored=True
P10 RED  restored=True
P11 RED  restored=True
P12 ABORT hits=0
P13 RED  restored=True
P14 RED  restored=True
P15 RED  restored=True
P16 RED  restored=True
P17 RED  restored=True
P18 RED  restored=True
P19 RED  restored=True
P20 RED  restored=True
P21 RED  restored=True
P22 RED  restored=True

| # | guard | result |
|---|---|---|
| P1 | canonical() reads the `_L` separator (the 2026-09-02 cardigan failure) | RED |
| P2 | a garment chain stem (breast) must not be aliased onto a humanoid bone | RED |
| P3 | topology fills anonymous limbs from the rig shape | RED |
| P4 | the vendor override outranks the generic alias table | RED |
| P5 | require() names a missing hips instead of counting anchors | RED |
| P6 | require() refuses a weighted joint with no mapped ancestor | RED |
| P7 | topology never takes a breast chain for an arm | RED |
| P8 | the vendor file pins the cardigan to its ten tuned anchors | RED |
| P9 | wiring: outfit.load passes the vendor file to the resolver | RED |
| P10 | the generic table names the cardigan forearm (Lower_arm_L) | RED |
| P11 | mirror swaps L/R | RED |
| P12 | ignore patterns are applied | ABORT: pattern hit 0 times, not 1 |
| P13 | canonical() drops Blender .001 suffixes before reading the side | RED |
| P14 | ignore patterns treat . and _ as one separator | RED |
| P15 | require() refuses a mapping with no trunk anchor above the spine | RED |
| P16 | require() refuses fewer than MIN_ANCHORS pairs | RED |
| P17 | merge: a topology name already taken by the alias stage is dropped | RED |
| P18 | topology never renames a trunk node the alias stage named | RED |
| P19 | an unknown key in a vendor file is refused by name | RED |
| P20 | from_blender turns Blender Z-up into glTF Y-up before topology reads height | RED |
| P21 | a VRM 1.0 target gets the 0.x thumb names through the rename | RED |
| P22 | a missing vendor file is reported as BadMapping naming the path | RED |

### P1
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Spellings.test_four_side_spellings_map_alike
======================================================================
FAIL: test_four_side_spellings_map_alike (scripts.avatar.bonemap_test.Spellings.test_four_side_spellings_map_alike)
The 2026-09-02 cardigan failure: the bodice spells Shoulder.L and
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 123, in test_four_side_spellings_map_alike
    self.assertEqual({mapping['how'][index[n]] for n in EXPECTED}, {'alias'}, f'spelling {style!r}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the first set but not the second:
'topology' : spelling '_L'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P2
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Chains.test_garment_chain_bones_map_to_nothing
======================================================================
FAIL: test_garment_chain_bones_map_to_nothing (scripts.avatar.bonemap_test.Chains.test_garment_chain_bones_map_to_nothing)
Breast, skirt and support chains hang off humanoid bones but are
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 152, in test_garment_chain_bones_map_to_nothing
    self.assertEqual(got, {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck'})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck', 'Breast_L.001': 'chest'} != {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck'}
- {'Breast_L.001': 'chest', 'Hips': 'hips', 'Neck': 'neck', 'Spine': 'spine'}
?  -------------------------
+ {'Hips': 'hips', 'Neck': 'neck', 'Spine': 'spine'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P3
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape
======================================================================
FAIL: test_anonymous_bones_are_placed_by_shape (scripts.avatar.bonemap_test.Topology.test_anonymous_bones_are_placed_by_shape)
Bone.000 .. Bone.020 with VRoid geometry: nothing to alias, so the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 170, in test_anonymous_bones_are_placed_by_shape
    self.assertEqual(got, EXPECTED)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: {'Hips': None, 'Spine': None, 'Chest': None, 'Neck[319 chars]None} != {'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest[475 chars]oes'}
Diff is 1101 characters long. Set self.maxDiff to None to see it.
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P4
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_override_beats_the_generic_alias
======================================================================
FAIL: test_override_beats_the_generic_alias (scripts.avatar.bonemap_test.Overrides.test_override_beats_the_generic_alias)
A vendor whose 'Toe' bone is really the foot: the override must
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 247, in test_override_beats_the_generic_alias
    self.assertEqual(mapping['names'][index['Toe|L']], 'leftFoot')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftToes' != 'leftFoot'
- leftToes
+ leftFoot
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P5
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_a_missing_hips_is_named
======================================================================
FAIL: test_a_missing_hips_is_named (scripts.avatar.bonemap_test.Require.test_a_missing_hips_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 326, in test_a_missing_hips_is_named
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P6
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_a_weighted_joint_with_no_mapped_ancestor_is_named
======================================================================
FAIL: test_a_weighted_joint_with_no_mapped_ancestor_is_named (scripts.avatar.bonemap_test.Require.test_a_weighted_joint_with_no_mapped_ancestor_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 354, in test_a_weighted_joint_with_no_mapped_ancestor_is_named
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P7
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb
======================================================================
FAIL: test_topology_never_takes_a_chain_bone_for_a_limb (scripts.avatar.bonemap_test.Topology.test_topology_never_takes_a_chain_bone_for_a_limb)
Breast chains leave the chest sideways like arms do. Without the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 224, in test_topology_never_takes_a_chain_bone_for_a_limb
    self.assertNotIn(index[n], mapping['names'], n)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 14 unexpectedly found in {1: 'hips', 6: 'leftUpperLeg', 7: 'leftLowerLeg', 8: 'leftFoot', 9: 'leftToes', 10: 'rightUpperLeg', 11: 'rightLowerLeg', 12: 'rightFoot', 13: 'rightToes', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 14: 'leftUpperArm', 15: 'leftLowerArm', 16: 'leftHand', 17: 'rightUpperArm', 18: 'rightLowerArm', 19: 'rightHand'} : Breast.L
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P8
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.VendorFiles.test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on
cardigan's scale x1.153 -> x1.188
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 421, in test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on
    self.assertEqual(names_of(mapping, doc), self.TODAY_OUTER)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'Hip[90 chars]r', 'Upper_arm_L': 'leftUpperArm', 'Lower_arm_[300 chars]Leg'} != {'Hip[90 chars]r', 'Shoulder_R': 'rightShoulder', 'Upper_arm_[109 chars]Leg'}
  {'Chest': 'chest',
-  'Hand_L': 'leftHand',
-  'Hand_R': 'rightHand',
   'Hips': 'hips',
-  'Lower_arm_L': 'leftLowerArm',
-  'Lower_arm_R': 'rightLowerArm',
   'Neck': 'neck',
   'Shoulder_L': 'leftShoulder',
   'Shoulder_R': 'rightShoulder',
   'Spine': 'spine',
-  'Thumb Proximal_L': 'leftThumbProximal',
-  'Thumb Proximal_R': 'rightThumbProximal',
   'Upper_arm_L': 'leftUpperArm',
   'Upper_arm_R': 'rightUpperArm',
   'Upper_leg_L': 'leftUpperLeg',
   'Upper_leg_R': 'rightUpperLeg'}
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### P9
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.LoadWiring.test_load_uses_the_resolver
======================================================================
FAIL: test_load_uses_the_resolver (scripts.avatar.outfit_test.LoadWiring.test_load_uses_the_resolver)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 39, in test_load_uses_the_resolver
    self.assertNotIn('leftLowerArm', named)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftLowerArm' unexpectedly found in {'leftShoulder', 'hips', 'spine', 'leftHand', 'leftUpperLeg', 'neck', 'rightShoulder', 'chest', 'rightHand', 'leftUpperArm', 'rightLowerArm', 'rightUpperLeg', 'leftLowerArm', 'rightUpperArm'}
----------------------------------------------------------------------
Ran 1 test in 0.011s
FAILED (failures=1)
```

### P10
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.VendorFiles.test_the_resolver_can_name_the_cardigans_arm_and_thumb
======================================================================
FAIL: test_the_resolver_can_name_the_cardigans_arm_and_thumb (scripts.avatar.bonemap_test.VendorFiles.test_the_resolver_can_name_the_cardigans_arm_and_thumb)
Without the vendor file's ignore list the cardigan's forearm, hand
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 410, in test_the_resolver_can_name_the_cardigans_arm_and_thumb
    self.assertIn(name, got.values(), name)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftLowerArm' not found in dict_values(['hips', 'spine', 'chest', 'neck', 'leftShoulder', 'leftUpperArm', 'leftHand', 'leftThumbProximal', 'rightShoulder', 'rightUpperArm', 'rightHand', 'rightThumbProximal', 'leftUpperLeg', 'rightUpperLeg']) : leftLowerArm
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### P11
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_mirror_swaps_the_sides
======================================================================
FAIL: test_mirror_swaps_the_sides (scripts.avatar.bonemap_test.Overrides.test_mirror_swaps_the_sides)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 260, in test_mirror_swaps_the_sides
    self.assertEqual(mapping['names'][index['Hand|L']], 'rightHand')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'leftHand' != 'rightHand'
- leftHand
+ rightHand
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P13
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Spellings.test_numeric_suffix_before_the_side_is_still_a_side
======================================================================
FAIL: test_numeric_suffix_before_the_side_is_still_a_side (scripts.avatar.bonemap_test.Spellings.test_numeric_suffix_before_the_side_is_still_a_side)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 127, in test_numeric_suffix_before_the_side_is_still_a_side
    self.assertEqual((stem, side), ('breast', 'L'))
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Tuples differ: ('breastl001', None) != ('breast', 'L')
First differing element 0:
'breastl001'
'breast'
- ('breastl001', None)
+ ('breast', 'L')
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### P14
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_read_dot_and_underscore_as_one_separator
======================================================================
FAIL: test_ignore_patterns_read_dot_and_underscore_as_one_separator (scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_read_dot_and_underscore_as_one_separator)
One vendor's two files spell the same bone Toe.L and Toe_L; a
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 267, in test_ignore_patterns_read_dot_and_underscore_as_one_separator
    self.assertNotIn(index['Toe|L'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 17 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 6: 'leftShoulder', 7: 'leftUpperArm', 8: 'leftLowerArm', 9: 'leftHand', 10: 'rightShoulder', 11: 'rightUpperArm', 12: 'rightLowerArm', 13: 'rightHand', 14: 'leftUpperLeg', 15: 'leftLowerLeg', 16: 'leftFoot', 17: 'leftToes', 18: 'rightUpperLeg', 19: 'rightLowerLeg', 20: 'rightFoot', 21: 'rightToes'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P15
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_a_rig_with_no_trunk_anchor_is_named
======================================================================
FAIL: test_a_rig_with_no_trunk_anchor_is_named (scripts.avatar.bonemap_test.Require.test_a_rig_with_no_trunk_anchor_is_named)
Hips and legs only: enough anchors to count, nothing above the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 337, in test_a_rig_with_no_trunk_anchor_is_named
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### P16
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Require.test_too_few_anchors_is_named_with_the_count
======================================================================
FAIL: test_too_few_anchors_is_named_with_the_count (scripts.avatar.bonemap_test.Require.test_too_few_anchors_is_named_with_the_count)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 345, in test_too_few_anchors_is_named_with_the_count
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### P17
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named
=================================================================
FAIL: test_topology_neither_renames_nor_duplicates_what_the_alias_named (scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named)
A trunk whose third bone is anonymous and whose second is named
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 204, in test_topology_neither_renames_nor_duplicates_what_the_alias_named
    self.assertNotIn(index['Bone.003'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 4 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'upperChest', 5: 'neck', 6: 'head', 7: 'leftShoulder', 8: 'leftUpperArm', 9: 'leftLowerArm', 10: 'leftHand', 11: 'rightShoulder', 12: 'rightUpperArm', 13: 'rightLowerArm', 14: 'rightHand', 15: 'leftUpperLeg', 16: 'leftLowerLeg', 17: 'leftFoot', 18: 'leftToes', 19: 'rightUpperLeg', 20: 'rightLowerLeg', 21: 'rightFoot', 22: 'rightToes', 4: 'neck'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P18
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named
======================================================================
FAIL: test_topology_neither_renames_nor_duplicates_what_the_alias_named (scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named)
A trunk whose third bone is anonymous and whose second is named
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 202, in test_topology_neither_renames_nor_duplicates_what_the_alias_named
    self.assertEqual(mapping['names'][index['UpperChest']], 'upperChest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'chest' != 'upperChest'
- chest
+ upperChest
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P19
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_an_unknown_override_key_is_refused_by_name
======================================================================
FAIL: test_an_unknown_override_key_is_refused_by_name (scripts.avatar.bonemap_test.Overrides.test_an_unknown_override_key_is_refused_by_name)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 272, in test_an_unknown_override_key_is_refused_by_name
    with self.assertRaises(bonemap.BadMapping) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
AssertionError: BadMapping not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P20
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.BlenderAxes.test_a_z_up_armature_maps_its_limbs_after_from_blender
======================================================================
FAIL: test_a_z_up_armature_maps_its_limbs_after_from_blender (scripts.avatar.bonemap_test.BlenderAxes.test_a_z_up_armature_maps_its_limbs_after_from_blender)
inspect_fbx.py --map builds the rig from Blender's Z-up world
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 315, in test_a_z_up_armature_maps_its_limbs_after_from_blender
    self.assertEqual(got, EXPECTED)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: {'Hip[16 chars]ne': None, 'Chest': None, 'Neck': None, 'Head'[304 chars]None} != {'Hip[16 chars]ne': 'spine', 'Chest': 'chest', 'Neck': 'neck'[458 chars]oes'}
Diff is 1084 characters long. Set self.maxDiff to None to see it.
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P21
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_a_vrm1_target_gets_the_thumb_under_its_own_names
======================================================================
FAIL: test_a_vrm1_target_gets_the_thumb_under_its_own_names (scripts.avatar.bonemap_test.Overrides.test_a_vrm1_target_gets_the_thumb_under_its_own_names)
0.x calls the thumb Proximal/Intermediate/Distal, 1.0 calls the same
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 294, in test_a_vrm1_target_gets_the_thumb_under_its_own_names
    self.assertEqual(pairs[index['Thumb Proximal|L']], 100)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 22 != 100
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P22
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_a_missing_override_file_is_named
======================================================================
ERROR: test_a_missing_override_file_is_named (scripts.avatar.bonemap_test.Overrides.test_a_missing_override_file_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 278, in test_a_missing_override_file_is_named
    bonemap.load_override(os.path.join(HERE, 'bonemap', 'no-such-vendor.json'))
    ~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/bonemap.py", line 173, in load_override
    with open(path, encoding='utf-8') as fh:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: '/Users/charles/portfolio/scripts/avatar/bonemap/no-such-vendor.json'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (errors=1)
```


## P12 第二次（pattern 對上改寫後的 ignored()）

P12 RED  restored=True

| # | guard | result |
|---|---|---|
| P12 | ignore patterns are applied | RED |

### P12
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_drop_bones_before_anything_else
======================================================================
FAIL: test_ignore_patterns_drop_bones_before_anything_else (scripts.avatar.bonemap_test.Overrides.test_ignore_patterns_drop_bones_before_anything_else)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 254, in test_ignore_patterns_drop_bones_before_anything_else
    self.assertNotIn(index['Toe|L'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 17 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 6: 'leftShoulder', 7: 'leftUpperArm', 8: 'leftLowerArm', 9: 'leftHand', 10: 'rightShoulder', 11: 'rightUpperArm', 12: 'rightLowerArm', 13: 'rightHand', 14: 'leftUpperLeg', 15: 'leftLowerLeg', 16: 'leftFoot', 17: 'leftToes', 18: 'rightUpperLeg', 19: 'rightLowerLeg', 20: 'rightFoot', 21: 'rightToes'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```


## 第三輪 P23（＋P17／P18 重跑）

P17 RED  restored=True
P18 RED  restored=True
P23 RED  restored=True

| # | guard | result |
|---|---|---|
| P17 | merge: a topology name already taken by the alias stage is dropped | RED |
| P18 | topology never renames a trunk node the alias stage named | RED |
| P23 | topology never renames an alias-named neck (per-node guard in the neck/head loop) | RED |

### P17
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named
=================================================================
FAIL: test_topology_neither_renames_nor_duplicates_what_the_alias_named (scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named)
A trunk whose third bone is anonymous and whose second is named
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 204, in test_topology_neither_renames_nor_duplicates_what_the_alias_named
    self.assertNotIn(index['Bone.003'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 4 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'upperChest', 5: 'neck', 6: 'head', 7: 'leftShoulder', 8: 'leftUpperArm', 9: 'leftLowerArm', 10: 'leftHand', 11: 'rightShoulder', 12: 'rightUpperArm', 13: 'rightLowerArm', 14: 'rightHand', 15: 'leftUpperLeg', 16: 'leftLowerLeg', 17: 'leftFoot', 18: 'leftToes', 19: 'rightUpperLeg', 20: 'rightLowerLeg', 21: 'rightFoot', 22: 'rightToes', 4: 'neck'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P18
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named
======================================================================
FAIL: test_topology_neither_renames_nor_duplicates_what_the_alias_named (scripts.avatar.bonemap_test.Topology.test_topology_neither_renames_nor_duplicates_what_the_alias_named)
A trunk whose third bone is anonymous and whose second is named
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 202, in test_topology_neither_renames_nor_duplicates_what_the_alias_named
    self.assertEqual(mapping['names'][index['UpperChest']], 'upperChest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'chest' != 'upperChest'
- chest
+ upperChest
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### P23
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Topology.test_topology_does_not_rename_the_neck_when_the_rig_has_no_head
======================================================================
FAIL: test_topology_does_not_rename_the_neck_when_the_rig_has_no_head (scripts.avatar.bonemap_test.Topology.test_topology_does_not_rename_the_neck_when_the_rig_has_no_head)
The cardigan set has no Head bone. Put one anonymous bone between
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 223, in test_topology_does_not_rename_the_neck_when_the_rig_has_no_head
    self.assertEqual(mapping['names'][index['Neck']], 'neck')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'head' != 'neck'
- head
+ neck
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```


## 第三輪 P24（alias 階段同名相撞）

P24 RED  restored=True

| # | guard | result |
|---|---|---|
| P24 | alias stage: a humanoid name already taken is not handed to a second bone | RED |

### P24
```
$ python3 -W ignore -m unittest -q scripts.avatar.bonemap_test.Chains.test_two_bones_on_one_name_keep_the_first_and_report_the_rest
===========================================
FAIL: test_two_bones_on_one_name_keep_the_first_and_report_the_rest (scripts.avatar.bonemap_test.Chains.test_two_bones_on_one_name_keep_the_first_and_report_the_rest)
A vendor alias for a `.00N` family (Support_bone.001.L, .002.L)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/bonemap_test.py", line 173, in test_two_bones_on_one_name_keep_the_first_and_report_the_rest
    self.assertNotIn(index['Support_bone.001.L'], mapping['names'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 22 unexpectedly found in {1: 'hips', 2: 'spine', 3: 'chest', 4: 'neck', 5: 'head', 6: 'leftShoulder', 7: 'leftUpperArm', 8: 'leftLowerArm', 9: 'leftHand', 10: 'rightShoulder', 11: 'rightUpperArm', 12: 'rightLowerArm', 13: 'rightHand', 14: 'leftUpperLeg', 15: 'leftLowerLeg', 16: 'leftFoot', 17: 'leftToes', 18: 'rightUpperLeg', 19: 'rightLowerLeg', 20: 'rightFoot', 21: 'rightToes', 22: 'leftHand', 23: 'leftHand'}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

