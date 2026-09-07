W1 RED  restored=True
W2 RED  restored=True
W3 RED  restored=True
W4 RED  restored=True
W5 RED  restored=True
W6 RED  restored=True
W7 RED  restored=True
W8 RED  restored=True

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
Ran 1 test in 0.003s
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
Ran 1 test in 0.003s
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

