# Phase 3 mutation receipts: scripts/avatar gates, skins[0], --base, landmarks (2026-09-05, rerun 2026-09-06 after review round 1)

Harness: evidence/gates-0905-mutate.py (same as Phase 2's: byte-copy backup, pattern hit count must be 1, one named test per mutation, __pycache__ removed after the write, byte-copy restore checked by sha256). G18–G22 were added after code review round 1 (all_joints test, --base wiring, mesh_skin conflict, shoulder/neck landmarks). Full harness output follows.

G1 RED  restored=True
G2 RED  restored=True
G3 RED  restored=True
G4 RED  restored=True
G5 RED  restored=True
G6 RED  restored=True
G7 RED  restored=True
G8 RED  restored=True
G9 RED  restored=True
G10 RED  restored=True
G11 RED  restored=True
G12 RED  restored=True
G13 RED  restored=True
G14 RED  restored=True
G15 RED  restored=True
G16 RED  restored=True
G18 RED  restored=True
G19 RED  restored=True
G20 RED  restored=True
G21 RED  restored=True
G22 RED  restored=True
G17 RED  restored=True

| # | guard | result |
|---|---|---|
| G1 | make.gate: the VRoid bone count is not demanded (a 53-bone body passes against its own kind) | RED |
| G2 | make.gate: a bone the VRM spec requires is demanded even when the base lacks it too | RED |
| G3 | make.gate: a bone on one side only fails through compare() | RED |
| G4 | verify.report: a missing required bone fails the health check and is named | RED |
| G5 | verify.report: no bone count (a body without upperChest passes) | RED |
| G6 | verify.dangling_joints: a primitive is checked against ITS node's skin | RED |
| G7 | selftest: the bone count is read off the input model | RED |
| G8 | selftest: the blendShapeGroup count is read off the input model | RED |
| G9 | selftest: the face morph target count is read off the input model | RED |
| G10 | selftest: the skeleton is compared against the input model, not baseline.vrm | RED |
| G11 | pose.skinned: a mesh is posed with ITS node's skin | RED |
| G12 | pose.skinned_normals: normals are turned with ITS node's skin | RED |
| G13 | humanoid.mesh_skin: the skin index is the one the node names | RED |
| G14 | wiring: a module reading skins[0] for a mesh is caught by the source scan | RED |
| G15 | outfit.add_bones: every skin sharing the joint list is grown alongside | RED |
| G16 | build.landmarks: the hip height comes from the skeleton | RED |
| G18 | humanoid.all_joints: the union of every skin, not the first skin alone | RED |
| G19 | make.main: every step takes the --base body, not BASELINE | RED |
| G20 | humanoid.mesh_skin: two nodes drawing one mesh through different skins is refused | RED |
| G21 | build(): the cardigan shoulder line is the derived landmark, not a typed height | RED |
| G22 | build(): the collar height is an offset from the derived neck landmark | RED |
| G17 | build(): the outfit is cut at the derived landmarks, not typed heights | RED |

### G1
```
$ python3 -W ignore -m unittest -q scripts.avatar.gate_test.Gate.test_a_base_with_fewer_bones_passes_against_its_own_kind
  gate 53: compare=[] bones=53 required_missing=[]
======================================================================
ERROR: test_a_base_with_fewer_bones_passes_against_its_own_kind (scripts.avatar.gate_test.Gate.test_a_base_with_fewer_bones_passes_against_its_own_kind)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 54, in test_a_base_with_fewer_bones_passes_against_its_own_kind
    make.gate('53', self.no_upper_chest, self.no_upper_chest)
    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/make.py", line 172, in gate
    raise SystemExit(f'{label} 動到骨架了：compare={diffs} required_missing={missing}')
SystemExit: 53 動到骨架了：compare=[] required_missing=[]
----------------------------------------------------------------------
Ran 1 test in 0.045s
FAILED (errors=1)
```

### G2
```
$ python3 -W ignore -m unittest -q scripts.avatar.gate_test.Gate.test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too
  gate hand: compare=[] bones=53 required_missing=[]
======================================================================
FAIL: test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too (scripts.avatar.gate_test.Gate.test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 59, in test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too
    with self.assertRaises(SystemExit) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: SystemExit not raised
----------------------------------------------------------------------
Ran 1 test in 0.040s
FAILED (failures=1)
```

### G3
```
$ python3 -W ignore -m unittest -q scripts.avatar.gate_test.Gate.test_a_bone_present_on_one_side_only_fails_through_compare
  gate one-sided: compare=[] bones=53 required_missing=[]
======================================================================
FAIL: test_a_bone_present_on_one_side_only_fails_through_compare (scripts.avatar.gate_test.Gate.test_a_bone_present_on_one_side_only_fails_through_compare)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 64, in test_a_bone_present_on_one_side_only_fails_through_compare
    with self.assertRaises(SystemExit) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: SystemExit not raised
----------------------------------------------------------------------
Ran 1 test in 0.033s
FAILED (failures=1)
```

### G4
```
$ python3 -W ignore -m unittest -q scripts.avatar.verify_test.Report.test_a_model_missing_a_required_bone_is_named
======================================================================
FAIL: test_a_model_missing_a_required_bone_is_named (scripts.avatar.verify_test.Report.test_a_model_missing_a_required_bone_is_named)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/verify_test.py", line 58, in test_a_model_missing_a_required_bone_is_named
    self.assertFalse(ok)
    ~~~~~~~~~~~~~~~~^^^^
AssertionError: True is not false
----------------------------------------------------------------------
Ran 1 test in 0.119s
FAILED (failures=1)
```

### G5
```
$ python3 -W ignore -m unittest -q scripts.avatar.verify_test.Report.test_a_model_without_an_optional_bone_passes
----------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/verify_test.py", line 53, in test_a_model_without_an_optional_bone_passes
    self.assertTrue(ok, text)
    ~~~~~~~~~~~~~~~^^^^^^^^^^
AssertionError: False is not true : == /var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmphsclbyiw/model.vrm
   tris 102984  materials 34  images 43  nodes 144  bones 53
   springs 4  colliders 17  blendShapeGroups 15
   Face.baked        10 prim    3158 tris  targets 56
   Body.baked        23 prim   86734 tris  targets 6
   Hair001.baked     72 prim   13092 tris  targets 0
   vertex sha 0ef55e617ea791cd
   FAIL humanoid bones 53, missing required 
   backwards-wound primitives: 0
   coloured outlines: 0
   materials no primitive uses: 0
   materials out of step with materialProperties: 0
   sparse accessors with wrong min/max: 0
   meshes with uneven morph target counts: 0
   grafted shape keys that tear their mesh: 0
   materials with no rim colour: 0
   dangling joint references: 0
   collider groups no spring uses: 0
   FAIL
----------------------------------------------------------------------
Ran 1 test in 0.120s
FAILED (failures=1)
```

### G6
```
$ python3 -W ignore -m unittest -q scripts.avatar.verify_test.DanglingJoints.test_a_primitive_is_checked_against_its_own_nodes_skin
======================================================================
FAIL: test_a_primitive_is_checked_against_its_own_nodes_skin (scripts.avatar.verify_test.DanglingJoints.test_a_primitive_is_checked_against_its_own_nodes_skin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/verify_test.py", line 91, in test_a_primitive_is_checked_against_its_own_nodes_skin
    self.assertEqual([(b[0], b[1], b[2], b[3], b[4]) for b in bad], [('M', 0, 2, 2, 2)])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != [('M', 0, 2, 2, 2)]
Second list contains 1 additional elements.
First extra element 0:
('M', 0, 2, 2, 2)
- []
+ [('M', 0, 2, 2, 2)]
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### G7
```
$ python3 -W ignore -m unittest -q scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test
ssertionError: False is not true : seed 7
  deletable parts available: 24
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
  [FAIL] 54 humanoid bones
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
  [ok] materialProperties still line up with materials
  FAIL
----------------------------------------------------------------------
Ran 1 test in 0.106s
FAILED (failures=1)
```

### G8
```
$ python3 -W ignore -m unittest -q scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test
ssertionError: False is not true : seed 7
  deletable parts available: 24
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
  [FAIL] 15 blendShapeGroups intact
  [ok] tints landed
  [ok] retinted materials are still on the model
  [ok] every palette entry names live parts
  [ok] every shape key names live parts
  [ok] 6 shape keys in the manifest still displace
  [ok] 6 shape keys in the file are all in the manifest
  [ok] every mesh keeps one morph target count
  [ok] no material is left painting nothing
  [ok] every palette entry names a material still in the file
  [ok] materialProperties still line up with materials
  FAIL
----------------------------------------------------------------------
Ran 1 test in 0.126s
FAILED (failures=1)
```

### G9
```
$ python3 -W ignore -m unittest -q scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test
ssertionError: False is not true : seed 7
  deletable parts available: 24
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
  [FAIL] 56 face morph targets intact
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
  [ok] materialProperties still line up with materials
  FAIL
----------------------------------------------------------------------
Ran 1 test in 0.138s
FAILED (failures=1)
```

### G10
```
$ python3 -W ignore -m unittest -q scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.test_the_perturbed_model_passes_its_own_customisation_self_test
ssertionError: False is not true : seed 7
  deletable parts available: 24
  dropping: Hair_Bangs, Acc_HairClip_Bear, Hair_Bun_R
  retinting Mellow_Inner -> [0.821, 0.094, 0.583]
  retinting Mellow_Inner_Sub -> [0.91, 0.215, 0.086]
  removed 14 primitives, swept 87 accessors / 87 bufferViews
  materials left painting nothing: F00_000_Hair_00_HAIR_01, Milfy_Bear
  triangles 102984 -> 101436 (expected 101436)
  [ok] still a VRM0
  [ok] triangles match the manifest
  [ok] no orphan accessors
  [FAIL] skeleton unmoved
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
  [ok] materialProperties still line up with materials
  FAIL
----------------------------------------------------------------------
Ran 1 test in 0.154s
FAILED (failures=1)
```

### G11
```
$ python3 -W ignore -m unittest -q scripts.avatar.pose_test.OwnSkin.test_a_mesh_on_the_second_skin_follows_its_own_joint_order
0.0], atol=1e-9)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 1768, in assert_allclose
    assert_array_compare(compare, actual, desired, err_msg=str(err_msg),
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header=header, equal_nan=equal_nan,
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Not equal to tolerance rtol=1e-07, atol=1e-09
Mismatched elements: 2 / 3 (66.7%)
Mismatch at indices:
 [0]: -1.0 (ACTUAL), -2.0 (DESIRED)
 [1]: 1.0 (ACTUAL), 0.0 (DESIRED)
Max absolute difference among violations: 1.
Max relative difference among violations: 0.5
 ACTUAL: array([-1.,  1.,  0.])
 DESIRED: array([-2.,  0.,  0.])
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### G12
```
$ python3 -W ignore -m unittest -q scripts.avatar.pose_test.OwnSkin.test_normals_on_the_second_skin_turn_with_their_own_bone
0, 0.0], atol=1e-9)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 1768, in assert_allclose
    assert_array_compare(compare, actual, desired, err_msg=str(err_msg),
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header=header, equal_nan=equal_nan,
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Not equal to tolerance rtol=1e-07, atol=1e-09
Mismatched elements: 2 / 3 (66.7%)
Mismatch at indices:
 [0]: 0.0 (ACTUAL), -1.0 (DESIRED)
 [1]: 1.0 (ACTUAL), 0.0 (DESIRED)
Max absolute difference among violations: 1.
Max relative difference among violations: 1.
 ACTUAL: array([0., 1., 0.])
 DESIRED: array([-1.,  0.,  0.])
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### G13
```
$ python3 -W ignore -m unittest -q scripts.avatar.pose_test.OwnSkin.test_a_mesh_on_the_second_skin_follows_its_own_joint_order
0.0], atol=1e-9)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 1768, in assert_allclose
    assert_array_compare(compare, actual, desired, err_msg=str(err_msg),
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header=header, equal_nan=equal_nan,
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Not equal to tolerance rtol=1e-07, atol=1e-09
Mismatched elements: 2 / 3 (66.7%)
Mismatch at indices:
 [0]: -1.0 (ACTUAL), -2.0 (DESIRED)
 [1]: 1.0 (ACTUAL), 0.0 (DESIRED)
Max absolute difference among violations: 1.
Max relative difference among violations: 0.5
 ACTUAL: array([-1.,  1.,  0.])
 DESIRED: array([-2.,  0.,  0.])
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### G14
```
$ python3 -W ignore -m unittest -q scripts.avatar.humanoid_test.Wiring.test_no_module_reads_the_first_skin_for_every_mesh
======================================================================
FAIL: test_no_module_reads_the_first_skin_for_every_mesh (scripts.avatar.humanoid_test.Wiring.test_no_module_reads_the_first_skin_for_every_mesh)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 177, in test_no_module_reads_the_first_skin_for_every_mesh
    self.assertEqual(offenders, [], f'這些檔案拿 skins[0] 當每個 mesh 的 skin：{offenders}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['avatar/envelope.py'] != []
First list contains 1 additional elements.
First extra element 0:
'avatar/envelope.py'
- ['avatar/envelope.py']
+ [] : 這些檔案拿 skins[0] 當每個 mesh 的 skin：['avatar/envelope.py']
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### G15
```
$ python3 -W ignore -m unittest -q scripts.avatar.outfit_test.RestPose.test_add_bones_grows_every_skin_that_shares_the_joint_list
======================================================================
FAIL: test_add_bones_grows_every_skin_that_shares_the_joint_list (scripts.avatar.outfit_test.RestPose.test_add_bones_grows_every_skin_that_shares_the_joint_list)
VRoid draws face, body and hair through three skins over one joint
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/outfit_test.py", line 510, in test_add_bones_grows_every_skin_that_shares_the_joint_list
    self.assertEqual(twin['joints'], first['joints'], '共享 joint list 的 skin 沒有跟著長')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] != [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
Second list contains 1 additional elements.
First extra element 10:
10
- [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
+ [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
?                              ++++
 : 共享 joint list 的 skin 沒有跟著長
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (failures=1)
```

### G16
```
$ python3 -W ignore -m unittest -q scripts.avatar.build_test.Landmarks.test_joint_heights_come_from_the_skeleton
======================================================================
FAIL: test_joint_heights_come_from_the_skeleton (scripts.avatar.build_test.Landmarks.test_joint_heights_come_from_the_skeleton)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 54, in test_joint_heights_come_from_the_skeleton
    self.assertAlmostEqual(lm[key], value, places=9, msg=key)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.843 != 0.8 within 9 places (0.04299999999999993 difference) : hip
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### G18
```
$ python3 -W ignore -m unittest -q scripts.avatar.humanoid_test.Facade.test_all_joints_is_the_union_in_first_seen_order
======================================================================
FAIL: test_all_joints_is_the_union_in_first_seen_order (scripts.avatar.humanoid_test.Facade.test_all_joints_is_the_union_in_first_seen_order)
A garment file whose skins list different joints (or the same ones
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 100, in test_all_joints_is_the_union_in_first_seen_order
    self.assertEqual(humanoid.all_joints(doc), [0, 1, len(doc['nodes']) - 1])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [0, 1] != [0, 1, 5]
Second list contains 1 additional elements.
First extra element 2:
5
- [0, 1]
+ [0, 1, 5]
?      +++
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### G19
```
$ python3 -W ignore -m unittest -q scripts.avatar.gate_test.Wiring.test_main_threads_base_through_every_step
or a year, so a model whose bytes\n    # changed has to arrive under a new name; the registry in\n    # src/components/chat/avatarVariants.ts points at this one. -2: 2026-09-03,\n    # the scalp, the shared skin solve and the neck band. -3: 2026-09-04, the\n    # twintails hang outside the cardigan and collide with it (twintail.py).\n    # -4: same day, proportion scales the face\'s morph deltas with the head so\n    # the >< eyes clear the skin (proportion.py). -5: same day, blonde hair with\n    # a shade tone; cap edge and nape strips recoloured (customise.py).\n    dest = os.path.join(BASE, \'..\', \'..\', \'public\', \'avatar\', SHIPPED)\n    shutil.copy(p(\'mika-milfy.vrm\'), dest)\n    shutil.copy(p(\'mika-milfy.parts.json\'),\n                os.path.join(BASE, \'..\', \'..\', \'public\', \'avatar\',\n                             SHIPPED.replace(\'.vrm\', \'.parts.json\')))\n    print(f\'\\nshipped {os.path.normpath(dest)}\')\n\n    subprocess.run([sys.executable, \'render.py\', p(\'mika-milfy.vrm\'), p(\'final\')],\n                   cwd=BASE, check=True)\n\n\n'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### G20
```
$ python3 -W ignore -m unittest -q scripts.avatar.humanoid_test.Facade.test_mesh_skin_follows_the_node_and_refuses_two_answers
======================================================================
FAIL: test_mesh_skin_follows_the_node_and_refuses_two_answers (scripts.avatar.humanoid_test.Facade.test_mesh_skin_follows_the_node_and_refuses_two_answers)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 87, in test_mesh_skin_follows_the_node_and_refuses_two_answers
    with self.assertRaises(humanoid.BadRig) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^
AssertionError: BadRig not raised
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### G21
```
$ python3 -W ignore -m unittest -q scripts.avatar.build_test.Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### G22
```
$ python3 -W ignore -m unittest -q scripts.avatar.build_test.Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### G17
```
$ python3 -W ignore -m unittest -q scripts.avatar.build_test.Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks
  # a worse failure than the one being fixed here: the reorder was loud and\n    # cost a diff, a dropped section is invisible and nothing downstream would\n    # catch it (verify.py never opens this file, and selftest only reads parts,\n    # palette and shapes). Unknown keys sort to the tail, in name order, so they\n    # survive and are still deterministic.\n    ORDER = (\'source\', \'parts\', \'palette\', \'shapes\', \'landmarks\')\n    manifest = dict(sorted(manifest.items(),\n                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER\n                                           else len(ORDER), kv[0])))\n    json.dump(manifest, open(out_manifest, \'w\'), indent=2, ensure_ascii=False)\n    return added, size, lm\n\n\nif __name__ == \'__main__\':\n    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])\n    print(f\'wrote {sys.argv[2]} ({size} bytes)\')\n    print(f\'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}\')\n    for k, (v, mesh) in added.items():\n        print(f\'  + {k:<22} {v:>6} tris  -> {mesh}\')\n'
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

