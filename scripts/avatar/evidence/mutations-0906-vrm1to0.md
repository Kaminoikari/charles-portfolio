V1 RED  restored=True
V2 RED  restored=True
V3 RED  restored=True
V4 RED  restored=True
V5 RED  restored=True
V6 RED  restored=True
V7 RED  restored=True
V8 RED  restored=True
V9 RED  restored=True
V10 RED  restored=True
V11 RED  restored=True
V12 RED  restored=True
V13 RED  restored=True
V14 RED  restored=True
V15 RED  restored=True
V16 RED  restored=True
V17 RED  restored=True
V18 RED  restored=True
V19 RED  restored=True
V20 RED  restored=True
V21 RED  restored=True
V22 RED  restored=True
V23 RED  restored=True
V24 RED  restored=True
V25 RED  restored=True
V26 RED  restored=True
V28 RED  restored=True
V27 RED  restored=True
V29 RED  restored=True
V30 RED  restored=True
V31 RED  restored=True
V32 RED  restored=True
V33 RED  restored=True
V34 RED  restored=True
V35 RED  restored=True
T1 RED  restored=True
T2 RED  restored=True

| # | guard | result |
|---|---|---|
| V1 | humanoid: 1.0 thumb names go back to the 0.x names three-vrm renames from | RED |
| V2 | facing: the new scene root turns the body half a turn about Y | RED |
| V3 | springs: collider offset z is negated (three-vrm _v0Import negates it back) | RED |
| V4 | springs: a 1.0 collider group spanning nodes splits into one 0.x group per node | RED |
| V5 | springs: a capsule becomes a row of spheres reaching its tail | RED |
| V6 | springs: stiffness is written under 0.x's misspelling `stiffiness`, the key three-vrm reads | RED |
| V7 | expressions: bind weights are scaled from [0, 1] to [0, 100] | RED |
| V8 | expressions: a bind names the MESH the 1.0 node draws, not the node | RED |
| V9 | expressions: materialColorBinds become materialValues | RED |
| V10 | materials: colours go back to the gamma space the compat plugin decodes with pow 2.2 | RED |
| V11 | materials: shadingShift/Toony invert the compat lerp, not pass through | RED |
| V12 | materials: outline width is written in hundredths | RED |
| V13 | materials: BLEND sets _ALPHABLEND_ON, the blend mode and the transparent queue | RED |
| V14 | materials: a non-MToon material still gets a block, so materialProperties[i] is materials[i] | RED |
| V15 | materials: baseColorFactor is rewritten to _Color's numbers (what customise.tint assumes) | RED |
| V16 | the VRMC_* extension blocks are removed | RED |
| V17 | meta: the thumbnail IMAGE index becomes the index of a TEXTURE sourcing it | RED |
| V18 | lookAt: the head offset z is negated (three-vrm _v0Import negates it back) | RED |
| V19 | ensure_vrm0: a 0.x base passes through by path, untouched | RED |
| V20 | make.main: the converted path REPLACES base before partition | RED |
| V21 | node constraints are stripped and reported | RED |
| V22 | materials: the _MainTex offset y is measured from the other edge | RED |
| V23 | round trip: preset names come back through the inverted v0v1PresetNameMap | RED |
| V24 | meta: personalNonProfit is the only 1.0 value that maps to Disallow | RED |
| V25 | round trip: without the half turn the twin comes back facing +Z and every bone is elsewhere | RED |
| V26 | materials: a plain material keeps KHR_materials_emissive_strength for the glTF loader | RED |
| V28 | materials: the emissive strength is read BEFORE the extension is popped (the first draft popped first) | RED |
| V27 | facing: a file with more than one scene says so, since only the active scene is turned | RED |
| V29 | meta: the 1.0-only licence fields are reported when dropped | RED |
| V30 | materials: a tinted matcapFactor is reported as approximated | RED |
| V31 | materials: the degenerate shade pair falls back to MToon's default toony 0.9 | RED |
| V32 | materials: a texture on UV set 1 is reported as dropped | RED |
| V33 | materials: a slot whose effective texture transform differs from _MainTex's is reported | RED |
| V34 | materials: a slot with NO transform against a shifted _MainTex is a difference too (round-2 residual) | RED |
| V35 | materials: a rotated _MainTex transform is reported as dropped | RED |
| T1 | twintail._frame_of: a root shared by mesh and skeleton may turn (the pre-fix translation sum refused it) | RED |
| T2 | twintail._frame_of: a rotation between the mesh and a bone is still refused | RED |

