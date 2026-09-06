B1 RED  restored=True
B2 RED  restored=True
B3 RED  restored=True
B4 RED  restored=True
B5 RED  restored=True
B6 RED  restored=True
B7 RED  restored=True
B8 RED  restored=True
B9 RED  restored=True
B10 RED  restored=True
B11 RED  restored=True
B12 RED  restored=True
B13 RED  restored=True
B14 RED  restored=True
B15 RED  restored=True
C1 RED  restored=True
C2 RED  restored=True
P1 RED  restored=True
W1 RED  restored=True
W2 RED  restored=True
W3 RED  restored=True
W4 RED  restored=True
S1 RED  restored=True
T1 RED  restored=True

| # | guard | result |
|---|---|---|
| B1 | drape: the band has to be one annulus, not two blobs that between them reach every bearing | RED |
| B2 | drape: the band has to reach every bearing round the hips axis | RED |
| B3 | drape: only bands below the crotch line count | RED |
| B4 | single: every nearest row has to be WHOLLY on the joint, a shared dominant joint is not enough | RED |
| B5 | single: every nearest row has to be on the SAME joint | RED |
| B6 | inherit: a shell keeps its rows regardless of what the geometry says | RED |
| B7 | nearest: exact ties are re-ranked, not left to the tree | RED |
| B8 | nearest: a tie goes to the lowest index, as the dense argmin resolved it | RED |
| B9 | single: the slot is translated into the target mesh's skin | RED |
| B10 | nearest: copied rows are translated into the target mesh's skin | RED |
| B11 | drape: the hem hands 75% of itself to the legs (the fade build.py had) | RED |
| B12 | signals: measured on ALL of a part's primitives, not the first | RED |
| B13 | nearest: the smoothing passes are recorded in the decision | RED |
| B14 | override: keeps the chooser's own verdict beside the caller's | RED |
| B15 | inherit: apply leaves the rows alone | RED |
| C1 | customise.remap keeps the binding field through a deletion | RED |
| C2 | selftest: the written manifest is audited for the field (same mutation, end to end) | RED |
| P1 | partition stamps every part it names as the export's own skinning | RED |
| W1 | build.put records the decision for the manifest | RED |
| W2 | build's manifest tail writes put()'s decisions | RED |
| W3 | build.put skins through binding.apply, not garment.bind | RED |
| W4 | weld.attach skins through binding.apply | RED |
| S1 | selftest audits the field on the manifest apply wrote | RED |
| T1 | twintail.apply overwrites the export stamp on the parts it re-weights | RED |

