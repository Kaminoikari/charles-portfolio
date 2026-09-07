W1 RED  restored=True
W2 RED  restored=True
W3 RED  restored=True
W4 RED  restored=True
W5 RED  restored=True
W6 RED  restored=True
W7 RED  restored=True
W8 RED  restored=True
S1 RED  restored=True
S2 RED  restored=True
S3 RED  restored=True
S4 RED  restored=True
S5 RED  restored=True
S6 RED  restored=True
S7 RED  restored=True
S8 RED  restored=True
S9 RED  restored=True

| # | guard | result |
|---|---|---|
| W1 | the band is the body's own hips-to-shoulder span, not a fixed range of metres | RED |
| W2 | the slab each sample averages over is a length on THIS body, so it scales with it | RED |
| W3 | the span is read off the body rather than being the shipped body's span in metres | RED |
| W4 | the grid is fine enough to find the waist on the body the outfit was drawn against | RED |
| W5 | the search starts low enough to contain the waist | RED |
| W6 | and build.py cannot go back to the fixed band while keeping WAIST_SEARCH beside it | RED |
| W7 | nor to the fixed slab | RED |
| W8 | the waist is the narrowest slice of the mesh, not a fraction of the skeleton | RED |
| S1 | the joints move with the body | RED |
| S2 | a morph delta is a difference of two positions, so it scales like one | RED |
| S3 | the inverse bind matrices carry the scaled offset, so skinning still resolves | RED |
| S4 | and only their translation column, so their rotation survives | RED |
| S5 | the spring colliders' own radii are lengths too | RED |
| S6 | a VRM 1.0 body is refused rather than scaled with its 1.0 spring block left behind | RED |
| S7 | skin weights are not lengths and are left alone | RED |
| S8 | the declared min/max follows the data three.js culls against | RED |
| S9 | an accessor two primitives share is scaled once, not once per primitive | RED |

### W1
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size
test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size) ... ERROR
======================================================================
ERROR: test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 99, in test_the_waist_is_found_on_a_body_of_any_size
    got = build.landmarks(grown, scaled)
  File "/Users/charles/portfolio/scripts/avatar/build.py", line 624, in landmarks
    raise SystemExit(
        '在 hips 與 shoulder 之間找不到任何有足夠頂點的水平切片，量不出腰線')
SystemExit: 在 hips 與 shoulder 之間找不到任何有足夠頂點的水平切片，量不出腰線
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (errors=1)
```

### W2
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size
test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size) ... FAIL
======================================================================
FAIL: test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 102, in test_the_waist_is_found_on_a_body_of_any_size
    self.assertAlmostEqual(got[key] / k, base[key], places=9,
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                           msg=f'{key} at x{k}')
                           ^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.13) != np.float64(0.125) within 9 places (np.float64(0.0050000000000000044) difference) : waist_r at x0.5
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

### W3
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size
test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size) ... FAIL
======================================================================
FAIL: test_the_waist_is_found_on_a_body_of_any_size (build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 102, in test_the_waist_is_found_on_a_body_of_any_size
    self.assertAlmostEqual(got[key] / k, base[key], places=9,
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                           msg=f'{key} at x{k}')
                           ^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.9035154939839999) != np.float64(0.9017573798920004) within 9 places (np.float64(0.001758114091999441) difference) : waist at x0.5
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (failures=1)
```

### W4
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_joint_heights_come_from_the_skeleton
test_joint_heights_come_from_the_skeleton (build_test.Landmarks.test_joint_heights_come_from_the_skeleton) ... FAIL
======================================================================
FAIL: test_joint_heights_come_from_the_skeleton (build_test.Landmarks.test_joint_heights_come_from_the_skeleton)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 65, in test_joint_heights_come_from_the_skeleton
    self.assertAlmostEqual(lm['waist'], WAIST_AT, delta=0.011)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.8820876000000001) != 0.9 within 0.011 delta (np.float64(0.01791239999999994) difference)
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### W5
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_joint_heights_come_from_the_skeleton
test_joint_heights_come_from_the_skeleton (build_test.Landmarks.test_joint_heights_come_from_the_skeleton) ... FAIL
======================================================================
FAIL: test_joint_heights_come_from_the_skeleton (build_test.Landmarks.test_joint_heights_come_from_the_skeleton)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 65, in test_joint_heights_come_from_the_skeleton
    self.assertAlmostEqual(lm['waist'], WAIST_AT, delta=0.011)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(1.0) != 0.9 within 0.011 delta (np.float64(0.09999999999999998) difference)
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### W6
```
$ python3 -W ignore -m unittest -v build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span
test_the_waist_is_searched_for_on_the_bodys_own_span (build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span) ... FAIL
======================================================================
FAIL: test_the_waist_is_searched_for_on_the_bodys_own_span (build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 167, in test_the_waist_is_searched_for_on_the_bodys_own_span
    self.assertRegex(src, r"np\.arange\(hips_y \+ span \* w\['from'\], hips_y \+ span \* w\['to'\]")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: "np\\.arange\\(hips_y \\+ span \\* w\\['from'\\], hips_y \\+ span \\* w\\['to'\\]" not found in '"""Build the Milfy-referenced outfit onto the partitioned base.\n\nEvery measurement here is a fraction of this body\'s own landmarks, read out of\nthe file rather than typed as a world coordinate: the waist is where the torso\nis narrowest, the hem sits between hip and knee. Hard-coding heights would make\nthe script correct for exactly one body, and the point of a template is that the\nnext body gets the same garment without a rewrite.\n\nColour lives in PALETTE and nowhere else. Each entry becomes one flat MToon\nmaterial, which is what makes "change one material, change the whole colourway"\ntrue rather than aspirational.\n"""\nimport io\nimport json\nimport math\nimport os\nimp
```