### V1
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_humanoid_map_is_a_list_with_the_v0_thumb_names
======================================================================
FAIL: test_humanoid_map_is_a_list_with_the_v0_thumb_names (scripts.avatar.vrm1to0_test.Convert.test_humanoid_map_is_a_list_with_the_v0_thumb_names)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 414, in test_humanoid_map_is_a_list_with_the_v0_thumb_names
    self.assertEqual(humanoid.bones(self.out), {'hips': 1, 'head': 2, 'leftThumbProximal': 6})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'hips': 1, 'head': 2, 'leftThumbMetacarpal': 6} != {'hips': 1, 'head': 2, 'leftThumbProximal': 6}
- {'head': 2, 'hips': 1, 'leftThumbMetacarpal': 6}
?                                  ^^^^^^ ^
+ {'head': 2, 'hips': 1, 'leftThumbProximal': 6}
?                                  ^ ^^^^
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V2
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_the_body_turns_half_a_turn_to_face_minus_z
======================================================================
FAIL: test_the_body_turns_half_a_turn_to_face_minus_z (scripts.avatar.vrm1to0_test.Convert.test_the_body_turns_half_a_turn_to_face_minus_z)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 426, in test_the_body_turns_half_a_turn_to_face_minus_z
    self.assertEqual(root['rotation'], [0, 1, 0, 0])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [0, 0, 0, 1] != [0, 1, 0, 0]
First differing element 1:
0
1
- [0, 0, 0, 1]
?         ---
+ [0, 1, 0, 0]
?     +++
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V3
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_collider_offsets_flip_z_the_way_three_vrm_unflips_them
======================================================================
FAIL: test_collider_offsets_flip_z_the_way_three_vrm_unflips_them (scripts.avatar.vrm1to0_test.Convert.test_collider_offsets_flip_z_the_way_three_vrm_unflips_them)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 438, in test_collider_offsets_flip_z_the_way_three_vrm_unflips_them
    self.assertEqual(sphere['offset'], {'x': 0.1, 'y': 0.2, 'z': -0.3})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'x': 0.1, 'y': 0.2, 'z': 0.3} != {'x': 0.1, 'y': 0.2, 'z': -0.3}