### B1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_a_ring_round_each_leg_separately_does_not_drape
======================================================================
FAIL: test_a_ring_round_each_leg_separately_does_not_drape (scripts.avatar.binding_test.Choose.test_a_ring_round_each_leg_separately_does_not_drape)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 145, in test_a_ring_round_each_leg_separately_does_not_drape
    self.assertEqual(d['strategy'], 'nearest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'drape' != 'nearest'
- drape
+ nearest
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### B2
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_a_panel_round_the_back_only_does_not_drape
======================================================================
FAIL: test_a_panel_round_the_back_only_does_not_drape (scripts.avatar.binding_test.Choose.test_a_panel_round_the_back_only_does_not_drape)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 154, in test_a_panel_round_the_back_only_does_not_drape
    self.assertEqual(d['strategy'], 'nearest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'drape' != 'nearest'
- drape
+ nearest
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### B3
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_a_ring_round_both_legs_above_the_crotch_does_not_drape
======================================================================
FAIL: test_a_ring_round_both_legs_above_the_crotch_does_not_drape (scripts.avatar.binding_test.Choose.test_a_ring_round_both_legs_above_the_crotch_does_not_drape)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 149, in test_a_ring_round_both_legs_above_the_crotch_does_not_drape
    self.assertEqual(d['strategy'], 'nearest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'drape' != 'nearest'
- drape
+ nearest
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### B4
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_a_small_sphere_beside_a_blended_thigh_copies_the_skin
======================================================================
FAIL: test_a_small_sphere_beside_a_blended_thigh_copies_the_skin (scripts.avatar.binding_test.Choose.test_a_small_sphere_beside_a_blended_thigh_copies_the_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 166, in test_a_small_sphere_beside_a_blended_thigh_copies_the_skin
    self.assertEqual(d['strategy'], 'nearest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'single' != 'nearest'
- single
+ nearest
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### B5
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_two_rigid_blobs_on_different_bones_copy_the_skin
======================================================================
FAIL: test_two_rigid_blobs_on_different_bones_copy_the_skin (scripts.avatar.binding_test.Choose.test_two_rigid_blobs_on_different_bones_copy_the_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 173, in test_two_rigid_blobs_on_different_bones_copy_the_skin
    self.assertEqual(d['strategy'], 'nearest')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'single' != 'nearest'
- single
+ nearest
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### B6
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_a_shell_inherits_whatever_the_geometry_says
======================================================================
FAIL: test_a_shell_inherits_whatever_the_geometry_says (scripts.avatar.binding_test.Choose.test_a_shell_inherits_whatever_the_geometry_says)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 182, in test_a_shell_inherits_whatever_the_geometry_says
    self.assertEqual(d['strategy'], 'inherit')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'drape' != 'inherit'
- drape
+ inherit
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### B7
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Nearest.test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions
======================================================================
FAIL: test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions (scripts.avatar.binding_test.Nearest.test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 217, in test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions
    np.testing.assert_array_equal(binding.nearest(binding.tree_of(pool), pool, q), dense)
    ~~~~~~~~
[…]
^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
Mismatched elements: 248 / 800 (31%)
First 5 mismatches are at indices:
 [1]: 4016 (ACTUAL), 612 (DESIRED)
 [2]: 4000 (ACTUAL), 1020 (DESIRED)
 [4]: 4329 (ACTUAL), 2821 (DESIRED)
 [5]: 3303 (ACTUAL), 1448 (DESIRED)
 [6]: 3235 (ACTUAL), 2390 (DESIRED)
Max absolute difference among violations: 4245
Max relative difference among violations: 1575.5
 ACTUAL: array([1542, 4016, 4000, 1100, 4329, 3303, 3235, 1484,  971,  957, 3160,
       1288, 3592, 3025, 2856, 1774,  764, 3348, 3116, 1375, 1799, 1588,
       1457,  112, 3091, 3333,  117, 1927, 2847,  223, 2836,   92, 3860,...
 DESIRED: array([1542,  612, 1020, 1100, 2821, 1448, 2390, 1484,  971,  957,  378,
       1288, 2724,  791, 2856, 1774,  764, 2029, 2526, 1375, 1799, 1588,
       1457,  112,  963, 1338,  117, 1927, 2847,  223, 2836,   92, 2437,...
----------------------------------------------------------------------
Ran 1 test in 0.071s
FAILED (failures=1)
```

### B8
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Nearest.test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions
======================================================================
FAIL: test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions (scripts.avatar.binding_test.Nearest.test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 217, in test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions
    np.testing.assert_array_equal(binding.nearest(binding.tree_of(pool), pool, q), dense)
    ~~~~~~~~
[…]
^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
Mismatched elements: 538 / 800 (67.2%)
First 5 mismatches are at indices:
 [1]: 4016 (ACTUAL), 612 (DESIRED)
 [2]: 4000 (ACTUAL), 1020 (DESIRED)
 [4]: 4329 (ACTUAL), 2821 (DESIRED)
 [5]: 3303 (ACTUAL), 1448 (DESIRED)
 [6]: 3235 (ACTUAL), 2390 (DESIRED)
Max absolute difference among violations: 4245
Max relative difference among violations: 1575.5
 ACTUAL: array([1542, 4016, 4000, 1100, 4329, 3303, 3235, 3733,  971,  957, 3160,
       4384, 3592, 3025, 3454, 4392, 3223, 3348, 3116, 4227, 3922, 4377,
       3275,  112, 3091, 3333,  117, 4275, 2847, 3448, 3688,   92, 3860,...
 DESIRED: array([1542,  612, 1020, 1100, 2821, 1448, 2390, 1484,  971,  957,  378,
       1288, 2724,  791, 2856, 1774,  764, 2029, 2526, 1375, 1799, 1588,
       1457,  112,  963, 1338,  117, 1927, 2847,  223, 2836,   92, 2437,...
----------------------------------------------------------------------
Ran 1 test in 0.051s
FAILED (failures=1)
```

### B9
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Apply.test_single_tiles_the_joint_in_the_target_skin
======================================================================
FAIL: test_single_tiles_the_joint_in_the_target_skin (scripts.avatar.binding_test.Apply.test_single_tiles_the_joint_in_the_target_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 242, in test_single_tiles_the_joint_in_the_target_skin
    self.assertEqual(set(on_hair['joints'][:, 0].tolist()), {10 - HEAD})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the first set but not the second:
4
Items in the second set but not the first:
6
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### B10
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Apply.test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin
======================================================================
FAIL: test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin (scripts.avatar.binding_test.Apply.test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 231, in test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin
    np.testing.assert_array_equal(on_hair['joints'][live], 10 - on_body['joints'][live])

[…]
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
Mismatched elements: 192 / 192 (100%)
First 5 mismatches are at indices:
 [0]: 3 (ACTUAL), 7 (DESIRED)
 [1]: 4 (ACTUAL), 6 (DESIRED)
 [2]: 3 (ACTUAL), 7 (DESIRED)
 [3]: 4 (ACTUAL), 6 (DESIRED)
 [4]: 3 (ACTUAL), 7 (DESIRED)
Max absolute difference among violations: 4
Max relative difference among violations: 0.57142857
 ACTUAL: array([3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4,
       3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4,
       3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4,...
 DESIRED: array([7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6,
       7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6,
       7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 6,...
----------------------------------------------------------------------
Ran 1 test in 0.005s
FAILED (failures=1)
```

### B11
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Apply.test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin
======================================================================
FAIL: test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin (scripts.avatar.binding_test.Apply.test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 262, in test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin
    self.assertGreaterEqual(weight_on(right, R_UP), 0.75)
    ~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.6875 not greater than or equal to 0.75
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### B12
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_the_decision_is_taken_on_the_union_of_a_part_s_primitives
======================================================================
FAIL: test_the_decision_is_taken_on_the_union_of_a_part_s_primitives (scripts.avatar.binding_test.Choose.test_the_decision_is_taken_on_the_union_of_a_part_s_primitives)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 197, in test_the_decision_is_taken_on_the_union_of_a_part_s_primitives
    self.assertEqual(binding.decide(ctx, [upper, lower], origin='vendor')['strategy'], 'drape')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'nearest' != 'drape'
- nearest
+ drape
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### B13
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_smoothing_is_recorded_on_a_nearest_decision_only
======================================================================
ERROR: test_smoothing_is_recorded_on_a_nearest_decision_only (scripts.avatar.binding_test.Choose.test_smoothing_is_recorded_on_a_nearest_decision_only)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 187, in test_smoothing_is_recorded_on_a_nearest_decision_only
    self.assertEqual(d['smooth'], 16)
                     ~^^^^^^^^^^
KeyError: 'smooth'
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (errors=1)
```

### B14
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Choose.test_an_override_keeps_what_the_chooser_would_have_said
======================================================================
FAIL: test_an_override_keeps_what_the_chooser_would_have_said (scripts.avatar.binding_test.Choose.test_an_override_keeps_what_the_chooser_would_have_said)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 202, in test_an_override_keeps_what_the_chooser_would_have_said
    self.assertEqual(d['chosen'], 'drape')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'nearest' != 'drape'
- nearest
+ drape
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### B15
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Apply.test_inherit_leaves_the_rows_the_piece_came_with
======================================================================
ERROR: test_inherit_leaves_the_rows_the_piece_came_with (scripts.avatar.binding_test.Apply.test_inherit_leaves_the_rows_the_piece_came_with)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 275, in test_inherit_leaves_the_rows_the_piece_came_with
    out = binding.apply(ctx, dict(piece), d, mesh='Body')
  File "/Users/charles/portfolio/scripts/avatar/binding.py", line 280, in apply
    raise ValueError(f'unknown binding strategy {strategy!r}')
ValueError: unknown binding strategy 'inherit'
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (errors=1)
```

### C1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Manifest.test_customise_remap_keeps_the_binding_field
======================================================================
ERROR: test_customise_remap_keeps_the_binding_field (scripts.avatar.binding_test.Manifest.test_customise_remap_keeps_the_binding_field)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 290, in test_customise_remap_keeps_the_binding_field
    self.assertEqual(manifest['parts']['Acc_A']['binding']['strategy'], 'single')
                     ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^
KeyError: 'binding'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (errors=1)
```

### C2
```
$ python3 -W ignore -m unittest -q scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test
======================================================================
FAIL: test_the_perturbed_model_passes_its_own_customisation_self_test (scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/selftest_test.py", line 63, in test_the_perturbed_model_passes_its_own_customisation_self_test
    self.assertTrue(ok, out.getvalue())
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
Assert
[…]
eletable parts available: 24
  dropping: Hair_Bangs, Acc_HairClip_Bear, Hair_Bun_R
  retinting Mellow_Inner -> [0.821, 0.094, 0.583]
  retinting Mellow_Inner_Sub -> [0.91, 0.215, 0.086]
  removed 14 primitives, swept 87 accessors / 87 bufferViews
  materials left painting nothing: F00_000_Hair_00_HAIR_01, Milfy_Bear
  triangles 102984 -> 101436 (expected 101436)
  [ok] still a VRM0
  [ok] triangles match the manifest
  [ok] no orphan accessors
  [ok] skeleton unmoved
  [ok] 53 humanoid bones
  [ok] 57 face morph targets intact
  [ok] 14 blendShapeGroups intact
  [ok] tints landed
  [ok] retinted materials are still on the model
  [ok] every palette entry names live parts
  [ok] every shape key names live parts
  [ok] 6 shape keys in the manifest still displace
  [ok] 6 shape keys in the file are all in the manifest
  [ok] every mesh keeps one morph target count
  [ok] no material is left painting nothing
  [ok] every palette entry names a material still in the file
  [FAIL] every part still says how it is bound
  [ok] materialProperties still line up with materials
  FAIL
----------------------------------------------------------------------
Ran 1 test in 0.167s
FAILED (failures=1)
```

### P1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Manifest.test_partition_labels_every_part_as_skinned_by_the_export
======================================================================
FAIL: test_partition_labels_every_part_as_skinned_by_the_export (scripts.avatar.binding_test.Manifest.test_partition_labels_every_part_as_skinned_by_the_export)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 296, in test_partition_labels_every_part_as_skinned_by_the_export
    self.assertEqual(len(re.findall(r"'binding': dict\(binding\.EXPORTED\)", src)), 2)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1 != 2
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### W1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding
======================================================================
FAIL: test_build_routes_every_piece_through_put_and_binding (scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 312, in test_build_routes_every_piece_through_put_and_binding
    self.assertRegex(src, r"\n\s+bindings\[name\] = decision")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionErro
[…]
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### W2
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding
======================================================================
FAIL: test_build_routes_every_piece_through_put_and_binding (scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 313, in test_build_routes_every_piece_through_put_and_binding
    self.assertRegex(src, r"\n\s+e\['binding'\] = bindings\.get\(label\)")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[…]
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### W3
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding
======================================================================
FAIL: test_build_routes_every_piece_through_put_and_binding (scripts.avatar.binding_test.Wiring.test_build_routes_every_piece_through_put_and_binding)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 307, in test_build_routes_every_piece_through_put_and_binding
    self.assertNotIn('garment.bind(', src)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'garment.bind(' unexpectedly found in
[…]
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### W4
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_weld_attach_takes_the_same_path
======================================================================
FAIL: test_weld_attach_takes_the_same_path (scripts.avatar.binding_test.Wiring.test_weld_attach_takes_the_same_path)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 318, in test_weld_attach_takes_the_same_path
    self.assertNotIn('garment.bind(', src)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'garment.bind(' unexpectedly found in '"""Attach geometry made in Blender to the VRM, wi
[…]
                            weights=np.zeros((len(p[\'pos\']), 4), dtype=np.float32))\n                            for p in found.values()])\n    return merged\n\n\ndef attach(doc, views, ctx, piece, material, part_name, mesh=\'Body.baked\'):\n    """Skin a Blender piece by binding\'s rules and write it in as `part_name`.\n\n    `ctx` is binding.context(...) for the body the piece goes on. Returns the\n    decision, which is what the manifest wants to record.\n    """\n    piece = dict(piece)\n    decision = binding.decide(ctx, [piece], \'blender\')\n    garment.bind(ctx[\'pool\'], piece)\n    garment.attach(doc, views, mesh, piece, material, part_name)\n    return decision\n\n\nif __name__ == \'__main__\':\n    src = sys.argv[1]\n    for name, piece in pieces(src).items():\n        p = piece[\'pos\']\n        print(f\'{name:<22} {len(p):>6} 點 {len(piece["tris"]):>6} 面  \'\n              f\'x {p[:, 0].min():+.3f}..{p[:, 0].max():+.3f}  \'\n              f\'y {p[:, 1].min():+.3f}..{p[:, 1].max():+.3f}  \'\n              f\'z {p[:, 2].min():+.3f}..{p[:, 2].max():+.3f}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### S1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_selftest_audits_the_field_on_the_written_manifest
======================================================================
FAIL: test_selftest_audits_the_field_on_the_written_manifest (scripts.avatar.binding_test.Wiring.test_selftest_audits_the_field_on_the_written_manifest)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 324, in test_selftest_audits_the_field_on_the_written_manifest
    self.assertRegex(src, r"'binding' in e and e\['binding'\]\.get\('strategy'\)")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
[…]
 count stays\n    # plausible -- the check above cannot see it, because it only counts.\n    props = doc[\'extensions\'][\'VRM\'][\'materialProperties\']\n    checks.append((\'materialProperties still line up with materials\',\n                   [m.get(\'name\') for m in doc[\'materials\']]\n                   == [m.get(\'name\') for m in props]))\n\n    print(f\'  triangles {tri_before} -> {tri_after} (expected {expected})\')\n    for label, ok in checks:\n        print(f\'  [{"ok" if ok else "FAIL"}] {label}\')\n    passed = all(ok for _, ok in checks)\n    print(f\'  {"PASS" if passed else "FAIL"}\')\n    return passed\n\n\nif __name__ == \'__main__\':\n    model = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, \'out\', \'mika-milfy.vrm\')\n    mani = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, \'out\', \'mika-milfy.parts.json\')\n    rounds = int(sys.argv[3]) if len(sys.argv) > 3 else 3\n    every = all(run(model, mani) for _ in range(rounds))\n    print(f\'\\n{rounds} rounds: {"PASS" if every else "FAIL"}\')\n    sys.exit(0 if every else 1)\n'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### T1
```
$ python3 -W ignore -m unittest -q scripts.avatar.binding_test.Wiring.test_twintail_owns_the_field_for_the_parts_it_reweights
======================================================================
FAIL: test_twintail_owns_the_field_for_the_parts_it_reweights (scripts.avatar.binding_test.Wiring.test_twintail_owns_the_field_for_the_parts_it_reweights)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/binding_test.py", line 329, in test_twintail_owns_the_field_for_the_parts_it_reweights
    self.assertRegex(src, r"\n    for part in parts:\n        manifest\[part\]\['binding'\] = dict\(CHAIN\)\n    return report\n")
  
[…]
lider\n    groups BY INDEX, so the survivors\' references must be rewritten in the\n    same pass that compacts the list -- dropping without remapping would point\n    the skirt at whatever slid into positions 10 and 11.\n    """\n    secondary = doc[\'extensions\'][\'VRM\'][\'secondaryAnimation\']\n    groups = secondary.get(\'colliderGroups\', [])\n    used = sorted({index\n                   for group in secondary.get(\'boneGroups\', [])\n                   for index in group.get(\'colliderGroups\', [])})\n    if len(used) == len(groups):\n        return []\n    remap = {old_index: new_index for new_index, old_index in enumerate(used)}\n    removed = [(index, doc[\'nodes\'][groups[index].get(\'node\')].get(\'name\', \'\'))\n               for index in range(len(groups)) if index not in remap]\n    secondary[\'colliderGroups\'] = [groups[index] for index in used]\n    for group in secondary.get(\'boneGroups\', []):\n        group[\'colliderGroups\'] = [remap[index]\n                                   for index in group.get(\'colliderGroups\', [])]\n    return removed\n'
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

