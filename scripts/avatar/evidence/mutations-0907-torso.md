B1 RED  restored=True
B2 RED  restored=True
B3 RED  restored=True
B4 RED  restored=True
B5 RED  restored=True
B6 RED  restored=True

| # | guard | result |
|---|---|---|
| B1 | build() cuts the bandeau at the derived edge, not at the height it used to type in | RED |
| B2 | and the straps at the derived edge and the neck joint | RED |
| B3 | and the sleeve at the derived edge | RED |
| B4 | the fractions are the ones measured on the body the outfit was drawn against, to 0.1mm | RED |
| B5 | an edge is a fraction OF THE SPAN above the waist, not a fraction of a metre | RED |
| B6 | the span is waist-to-shoulder, so a body that is taller only below the waist does not move the edges | RED |

### B1
```
$ python3 -W ignore -m unittest -v build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions
test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions) ... FAIL
======================================================================
FAIL: test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 130, in test_build_cuts_the_torso_edges_at_the_derived_fractions
    self.assertRegex(src, r"edge\['%s'\]" % name)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: "edge\\['bandeau_top'\\]" not found in '"""Build the Milfy-referenced outfit onto the partitioned base.\n\nEvery measurement here is a fraction of this body\'s own landmarks, read out of\nthe file rather than typed as a world coordinate: the waist is where the torso\nis narrowest, the hem sits between hip and knee. Hard-coding heights would make\nthe script correct for exactly one body, and the point of a template is that the\nnext body gets the same garment without a rewrite.\n\nColour lives in PALETTE and nowhere else. Each entry becomes one flat MToon\nmaterial, which is what makes "change one material, change the whole colourway"\ntrue rather than aspirational.\n"""\nimport io\nimport json\nimport math\nimport os\nimport sys\n\nimport numpy as np\nfrom PIL import Image\nfrom scipy.spatial import cKDTree\n\nimport customise\nimport envelope\nimport bindin
```

### B2
```
$ python3 -W ignore -m unittest -v build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions
test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions) ... FAIL
======================================================================
FAIL: test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 130, in test_build_cuts_the_torso_edges_at_the_derived_fractions
    self.assertRegex(src, r"edge\['%s'\]" % name)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: "edge\\['strap_bottom'\\]" not found in '"""Build the Milfy-referenced outfit onto the partitioned base.\n\nEvery measurement here is a fraction of this body\'s own landmarks, read out of\nthe file rather than typed as a world coordinate: the waist is where the torso\nis narrowest, the hem sits between hip and knee. Hard-coding heights would make\nthe script correct for exactly one body, and the point of a template is that the\nnext body gets the same garment without a rewrite.\n\nColour lives in PALETTE and nowhere else. Each entry becomes one flat MToon\nmaterial, which is what makes "change one material, change the whole colourway"\ntrue rather than aspirational.\n"""\nimport io\nimport json\nimport math\nimport os\nimport sys\n\nimport numpy as np\nfrom PIL import Image\nfrom scipy.spatial import cKDTree\n\nimport customise\nimport envelope\nimport bindi
```

### B3
```
$ python3 -W ignore -m unittest -v build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions
test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions) ... FAIL
======================================================================
FAIL: test_build_cuts_the_torso_edges_at_the_derived_fractions (build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 130, in test_build_cuts_the_torso_edges_at_the_derived_fractions
    self.assertRegex(src, r"edge\['%s'\]" % name)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Regex didn't match: "edge\\['sleeve_bottom'\\]" not found in '"""Build the Milfy-referenced outfit onto the partitioned base.\n\nEvery measurement here is a fraction of this body\'s own landmarks, read out of\nthe file rather than typed as a world coordinate: the waist is where the torso\nis narrowest, the hem sits between hip and knee. Hard-coding heights would make\nthe script correct for exactly one body, and the point of a template is that the\nnext body gets the same garment without a rewrite.\n\nColour lives in PALETTE and nowhere else. Each entry becomes one flat MToon\nmaterial, which is what makes "change one material, change the whole colourway"\ntrue rather than aspirational.\n"""\nimport io\nimport json\nimport math\nimport os\nimport sys\n\nimport numpy as np\nfrom PIL import Image\nfrom scipy.spatial import cKDTree\n\nimport customise\nimport envelope\nimport bind
```

### B4
```
$ python3 -W ignore -m unittest -v build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn
test_the_edges_land_where_the_outfit_was_drawn (build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn) ... FAIL
======================================================================
FAIL: test_the_edges_land_where_the_outfit_was_drawn (build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 84, in test_the_edges_land_where_the_outfit_was_drawn
    self.assertAlmostEqual(got[name], y, delta=0.0001, msg=name)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1.1895999000000002 != 1.181 within 0.0001 delta (0.008599900000000105 difference) : bandeau_top
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### B5
```
$ python3 -W ignore -m unittest -v build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn
test_the_edges_land_where_the_outfit_was_drawn (build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn) ... FAIL
======================================================================
FAIL: test_the_edges_land_where_the_outfit_was_drawn (build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 84, in test_the_edges_land_where_the_outfit_was_drawn
    self.assertAlmostEqual(got[name], y, delta=0.0001, msg=name)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1.826 != 1.181 within 0.0001 delta (0.645 difference) : bandeau_top
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### B6
```
$ python3 -W ignore -m unittest -v build_test.TorsoEdges.test_a_longer_torso_moves_every_edge
test_a_longer_torso_moves_every_edge (build_test.TorsoEdges.test_a_longer_torso_moves_every_edge) ... FAIL
======================================================================
FAIL: test_a_longer_torso_moves_every_edge (build_test.TorsoEdges.test_a_longer_torso_moves_every_edge)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/build_test.py", line 108, in test_a_longer_torso_moves_every_edge
    self.assertAlmostEqual(c[name] - a[name], 0.05, places=9, msg=name)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.09330000000000016 != 0.05 within 9 places (0.04330000000000016 difference) : bandeau_top
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