- {'x': 0.1, 'y': 0.2, 'z': 0.3}
+ {'x': 0.1, 'y': 0.2, 'z': -0.3}
?                           +
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V4
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows
======================================================================
FAIL: test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows (scripts.avatar.vrm1to0_test.Convert.test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 442, in test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows
    self.assertEqual([g['node'] for g in groups], [2, 1])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [2] != [2, 1]
Second list contains 1 additional elements.
First extra element 1:
1
- [2]
+ [2, 1]
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V5
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_a_capsule_becomes_spheres_that_reach_its_tail
======================================================================
FAIL: test_a_capsule_becomes_spheres_that_reach_its_tail (scripts.avatar.vrm1to0_test.Convert.test_a_capsule_becomes_spheres_that_reach_its_tail)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 450, in test_a_capsule_becomes_spheres_that_reach_its_tail
    self.assertGreaterEqual(len(caps), 2)
    ~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^
AssertionError: 1 not greater than or equal to 2
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V6
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_a_spring_takes_its_root_joints_parameters_in_v0_spelling
======================================================================
ERROR: test_a_spring_takes_its_root_joints_parameters_in_v0_spelling (scripts.avatar.vrm1to0_test.Convert.test_a_spring_takes_its_root_joints_parameters_in_v0_spelling)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 463, in test_a_spring_takes_its_root_joints_parameters_in_v0_spelling
    self.assertEqual(spring['stiffiness'], 0.8)
                     ~~~~~~^^^^^^^^^^^^^^
KeyError: 'stiffiness'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (errors=1)
```

### V7
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_expression_weights_scale_to_100_and_presets_get_v0_names
======================================================================
FAIL: test_expression_weights_scale_to_100_and_presets_get_v0_names (scripts.avatar.vrm1to0_test.Convert.test_expression_weights_scale_to_100_and_presets_get_v0_names)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 474, in test_expression_weights_scale_to_100_and_presets_get_v0_names
    self.assertEqual(groups['aa']['binds'], [{'mesh': 0, 'index': 1, 'weight': 50.0}])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'mesh': 0, 'index': 1, 'weight': 0.5}] != [{'mesh': 0, 'index': 1, 'weight': 50.0}]
First differing element 0:
{'mesh': 0, 'index': 1, 'weight': 0.5}
{'mesh': 0, 'index': 1, 'weight': 50.0}
- [{'index': 1, 'mesh': 0, 'weight': 0.5}]
?                                      ^
+ [{'index': 1, 'mesh': 0, 'weight': 50.0}]
?                                    +  ^
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V8
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_a_bind_names_the_mesh_the_node_draws
======================================================================
FAIL: test_a_bind_names_the_mesh_the_node_draws (scripts.avatar.vrm1to0_test.Convert.test_a_bind_names_the_mesh_the_node_draws)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 482, in test_a_bind_names_the_mesh_the_node_draws
    self.assertEqual(groups['Extra']['binds'][0]['mesh'], 0)   # node 5 draws mesh 0
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 5 != 0
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V9
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_material_colour_binds_become_material_values
======================================================================
FAIL: test_material_colour_binds_become_material_values (scripts.avatar.vrm1to0_test.Convert.test_material_colour_binds_become_material_values)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 487, in test_material_colour_binds_become_material_values
    self.assertIn({'materialName': 'FaceMToon', 'propertyName': '_ShadeColor',
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   'targetValue': [1, 0, 0, 1]}, mv)
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'materialName': 'FaceMToon', 'propertyName': '_ShadeColor', 'targetValue': [1, 0, 0, 1]} not found in [{'materialName': 'FaceMToon', 'propertyName': '_MainTex_ST', 'targetValue': [2, 2, 0.1, -1.2]}]
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V10
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_colours_are_written_in_the_gamma_space_three_vrm_decodes
======================================================================
FAIL: test_colours_are_written_in_the_gamma_space_three_vrm_decodes (scripts.avatar.vrm1to0_test.Convert.test_colours_are_written_in_the_gamma_space_three_vrm_decodes)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 499, in test_colours_are_written_in_the_gamma_space_three_vrm_decodes
    self.assertAlmostEqual(c[0] ** 2.2, 0.5, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.217637640824031 != 0.5 within 9 places (0.28236235917596897 difference)
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V11
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_shade_shift_and_toony_invert_the_compat_formula
======================================================================
FAIL: test_shade_shift_and_toony_invert_the_compat_formula (scripts.avatar.vrm1to0_test.Convert.test_shade_shift_and_toony_invert_the_compat_formula)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 576, in test_shade_shift_and_toony_invert_the_compat_formula
    self.assertAlmostEqual(fl['_ShadeShift'], 0.0, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: -0.05 != 0.0 within 9 places (0.05 difference)
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V12
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_outline_width_is_in_hundredths
======================================================================
FAIL: test_outline_width_is_in_hundredths (scripts.avatar.vrm1to0_test.Convert.test_outline_width_is_in_hundredths)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 586, in test_outline_width_is_in_hundredths
    self.assertAlmostEqual(fl['_OutlineWidth'], 0.2, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.002 != 0.2 within 9 places (0.198 difference)
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V13
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_blend_mode_keywords_and_queue_follow_alpha_mode
======================================================================
FAIL: test_blend_mode_keywords_and_queue_follow_alpha_mode (scripts.avatar.vrm1to0_test.Convert.test_blend_mode_keywords_and_queue_follow_alpha_mode)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 596, in test_blend_mode_keywords_and_queue_follow_alpha_mode
    self.assertEqual(p['keywordMap'].get('_ALPHABLEND_ON'), True)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: None != True
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V14
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_every_material_gets_a_property_block_in_the_same_position
======================================================================
FAIL: test_every_material_gets_a_property_block_in_the_same_position (scripts.avatar.vrm1to0_test.Convert.test_every_material_gets_a_property_block_in_the_same_position)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 633, in test_every_material_gets_a_property_block_in_the_same_position
    self.assertEqual([p['name'] for p in self.v0['materialProperties']], names)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['FaceMToon'] != ['FaceMToon', 'PlainPBR']
Second list contains 1 additional elements.
First extra element 1:
'PlainPBR'
- ['FaceMToon']
+ ['FaceMToon', 'PlainPBR']
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V15
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_colours_are_written_in_the_gamma_space_three_vrm_decodes
======================================================================
FAIL: test_colours_are_written_in_the_gamma_space_three_vrm_decodes (scripts.avatar.vrm1to0_test.Convert.test_colours_are_written_in_the_gamma_space_three_vrm_decodes)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 510, in test_colours_are_written_in_the_gamma_space_three_vrm_decodes
    self.assertEqual(self.out['materials'][0]['pbrMetallicRoughness']['baseColorFactor'], c)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [0.5, 0.25, 1.0, 0.75] != [0.7297400528407231, 0.5325205447199813, 1.0, 0.75]
First differing element 0:
0.5
0.7297400528407231
- [0.5, 0.25, 1.0, 0.75]
+ [0.7297400528407231, 0.5325205447199813, 1.0, 0.75]
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V16
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_the_1_0_extensions_are_gone_and_VRM_is_declared
======================================================================
FAIL: test_the_1_0_extensions_are_gone_and_VRM_is_declared (scripts.avatar.vrm1to0_test.Convert.test_the_1_0_extensions_are_gone_and_VRM_is_declared)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 666, in test_the_1_0_extensions_are_gone_and_VRM_is_declared
    self.assertFalse([e for e in self.out['extensions'] if e.startswith('VRMC_')])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: ['VRMC_vrm', 'VRMC_springBone'] is not false
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V17
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture
======================================================================
FAIL: test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture (scripts.avatar.vrm1to0_test.Convert.test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 650, in test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture
    self.assertEqual(self.out['textures'][m['texture']]['source'], 4)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 != 4
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V18
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_first_person_and_look_at
======================================================================
FAIL: test_first_person_and_look_at (scripts.avatar.vrm1to0_test.Convert.test_first_person_and_look_at)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 655, in test_first_person_and_look_at
    self.assertEqual(fp['firstPersonBoneOffset'], {'x': 0.01, 'y': 0.06, 'z': -0.02})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'x': 0.01, 'y': 0.06, 'z': 0.02} != {'x': 0.01, 'y': 0.06, 'z': -0.02}
- {'x': 0.01, 'y': 0.06, 'z': 0.02}
+ {'x': 0.01, 'y': 0.06, 'z': -0.02}
?                             +
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V19
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Ensure.test_a_0_x_base_is_returned_untouched
======================================================================
ERROR: test_a_0_x_base_is_returned_untouched (scripts.avatar.vrm1to0_test.Ensure.test_a_0_x_base_is_returned_untouched)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 701, in test_a_0_x_base_is_returned_untouched
    self.assertEqual(vrm1to0.ensure_vrm0(REAL_VRM, out), REAL_VRM)
                     ~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0.py", line 494, in ensure_vrm0
    doc, report = convert(doc)
                  ~~~~~~~^^^^^
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0.py", line 444, in convert
    raise humanoid.BadRig(f'{doc.get("_name", "這個檔")} 已是 VRM 0.x，不需要轉換')
vrmrig.BadRig: 這個檔 已是 VRM 0.x，不需要轉換
----------------------------------------------------------------------
Ran 1 test in 0.003s
FAILED (errors=1)
```

### V20
```
$ python3 -W ignore -m unittest -q scripts.avatar.gate_test.Wiring.test_main_threads_base_through_every_step
======================================================================
FAIL: test_main_threads_base_through_every_step (scripts.avatar.gate_test.Wiring.test_main_threads_base_through_every_step)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 84, in test_main_threads_base_through_every_step
    self.assertRegex(body, r"\n\s+base = vrm1to0\.ensure_vrm0\(base,")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: '\\n
[…]
or a year, so a model whose bytes\n    # changed has to arrive under a new name; the registry in\n    # src/components/chat/avatarVariants.ts points at this one. -2: 2026-09-03,\n    # the scalp, the shared skin solve and the neck band. -3: 2026-09-04, the\n    # twintails hang outside the cardigan and collide with it (twintail.py).\n    # -4: same day, proportion scales the face\'s morph deltas with the head so\n    # the >< eyes clear the skin (proportion.py). -5: same day, blonde hair with\n    # a shade tone; cap edge and nape strips recoloured (customise.py).\n    dest = os.path.join(BASE, \'..\', \'..\', \'public\', \'avatar\', SHIPPED)\n    shutil.copy(p(\'mika-milfy.vrm\'), dest)\n    shutil.copy(p(\'mika-milfy.parts.json\'),\n                os.path.join(BASE, \'..\', \'..\', \'public\', \'avatar\',\n                             SHIPPED.replace(\'.vrm\', \'.parts.json\')))\n    print(f\'\\nshipped {os.path.normpath(dest)}\')\n\n    subprocess.run([sys.executable, \'render.py\', p(\'mika-milfy.vrm\'), p(\'final\')],\n                   cwd=BASE, check=True)\n\n\n'
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V21
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_the_1_0_extensions_are_gone_and_VRM_is_declared
======================================================================
FAIL: test_the_1_0_extensions_are_gone_and_VRM_is_declared (scripts.avatar.vrm1to0_test.Convert.test_the_1_0_extensions_are_gone_and_VRM_is_declared)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 667, in test_the_1_0_extensions_are_gone_and_VRM_is_declared
    self.assertNotIn('extensions', self.out['nodes'][7])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'extensions' unexpectedly found in {'name': 'Constrained', 'translation': [0, 0.05, 0], 'extensions': {'VRMC_node_constraint': {'specVersion': '1.0', 'constraint': {'roll': {'source': 2, 'rollAxis': 'X'}}}}}
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V22
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_texture_slots_and_the_main_transform
======================================================================
FAIL: test_texture_slots_and_the_main_transform (scripts.avatar.vrm1to0_test.Convert.test_texture_slots_and_the_main_transform)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 628, in test_texture_slots_and_the_main_transform
    self.assertAlmostEqual(mt[1], 1 - 0.5 - 0.2)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.2 != 0.3 within 7 places (0.09999999999999998 difference)
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V23
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.RoundTrip.test_expressions
======================================================================
FAIL: test_expressions (scripts.avatar.vrm1to0_test.RoundTrip.test_expressions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 791, in test_expressions
    self.assertEqual([g['presetName'] for g in gb], [g['presetName'] for g in ga])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['neutral', 'unknown', 'i', 'u', 'e', 'o', 'blink', 'b[69 chars]own'] != ['neutral', 'a', 'i', 'u', 'e', 'o', 'blink', 'blink_l[63 chars]own']
First differing element 1:
'unknown'
'a'
  ['neutral',
-  'unknown',
+  'a',
   'i',
   'u',
   'e',
   'o',
   'blink',
   'blink_l',
   'blink_r',
   'angry',
   'fun',
   'joy',
   'sorrow',
   'unknown',
   'unknown']
----------------------------------------------------------------------
Ran 1 test in 0.008s
FAILED (failures=1)
```

### V24
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture
======================================================================
FAIL: test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture (scripts.avatar.vrm1to0_test.Convert.test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 647, in test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture
    self.assertEqual(m['commercialUssageName'], 'Disallow')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'Allow' != 'Disallow'
- Allow
+ Disallow
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V25
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.RoundTrip.test_skeleton
======================================================================
FAIL: test_skeleton (scripts.avatar.vrm1to0_test.RoundTrip.test_skeleton)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 728, in test_skeleton
    self.assertEqual(humanoid.compare(self.orig, self.back, tolerance=1e-9), [])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'rightMiddleDistal', 'distance':[7509 chars]32)}] != []