### W7
```
$ python3 -W ignore -m unittest -v build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span
test_the_waist_is_searched_for_on_the_bodys_own_span (build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span) ... FAIL
======================================================================
FAIL: test_the_waist_is_searched_for_on_the_bodys_own_span (build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 168, in test_the_waist_is_searched_for_on_the_bodys_own_span
    self.assertRegex(src, r"np\.abs\(p\[:, 1\] - y\) < span \* w\['slab'\]")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: "np\\.abs\\(p\\[:, 1\\] - y\\) < span \\* w\\['slab'\\]" not found in '"""Build the Milfy-referenced outfit onto the partitioned base.\n\nEvery measurement here is a fraction of this body\'s own landmarks, read out of\nthe file rather than typed as a world coordinate: the waist is where the torso\nis narrowest, the hem sits between hip and knee. Hard-coding heights would make\nthe script correct for exactly one body, and the point of a template is that the\nnext body gets the same garment without a rewrite.\n\nColour lives in PALETTE and nowhere else. Each entry becomes one flat MToon\nmaterial, which is what makes "change one material, change the whole colourway"\ntrue rather than aspirational.\n"""\nimport io\nimport json\nimport math\nimport os\nimport sys\n\nimport numpy as np\nfrom PIL import Image\nfrom scipy.spatial i
```

### W8
```
$ python3 -W ignore -m unittest -v build_test.Landmarks.test_a_taller_body_moves_every_joint_landmark_and_not_the_waist
test_a_taller_body_moves_every_joint_landmark_and_not_the_waist (build_test.Landmarks.test_a_taller_body_moves_every_joint_landmark_and_not_the_waist) ... ERROR
======================================================================
ERROR: test_a_taller_body_moves_every_joint_landmark_and_not_the_waist (build_test.Landmarks.test_a_taller_body_moves_every_joint_landmark_and_not_the_waist)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 71, in test_a_taller_body_moves_every_joint_landmark_and_not_the_waist
    a, b = build.landmarks(pool, doc), build.landmarks(pool, taller)
           ~~~~~~~~~~~~~~~^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/build.py", line 633, in landmarks
    'waist_r': dict(torso)[waist_y],
               ~~~~~~~~~~~^^^^^^^^^
KeyError: 0.8972000000000001
----------------------------------------------------------------------
Ran 1 test in 0.002s
FAILED (errors=1)
```

### S1
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_every_length_scales
test_every_length_scales (scalebody_test.Similarity.test_every_length_scales) ... FAIL
======================================================================
FAIL: test_every_length_scales (scalebody_test.Similarity.test_every_length_scales)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 96, in test_every_length_scales
    self.assertAlmostEqual(got[axis], node['translation'][axis] * self.K,
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                           places=9, msg=f'node {i} axis {axis}')
                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.8 != 1.0 within 9 places (0.19999999999999996 difference) : node 0 axis 1
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### S2
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_every_length_scales
test_every_length_scales (scalebody_test.Similarity.test_every_length_scales) ... FAIL
======================================================================
FAIL: test_every_length_scales (scalebody_test.Similarity.test_every_length_scales)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 106, in test_every_length_scales
    np.testing.assert_allclose(glb.read_accessor(self.b, self.bv, tgt),
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                               glb.read_accessor(self.a, self.av, tgt) * self.K,
                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                               rtol=0, atol=1e-6)
                               ^^^^^^^^^^^^^^^^^^
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
Not equal to tolerance rtol=0, atol=1e-06
Mismatched elements: 3 / 9 (33.3%)

