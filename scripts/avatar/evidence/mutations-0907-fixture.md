P1 RED  restored=True
P2 RED  restored=True
P3 RED  restored=True
P4 RED  restored=True
P5 RED  restored=True

| # | guard | result |
|---|---|---|
| P1 | partition refuses a body it cannot name, instead of labelling its meshes by VRoid rules | RED |
| P2 | the missing Face mesh is one of the reasons, and the reason names the meshes that ARE there | RED |
| P3 | a mesh named Body.baked with the wrong primitive count is refused (BODY_NAMES is an index table, so a short one silently leaves outfit primitives as Body_Skin and a long one raises deep inside the loop) | RED |
| P4 | a body with no Body.baked at all is refused, not just one with the wrong count | RED |
| P5 | the recogniser accepts the body this step WAS written for; a recogniser that refuses everything is not a guard | RED |

### P1
```
$ python3 -m unittest -v gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/Users/charles/portfolio/scripts/avatar/../../public/avatar/mika-pink.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
test_partition_refuses_rather_than_naming_a_stranger (gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger) ... /Users/charles/portfolio/scripts/avatar/glb.py:230: ResourceWarning: unclosed file <_io.BufferedWriter name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpk7alktvf/stranger.vrm'>
  open(path, 'wb').write(glb)
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpk7alktvf/stranger.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/Users/charles/portfolio/scripts/avatar/glb.py:230: ResourceWarning: unclosed file <_io.BufferedWriter name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpsub0yw7c/parted.vrm'>
  open(path, 'wb').write(glb)
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/Users/charles/portfolio/scripts/avatar/partition.py:192: ResourceWarning: unclosed file <_io.TextIOWrapper name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpsub0yw7c/parted.vrm.json' mode='w' encoding='UTF-8'>
  json.dump(manifest, open(parts_path, 'w'), indent=2, ensure_ascii=False)
Reso
```

### P2
```
$ python3 -m unittest -v gate_test.PartitionRecognises.test_a_body_without_the_face_mesh_is_refused_by_name
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/Users/charles/portfolio/scripts/avatar/../../public/avatar/mika-pink.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
test_a_body_without_the_face_mesh_is_refused_by_name (gate_test.PartitionRecognises.test_a_body_without_the_face_mesh_is_refused_by_name) ... FAIL
======================================================================
FAIL: test_a_body_without_the_face_mesh_is_refused_by_name (gate_test.PartitionRecognises.test_a_body_without_the_face_mesh_is_refused_by_name)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 98, in test_a_body_without_the_face_mesh_is_refused_by_name
    self.assertTrue(any(partition.FACE_MESH in r for r in reasons), reasons)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : []
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### P3
```
$ python3 -m unittest -v gate_test.PartitionRecognises.test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/Users/charles/portfolio/scripts/avatar/../../public/avatar/mika-pink.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused (gate_test.PartitionRecognises.test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused) ... FAIL
======================================================================
FAIL: test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused (gate_test.PartitionRecognises.test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 113, in test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused
    self.assertTrue(any('BODY_NAMES' in r for r in reasons), reasons)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : []
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### P4
```
$ python3 -m unittest -v gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/Users/charles/portfolio/scripts/avatar/../../public/avatar/mika-pink.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
test_partition_refuses_rather_than_naming_a_stranger (gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger) ... /Users/charles/portfolio/scripts/avatar/glb.py:230: ResourceWarning: unclosed file <_io.BufferedWriter name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpwmmx5tuu/stranger.vrm'>
  open(path, 'wb').write(glb)
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/tmpwmmx5tuu/stranger.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ERROR
======================================================================
ERROR: test_partition_refuses_rather_than_naming_a_stranger (gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 123, in test_partition_refuses_rather_than_naming_a_stranger
    partition.partition(path, out, out + '.json')
    ~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/charles/portfo
```

### P5
```
$ python3 -m unittest -v gate_test.PartitionRecognises.test_the_body_this_step_was_written_for_is_recognised
/Users/charles/portfolio/scripts/avatar/glb.py:44: ResourceWarning: unclosed file <_io.BufferedReader name='/Users/charles/portfolio/scripts/avatar/../../public/avatar/mika-pink.vrm'>
  raw = open(path, 'rb').read()
ResourceWarning: Enable tracemalloc to get the object allocation traceback
test_the_body_this_step_was_written_for_is_recognised (gate_test.PartitionRecognises.test_the_body_this_step_was_written_for_is_recognised) ... FAIL
======================================================================
FAIL: test_the_body_this_step_was_written_for_is_recognised (gate_test.PartitionRecognises.test_the_body_this_step_was_written_for_is_recognised)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/gate_test.py", line 90, in test_the_body_this_step_was_written_for_is_recognised
    self.assertEqual(partition.recognise(self.doc), [])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['沒有名為 Face.baked 的 mesh（有的是：）', '沒有名為 Bod[47 chars]何東西'] != []
First list contains 2 additional elements.
First extra element 0:
'沒有名為 Face.baked 的 mesh（有的是：）'
+ []
- ['沒有名為 Face.baked 的 mesh（有的是：）',
-  '沒有名為 Body.baked 的 mesh，因此 BODY_NAMES 的 primitive 編號對不到任何東西']
----------------------------------------------------------------------
Ran 1 test in 0.014s
FAILED (failures=1)
```