First list contains 54 additional elements.
First extra element 0:
{'bone': 'rightMiddleDistal', 'distance': 1.2927811569171328, 'from': (0.646004, 1.207805, -0.022352), 'to': (-0.646004, 1.207805, 0.022352)}
Diff is 8371 characters long. Set self.maxDiff to None to see it.
----------------------------------------------------------------------
Ran 1 test in 0.011s
FAILED (failures=1)
```

### V26
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials
======================================================================
FAIL: test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials (scripts.avatar.vrm1to0_test.Convert.test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 516, in test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials
    self.assertNotIn('KHR_materials_emissive_strength', self.out['materials'][0].get('extensions', {}))
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 'KHR_materials_emissive_strength' unexpectedly found in {'KHR_materials_emissive_strength': {'emissiveStrength': 2.0}, 'KHR_materials_unlit': {}}
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V28
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials
======================================================================
FAIL: test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials (scripts.avatar.vrm1to0_test.Convert.test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 515, in test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials
    self.assertAlmostEqual(e[0] ** 2.2, 0.5, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.24999999999999997 != 0.5 within 9 places (0.25 difference)
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V27
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_only_the_active_scene_is_turned_and_that_is_reported
======================================================================
FAIL: test_only_the_active_scene_is_turned_and_that_is_reported (scripts.avatar.vrm1to0_test.Convert.test_only_the_active_scene_is_turned_and_that_is_reported)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 571, in test_only_the_active_scene_is_turned_and_that_is_reported
    self.assertTrue(any('scene' in n for n in report['approximated']), report)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : {'dropped': ['表情 surprised 的 overrideMouth=block，0.x 沒有 override', '材質 FaceMToon 的 _BumpMap 用 texCoord 1，0.x 只有 UV0', 'meta.allowRedistribution=True，0.x 的 meta 沒有這個欄位', "meta.modification='prohibited'，0.x 的 meta 沒有這個欄位", '1 個節點的 VRMC_node_constraint，0.x 沒有 constraint'], 'approximated': ['節點 1 的 capsule 改成 4 顆球', 'spring hair 的 hitRadius 逐關節不同，取根關節的', '材質 FaceMToon 的 _BumpMap 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _SphereAdd 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 matcapFactor [0.5, 0.5, 0.5]，0.x 的 _SphereAdd 沒有顏色，當作白']}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V29
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed
======================================================================
FAIL: test_what_0x_cannot_carry_is_reported_not_swallowed (scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 530, in test_what_0x_cannot_carry_is_reported_not_swallowed
    self.assertTrue(any('meta.allowRedistribution=True' in n for n in dropped), dropped)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : ['表情 surprised 的 overrideMouth=block，0.x 沒有 override', '材質 FaceMToon 的 _BumpMap 用 texCoord 1，0.x 只有 UV0', '1 個節點的 VRMC_node_constraint，0.x 沒有 constraint']
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### V30
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed
======================================================================
FAIL: test_what_0x_cannot_carry_is_reported_not_swallowed (scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 537, in test_what_0x_cannot_carry_is_reported_not_swallowed
    self.assertTrue(any('matcapFactor [0.5, 0.5, 0.5]' in n for n in approx), approx)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : ['節點 1 的 capsule 改成 4 顆球', 'spring hair 的 hitRadius 逐關節不同，取根關節的', '材質 FaceMToon 的 _BumpMap 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _SphereAdd 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的']
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V31
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony
======================================================================
FAIL: test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony (scripts.avatar.vrm1to0_test.Convert.test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 563, in test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony
    self.assertAlmostEqual(fl['_ShadeToony'], 0.9, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.0 != 0.9 within 9 places (0.9 difference)
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V32
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed
======================================================================
FAIL: test_what_0x_cannot_carry_is_reported_not_swallowed (scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 532, in test_what_0x_cannot_carry_is_reported_not_swallowed
    self.assertTrue(any('_BumpMap 用 texCoord 1' in n for n in dropped), dropped)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : ['表情 surprised 的 overrideMouth=block，0.x 沒有 override', 'meta.allowRedistribution=True，0.x 的 meta 沒有這個欄位', "meta.modification='prohibited'，0.x 的 meta 沒有這個欄位", '1 個節點的 VRMC_node_constraint，0.x 沒有 constraint']
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V33
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed
======================================================================
FAIL: test_what_0x_cannot_carry_is_reported_not_swallowed (scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 533, in test_what_0x_cannot_carry_is_reported_not_swallowed
    self.assertTrue(any('_ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同' in n for n in approx), approx)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : ['節點 1 的 capsule 改成 4 顆球', 'spring hair 的 hitRadius 逐關節不同，取根關節的', '材質 FaceMToon 的 matcapFactor [0.5, 0.5, 0.5]，0.x 的 _SphereAdd 沒有顏色，當作白']
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V34
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed
======================================================================
FAIL: test_what_0x_cannot_carry_is_reported_not_swallowed (scripts.avatar.vrm1to0_test.Convert.test_what_0x_cannot_carry_is_reported_not_swallowed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 536, in test_what_0x_cannot_carry_is_reported_not_swallowed
    self.assertTrue(any('_BumpMap 的 KHR_texture_transform 與 _MainTex 不同' in n for n in approx), approx)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : ['節點 1 的 capsule 改成 4 顆球', 'spring hair 的 hitRadius 逐關節不同，取根關節的', '材質 FaceMToon 的 _ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 matcapFactor [0.5, 0.5, 0.5]，0.x 的 _SphereAdd 沒有顏色，當作白']
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### V35
```
$ python3 -W ignore -m unittest -q scripts.avatar.vrm1to0_test.Convert.test_a_rotated_main_texture_transform_is_reported
======================================================================
FAIL: test_a_rotated_main_texture_transform_is_reported (scripts.avatar.vrm1to0_test.Convert.test_a_rotated_main_texture_transform_is_reported)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrm1to0_test.py", line 555, in test_a_rotated_main_texture_transform_is_reported
    self.assertTrue(any('_MainTex 有 KHR_texture_transform.rotation' in n for n in r['dropped']), r)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : {'dropped': ['表情 surprised 的 overrideMouth=block，0.x 沒有 override', '材質 FaceMToon 的 _BumpMap 用 texCoord 1，0.x 只有 UV0', 'meta.allowRedistribution=True，0.x 的 meta 沒有這個欄位', "meta.modification='prohibited'，0.x 的 meta 沒有這個欄位", '1 個節點的 VRMC_node_constraint，0.x 沒有 constraint'], 'approximated': ['節點 1 的 capsule 改成 4 顆球', 'spring hair 的 hitRadius 逐關節不同，取根關節的', '材質 FaceMToon 的 _BumpMap 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 _SphereAdd 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的', '材質 FaceMToon 的 matcapFactor [0.5, 0.5, 0.5]，0.x 的 _SphereAdd 沒有顏色，當作白']}
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### T1
```
$ python3 -W ignore -m unittest -q scripts.avatar.twintail_test.MeshFrameTest.test_a_root_shared_by_mesh_and_skeleton_may_turn
======================================================================
ERROR: test_a_root_shared_by_mesh_and_skeleton_may_turn (scripts.avatar.twintail_test.MeshFrameTest.test_a_root_shared_by_mesh_and_skeleton_may_turn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/twintail_test.py", line 200, in test_a_root_shared_by_mesh_and_skeleton_may_turn
    np.testing.assert_allclose(turned(2), plain(2), atol=1e-12)
                               ~~~~~~^^^
  File "/Users/charles/portfolio/scripts/avatar/twintail.py", line 733, in position
    raise SystemExit(f'節點 {i} 有旋轉，這裡的平移假設不成立')
SystemExit: 節點 0 有旋轉，這裡的平移假設不成立
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (errors=1)
```

### T2
```
$ python3 -W ignore -m unittest -q scripts.avatar.twintail_test.MeshFrameTest.test_a_rotation_between_the_mesh_and_a_bone_is_refused
======================================================================
FAIL: test_a_rotation_between_the_mesh_and_a_bone_is_refused (scripts.avatar.twintail_test.MeshFrameTest.test_a_rotation_between_the_mesh_and_a_bone_is_refused)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/twintail_test.py", line 205, in test_a_rotation_between_the_mesh_and_a_bone_is_refused
    with self.assertRaises(SystemExit):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: SystemExit not raised
----------------------------------------------------------------------
Ran 1 test in 0.010s
FAILED (failures=1)
```