```

### S3
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset
test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset (scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset) ... FAIL
======================================================================
FAIL: test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset (scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 126, in test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset
    np.testing.assert_allclose(after[:, 12:15], before[:, 12:15] * self.K,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                               rtol=0, atol=1e-6)
                               ^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 1768, in assert_allclose
    assert_array_compare(compare, actual, desired, err_msg=str(err_msg),
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header=header, equal_nan=equal_nan,
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
Asser
```

### S4
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset
test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset (scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset) ... FAIL
======================================================================
FAIL: test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset (scalebody_test.Similarity.test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 129, in test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset
    np.testing.assert_allclose(after[:, rest], before[:, rest], rtol=0, atol=0)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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
Not equal to tolerance rtol=0, atol=0
Mismatched elements: 8 / 26 (30.8%)
Firs
```

### S5
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_every_length_scales
test_every_length_scales (scalebody_test.Similarity.test_every_length_scales) ... FAIL
======================================================================
FAIL: test_every_length_scales (scalebody_test.Similarity.test_every_length_scales)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 112, in test_every_length_scales
    self.assertAlmostEqual(collider['radius'], 0.08 * self.K, places=9)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.08 != 0.1 within 9 places (0.020000000000000004 difference)
----------------------------------------------------------------------
Ran 1 test in 0.010s
FAILED (failures=1)
```

### S6
```
$ python3 -W ignore -m unittest -v scalebody_test.Refusals.test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through
test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through (scalebody_test.Refusals.test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through) ... FAIL
======================================================================
FAIL: test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through (scalebody_test.Refusals.test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 189, in test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through
    with self.assertRaises(SystemExit) as caught:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: SystemExit not raised
----------------------------------------------------------------------
Ran 1 test in 0.001s
FAILED (failures=1)
```

### S7
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_what_is_not_a_length_is_left_alone
test_what_is_not_a_length_is_left_alone (scalebody_test.Similarity.test_what_is_not_a_length_is_left_alone) ... FAIL
======================================================================
FAIL: test_what_is_not_a_length_is_left_alone (scalebody_test.Similarity.test_what_is_not_a_length_is_left_alone)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 139, in test_what_is_not_a_length_is_left_alone
    np.testing.assert_array_equal(glb.read_accessor(self.b, self.bv, acc),
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  glb.read_accessor(self.a, self.av, acc))
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 1121, in assert_array_equal
    assert_array_compare(operator.__eq__, actual, desired, err_msg=err_msg,
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header='Arrays are not equal',
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 983, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Arrays are not equal
Mismatched elements: 6 / 12 (50%)
First 5 mismatches are at indices:
 [0, 0]: 0.9375 (AC
```

### S8
```
$ python3 -W ignore -m unittest -v scalebody_test.Similarity.test_the_declared_minmax_follows_the_data
test_the_declared_minmax_follows_the_data (scalebody_test.Similarity.test_the_declared_minmax_follows_the_data) ... FAIL
======================================================================
FAIL: test_the_declared_minmax_follows_the_data (scalebody_test.Similarity.test_the_declared_minmax_follows_the_data)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 169, in test_the_declared_minmax_follows_the_data
    np.testing.assert_allclose(self.b['accessors'][acc]['min'],
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                               data.min(axis=0), rtol=0, atol=1e-6)
                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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
Not equal to tolerance rtol=0, atol=1e-06
Mismatched elements: 2 / 3 (66.7%)
Mismatch at indices:
 [0]: -0.10000000149011612 (ACTUAL),
```

### S9
```
$ python3 -W ignore -m unittest -v scalebody_test.OnTheRealBody.test_the_shipped_body_comes_out_exactly_k_times_as_tall
test_the_shipped_body_comes_out_exactly_k_times_as_tall (scalebody_test.OnTheRealBody.test_the_shipped_body_comes_out_exactly_k_times_as_tall) ... FAIL
======================================================================
FAIL: test_the_shipped_body_comes_out_exactly_k_times_as_tall (scalebody_test.OnTheRealBody.test_the_shipped_body_comes_out_exactly_k_times_as_tall)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/scalebody_test.py", line 208, in test_the_shipped_body_comes_out_exactly_k_times_as_tall
    self.assertAlmostEqual((shi - slo) / (hi - lo), k, places=6, msg=f'x{k}')
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.20037293700871825 != 0.8 within 6 places (0.5996270629912818 difference) : x0.8
----------------------------------------------------------------------
Ran 1 test in 0.055s
FAILED (failures=1)
```

