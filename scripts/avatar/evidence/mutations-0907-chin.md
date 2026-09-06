H1 RED  restored=True
H2 RED  restored=True
H3 RED  restored=True
H4 RED  restored=True
H5 RED  restored=True
H6 RED  restored=True

| # | guard | result |
|---|---|---|
| H1 | the fraction is the one measured on the body the head factor was chosen against, to 0.1mm | RED |
| H2 | the cut is that fraction OF THE BAND above the neck joint, not a fraction of a metre | RED |
| H3 | the band reaches up to the lowest HEAD-owned vertex; every vertex would put it near the floor, below the neck joint | RED |
| H4 | the band starts at this body's neck joint, so a longer neck carries the cut with it | RED |
| H5 | apply() derives the cut rather than typing the old height in beside the derivation | RED |
| H6 | the shipped face really is the input face grown about that cut (the receipt that the cut is used at all) | RED |

### H1
```
$ python3 -W ignore -m unittest -v proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in
test_the_cut_lands_where_it_was_typed_in (proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in) ... FAIL
======================================================================
FAIL: test_the_cut_lands_where_it_was_typed_in (proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 70, in test_the_cut_lands_where_it_was_typed_in
    self.assertAlmostEqual(proportion.chin_height(doc, views), 1.272, delta=0.0001)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1.2685452089409424 != 1.272 within 0.0001 delta (0.0034547910590576603 difference)
----------------------------------------------------------------------
Ran 1 test in 0.017s
FAILED (failures=1)
```

### H2
```
$ python3 -W ignore -m unittest -v proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in
test_the_cut_lands_where_it_was_typed_in (proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in) ... FAIL
======================================================================
FAIL: test_the_cut_lands_where_it_was_typed_in (proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 70, in test_the_cut_lands_where_it_was_typed_in
    self.assertAlmostEqual(proportion.chin_height(doc, views), 1.272, delta=0.0001)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1.8418337002 != 1.272 within 0.0001 delta (0.5698337002 difference)
----------------------------------------------------------------------
Ran 1 test in 0.004s
FAILED (failures=1)
```

### H3
```
$ python3 -W ignore -m unittest -v proportion_test.ChinTest.test_the_cut_clears_the_head_and_the_neck_joint
test_the_cut_clears_the_head_and_the_neck_joint (proportion_test.ChinTest.test_the_cut_clears_the_head_and_the_neck_joint) ... FAIL
======================================================================
FAIL: test_the_cut_clears_the_head_and_the_neck_joint (proportion_test.ChinTest.test_the_cut_clears_the_head_and_the_neck_joint)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 81, in test_the_cut_clears_the_head_and_the_neck_joint
    self.assertGreater(chin, float(world[bones['neck']][:3, 3][1]))
    ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.5102414990871793 not greater than 1.2498337002
----------------------------------------------------------------------
Ran 1 test in 0.007s
FAILED (failures=1)
```

### H4
```
$ python3 -W ignore -m unittest -v proportion_test.ChinTest.test_a_longer_neck_carries_the_cut_up_with_it
test_a_longer_neck_carries_the_cut_up_with_it (proportion_test.ChinTest.test_a_longer_neck_carries_the_cut_up_with_it) ... FAIL
======================================================================
FAIL: test_a_longer_neck_carries_the_cut_up_with_it (proportion_test.ChinTest.test_a_longer_neck_carries_the_cut_up_with_it)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 99, in test_a_longer_neck_carries_the_cut_up_with_it
    self.assertAlmostEqual(after - before, 0.05 * (1 - proportion.CHIN_FRACTION), places=6)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.0 != 0.0204 within 6 places (0.0204 difference)
----------------------------------------------------------------------
Ran 1 test in 0.005s
FAILED (failures=1)
```

### H5
```
$ python3 -W ignore -m unittest -v proportion_test.WiringTest.test_the_entry_points_derive_the_cut
test_the_entry_points_derive_the_cut (proportion_test.WiringTest.test_the_entry_points_derive_the_cut) ... FAIL
======================================================================
FAIL: test_the_entry_points_derive_the_cut (proportion_test.WiringTest.test_the_entry_points_derive_the_cut)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 109, in test_the_entry_points_derive_the_cut
    self.assertEqual(src.count('        chin = chin_height(doc, views)'), 2,
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     'apply() and ratio() each derive the cut when none is given')
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1 != 2 : apply() and ratio() each derive the cut when none is given
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### H6
```
$ python3 -W ignore -m unittest -v proportion_test.ShippedFaceTest.test_face_is_the_input_face_scaled_by_head_factor
test_face_is_the_input_face_scaled_by_head_factor (proportion_test.ShippedFaceTest.test_face_is_the_input_face_scaled_by_head_factor) ... FAIL
======================================================================
FAIL: test_face_is_the_input_face_scaled_by_head_factor (proportion_test.ShippedFaceTest.test_face_is_the_input_face_scaled_by_head_factor)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/proportion_test.py", line 129, in test_face_is_the_input_face_scaled_by_head_factor
    np.testing.assert_allclose(self.pos_out, expect, atol=1e-4)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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
Not equal to tolerance rtol=1e-07, atol=0.0001
Mismatched elements: 2054 / 6162 (33.3%)
First 5 mismatches are at indices:
 [0, 1]: 1.3281043767929077 (ACTUAL), 1.324928641319275 (DESIRED)
 [1, 1]: 1.3318064212799072 
```

