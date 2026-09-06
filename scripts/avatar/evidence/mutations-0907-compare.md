C1 RED  restored=True
C2 RED  restored=True
C3 RED  restored=True
C4 RED  restored=True
C5 RED  restored=True
C6 RED  restored=True
C7 RED  restored=True

| # | guard | result |
|---|---|---|
| C1 | the half turn between the versions is undone before the distances are taken | RED |
| C2 | and so is the thumb spelling, or 1.0's Proximal is measured against 0.x's | RED |
| C3 | only the 1.0 side is turned; turning both leaves them a half turn apart again | RED |
| C4 | compare() actually routes the baseline through it, not just the file under test | RED |
| C5 | and the file under test, not just the baseline | RED |
| C6 | a bone that really moved is still caught ACROSS the versions | RED |
| C7 | and within one version, which is what every build-time gate compares | RED |

### C1
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved
test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone. ... FAIL
======================================================================
FAIL: test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 147, in test_the_same_skeleton_written_both_ways_has_not_moved
    self.assertEqual(vrmrig.compare(v0, v1), [],
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     '同一副骨架寫成兩個版本，只是轉了半圈')
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'leftHand', 'distance': 0.412310[60 chars]05)}] != []
First list contains 1 additional elements.
First extra element 0:
{'bone': 'leftHand', 'distance': 0.41231056256176607, 'from': (0.2, 1.1, 0.05), 'to': (-0.2, 1.1, -0.05)}
+ []
- [{'bone': 'leftHand',
-   'distance': 0.41231056256176607,
-   'from': (0.2, 1.1, 0.05),
-   'to': (-0.2, 1.1, -0.05)}] : 同一副骨架寫成兩個版本，只是轉了半圈
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### C2
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_the_thumbs_are_compared_joint_for_joint_not_name_for_name
test_the_thumbs_are_compared_joint_for_joint_not_name_for_name (vrmrig_test.Versions.test_the_thumbs_are_compared_joint_for_joint_not_name_for_name)
1.0's leftThumbProximal is 0.x's leftThumbIntermediate. ... FAIL
======================================================================
FAIL: test_the_thumbs_are_compared_joint_for_joint_not_name_for_name (vrmrig_test.Versions.test_the_thumbs_are_compared_joint_for_joint_not_name_for_name)
1.0's leftThumbProximal is 0.x's leftThumbIntermediate.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 173, in test_the_thumbs_are_compared_joint_for_joint_not_name_for_name
    self.assertEqual(vrmrig.compare(v0, v1), [],
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     '同一隻拇指，兩個版本的拼法不同而已')
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'leftThumbIntermediate', 'distan[198 chars].0)}] != []
First list contains 3 additional elements.
First extra element 0:
{'bone': 'leftThumbIntermediate', 'distance': None, 'note': '只有一邊有這根骨頭'}
+ []
- [{'bone': 'leftThumbIntermediate', 'distance': None, 'note': '只有一邊有這根骨頭'},
-  {'bone': 'leftThumbMetacarpal', 'distance': None, 'note': '只有一邊有這根骨頭'},
-  {'bone': 'leftThumbProximal',
-   'distance': 0.03,
-   'from': (0.1, 1.0, 0.0),
-   'to': (0.13, 1.0, -0.0)}] : 同一隻拇指，兩個版本的拼法不同而已
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### C3
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved
test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone. ... FAIL
======================================================================
FAIL: test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 147, in test_the_same_skeleton_written_both_ways_has_not_moved
    self.assertEqual(vrmrig.compare(v0, v1), [],
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     '同一副骨架寫成兩個版本，只是轉了半圈')
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'leftHand', 'distance': 0.412310[60 chars]05)}] != []
First list contains 1 additional elements.
First extra element 0:
{'bone': 'leftHand', 'distance': 0.41231056256176607, 'from': (-0.2, 1.1, -0.05), 'to': (0.2, 1.1, 0.05)}
+ []
- [{'bone': 'leftHand',
-   'distance': 0.41231056256176607,
-   'from': (-0.2, 1.1, -0.05),
-   'to': (0.2, 1.1, 0.05)}] : 同一副骨架寫成兩個版本，只是轉了半圈
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### C4
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved
test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone. ... FAIL
======================================================================
FAIL: test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 153, in test_the_same_skeleton_written_both_ways_has_not_moved
    self.assertEqual(vrmrig.compare(v1, v0), [], '換邊比也一樣')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'leftHand', 'distance': 0.412310[60 chars]05)}] != []
First list contains 1 additional elements.
First extra element 0:
{'bone': 'leftHand', 'distance': 0.41231056256176607, 'from': (-0.2, 1.1, -0.05), 'to': (0.2, 1.1, 0.05)}
+ []
- [{'bone': 'leftHand',
-   'distance': 0.41231056256176607,
-   'from': (-0.2, 1.1, -0.05),
-   'to': (0.2, 1.1, 0.05)}] : 換邊比也一樣
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### C5
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved
test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone. ... FAIL
======================================================================
FAIL: test_the_same_skeleton_written_both_ways_has_not_moved (vrmrig_test.Versions.test_the_same_skeleton_written_both_ways_has_not_moved)
A 1.0 export is the body turned round, and that is not a moved bone.
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 147, in test_the_same_skeleton_written_both_ways_has_not_moved
    self.assertEqual(vrmrig.compare(v0, v1), [],
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     '同一副骨架寫成兩個版本，只是轉了半圈')
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [{'bone': 'leftHand', 'distance': 0.412310[60 chars]05)}] != []
First list contains 1 additional elements.
First extra element 0:
{'bone': 'leftHand', 'distance': 0.41231056256176607, 'from': (0.2, 1.1, 0.05), 'to': (-0.2, 1.1, -0.05)}
+ []
- [{'bone': 'leftHand',
-   'distance': 0.41231056256176607,
-   'from': (0.2, 1.1, 0.05),
-   'to': (-0.2, 1.1, -0.05)}] : 同一副骨架寫成兩個版本，只是轉了半圈
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### C6
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_a_bone_that_really_moved_is_still_caught_across_the_versions
test_a_bone_that_really_moved_is_still_caught_across_the_versions (vrmrig_test.Versions.test_a_bone_that_really_moved_is_still_caught_across_the_versions) ... FAIL
======================================================================
FAIL: test_a_bone_that_really_moved_is_still_caught_across_the_versions (vrmrig_test.Versions.test_a_bone_that_really_moved_is_still_caught_across_the_versions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 188, in test_a_bone_that_really_moved_is_still_caught_across_the_versions
    self.assertEqual([d['bone'] for d in diffs], ['leftHand'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != ['leftHand']
Second list contains 1 additional elements.
First extra element 0:
'leftHand'
- []
+ ['leftHand']
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### C7
```
$ python3 -W ignore -m unittest -v vrmrig_test.Comparison.test_a_millimetre_is_already_a_difference
test_a_millimetre_is_already_a_difference (vrmrig_test.Comparison.test_a_millimetre_is_already_a_difference)
VRoid writes the same numbers for an untouched body slider, so any ... FAIL
======================================================================
FAIL: test_a_millimetre_is_already_a_difference (vrmrig_test.Comparison.test_a_millimetre_is_already_a_difference)
VRoid writes the same numbers for an untouched body slider, so any
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 292, in test_a_millimetre_is_already_a_difference
    self.assertEqual([d['bone'] for d in diffs], ['spine'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != ['spine']
Second list contains 1 additional elements.
First extra element 0:
'spine'
- []
+ ['spine']
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

