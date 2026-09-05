# mutations-0905-humanoid：Phase 0 十七道守衛的 mutation 輸出

由 session scratch 的 mutate_phase0.py 產生：每道 byte copy 原檔 → 字串替換（命中數必須恰為 1）→ 跑該守衛的單一測試 → byte copy 還原 → 還原後 sha256 必須等於原檔。M1–M9 為第一輪（13:10）；M10–M16 為 diff reviewer 指出無收據的守衛與 readExpressions 補上後的第二輪；M17 為 spec reviewer 指出 vrmrig.py 標頭對 vrm_version 的收據宣稱不實後補的。M16 第一次跑是 GREEN（registry 測試只比相等，全部空也相等），加上 reference 必含 Blink／A 的斷言後才 RED；兩次輸出都留著。

## 第一輪 M1–M9

M1 RED  restored=True
M2 RED  restored=True
M3 RED  restored=True
M4 RED  restored=True
M5 RED  restored=True
M6 RED  restored=True
M7 RED  restored=True
M8 RED  restored=True
M9 RED  restored=True

| # | guard | result |
|---|---|---|
| M1 | vrmrig.human_bones reads the VRM 1.0 map | RED |
| M2 | humanoid.body_skin resolves the body skin through the manifest, not skins[0] | RED |
| M3 | vrmrig.forward_z flips with the version | RED |
| M4 | wiring: an inline humanBones read anywhere in scripts/avatar is caught | RED |
| M5 | readHumanoid reads the VRM 1.0 map (rigProbe.buildRig on a 1.0 twin of the shipped body) | RED |
| M6 | parseGlb honours 4-byte chunk padding | RED |
| M7 | readAccessorRows honours byteStride | RED |
| M8 | readAccessorRows de-normalizes integer accessors | RED |
| M9 | wiring: an inline humanBones read anywhere in src/ or scripts/ is caught | RED |

### M1
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_a_vrm1_map_reads_the_same_bones_as_its_vrm0_twin
======================================================================
FAIL: test_a_vrm1_map_reads_the_same_bones_as_its_vrm0_twin (scripts.avatar.vrmrig_test.Versions.test_a_vrm1_map_reads_the_same_bones_as_its_vrm0_twin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 125, in test_a_vrm1_map_reads_the_same_bones_as_its_vrm0_twin
    self.assertEqual(vrmrig.human_bones(v1), vrmrig.human_bones(v0))
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {} != {'hips': 0, 'spine': 1}
- {}
+ {'hips': 0, 'spine': 1}
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M2
```
$ python3 -m unittest -q scripts.avatar.humanoid_test.Facade.test_body_skin_comes_from_the_manifest_not_skins_0
======================================================================
FAIL: test_body_skin_comes_from_the_manifest_not_skins_0 (scripts.avatar.humanoid_test.Facade.test_body_skin_comes_from_the_manifest_not_skins_0)
VRoid puts the body on skin 1. skins[0] is the face's, which lists the
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 63, in test_body_skin_comes_from_the_manifest_not_skins_0
    self.assertEqual(humanoid.body_skin(doc, MANIFEST), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 != 1
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M3
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_vrm1_faces_plus_z_and_vrm0_faces_minus_z
======================================================================
FAIL: test_vrm1_faces_plus_z_and_vrm0_faces_minus_z (scripts.avatar.vrmrig_test.Versions.test_vrm1_faces_plus_z_and_vrm0_faces_minus_z)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 135, in test_vrm1_faces_plus_z_and_vrm0_faces_minus_z
    self.assertEqual(vrmrig.forward_z(gltf(self.NODES, self.BONES, version='1')), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: -1 != 1
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M4
```
$ python3 -m unittest -q scripts.avatar.humanoid_test.Wiring.test_no_module_reads_the_humanoid_map_inline
======================================================================
FAIL: test_no_module_reads_the_humanoid_map_inline (scripts.avatar.humanoid_test.Wiring.test_no_module_reads_the_humanoid_map_inline)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 122, in test_no_module_reads_the_humanoid_map_inline
    self.assertEqual(offenders, [], f'這些檔案自己讀 humanBones，沒走 humanoid.py：{offenders}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['pose.py'] != []
First list contains 1 additional elements.
First extra element 0:
'pose.py'
- ['pose.py']
+ [] : 這些檔案自己讀 humanBones，沒走 humanoid.py：['pose.py']
----------------------------------------------------------------------
Ran 1 test in 0.009s
FAILED (failures=1)
```

### M5
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/rigProbe.test.ts -t VRM 1.0 twin
est > scratchHead settles slower than the fade it replaced
   ↓ returning to rest > idleLoop settles slower than the fade it replaced
   ↓ returning to rest > stretch settles slower than the fade it replaced
   ↓ returning to rest > dance settles slower than the fade it replaced
   ↓ returning to rest > has at least one clip that the distance scaling actually lengthens
 Test Files  1 failed (1)
      Tests  1 failed | 109 skipped (110)
   Start at  13:10:06
   Duration  498ms (transform 60ms, setup 37ms, collect 84ms, tests 9ms, environment 259ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
Error: not a VRM: neither extensions.VRM (0.x) nor extensions.VRMC_vrm (1.0) is present
 ❯ readHumanoid src/components/chat/vrmHumanoid.ts:266:9
    264|     return { version: '0', bones, forwardZ: -1 }
    265|   }
    266|   throw new Error('not a VRM: neither extensions.VRM (0.x) nor extensi…
       |         ^
    267| }
    268| 
 ❯ buildRig src/components/chat/rigProbe.ts:109:20
 ❯ src/components/chat/rigProbe.test.ts:169:15
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M6
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/vrmHumanoid.test.ts -t not a multiple of four
 chunk behind a JSON chunk whose length is not a multiple of four 4ms
     → expected null to deeply equal [ 1, 2, 3, 4, 5, 6, 7, 8 ]
   ↓ parseGlb / readAccessorRows > de-strides and de-normalizes an accessor
   ↓ wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  13:10:07
   Duration  288ms (transform 24ms, setup 23ms, collect 20ms, tests 4ms, environment 142ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > parseGlb / readAccessorRows > finds the BIN chunk behind a JSON chunk whose length is not a multiple of four
AssertionError: expected null to deeply equal [ 1, 2, 3, 4, 5, 6, 7, 8 ]
- Expected: 
[
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
]
+ Received: 
null
 ❯ src/components/chat/vrmHumanoid.test.ts:128:50
    126|     const bin = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    127|     const parsed = parseGlb(glb(json, bin))
    128|     expect(parsed.bin && Array.from(parsed.bin)).toEqual(Array.from(bi…
       |                                                  ^
    129|   })
    130| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M7
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/vrmHumanoid.test.ts -t de-strides
 / readAccessorRows > de-strides and de-normalizes an accessor 4ms
     → expected [ 1, +0, 0.03529411764705882, …(1) ] to deeply equal [ 1, +0, +0, 1 ]
   ↓ wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  13:10:07
   Duration  292ms (transform 25ms, setup 23ms, collect 20ms, tests 5ms, environment 141ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > parseGlb / readAccessorRows > de-strides and de-normalizes an accessor
AssertionError: expected [ 1, +0, 0.03529411764705882, …(1) ] to deeply equal [ 1, +0, +0, 1 ]
- Expected
+ Received
  [
    1,
    0,
-   0,
-   1,
+   0.03529411764705882,
+   0.03529411764705882,
  ]
 ❯ src/components/chat/vrmHumanoid.test.ts:141:35
    139|     const rows = readAccessorRows(parseGlb(glb(json, bin)), 0)
    140|     expect(rows.ncomp).toBe(2)
    141|     expect(Array.from(rows.data)).toEqual([1, 0, 0, 1])
       |                                   ^
    142|   })
    143| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M8
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/vrmHumanoid.test.ts -t de-strides
 JSON chunk whose length is not a multiple of four
   × parseGlb / readAccessorRows > de-strides and de-normalizes an accessor 4ms
     → expected [ 255, +0, +0, 255 ] to deeply equal [ 1, +0, +0, 1 ]
   ↓ wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  13:10:08
   Duration  293ms (transform 25ms, setup 23ms, collect 24ms, tests 5ms, environment 141ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > parseGlb / readAccessorRows > de-strides and de-normalizes an accessor
AssertionError: expected [ 255, +0, +0, 255 ] to deeply equal [ 1, +0, +0, 1 ]
- Expected
+ Received
  [
-   1,
+   255,
    0,
    0,
-   1,
+   255,
  ]
 ❯ src/components/chat/vrmHumanoid.test.ts:141:35
    139|     const rows = readAccessorRows(parseGlb(glb(json, bin)), 0)
    140|     expect(rows.ncomp).toBe(2)
    141|     expect(Array.from(rows.data)).toEqual([1, 0, 0, 1])
       |                                   ^
    142|   })
    143| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M9
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/vrmHumanoid.test.ts -t wiring
d map inline 37ms
     → these files read humanBones themselves instead of through vrmHumanoid.ts: scripts/avatar/springsim.ts: expected [ 'scripts/avatar/springsim.ts' ] to deeply equal []
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  13:10:09
   Duration  321ms (transform 24ms, setup 23ms, collect 17ms, tests 38ms, environment 141ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
AssertionError: these files read humanBones themselves instead of through vrmHumanoid.ts: scripts/avatar/springsim.ts: expected [ 'scripts/avatar/springsim.ts' ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "scripts/avatar/springsim.ts",
+ ]
 ❯ src/components/chat/vrmHumanoid.test.ts:170:124
    168|       }
    169|     }
    170|     expect(offenders, `these files read humanBones themselves instead …
       |                                                                                                                            ^
    171|   })
    172| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```


## 第二輪 M10–M16（M16 第一次，GREEN）

M10 RED  restored=True
M11 RED  restored=True
M12 RED  restored=True
M13 RED  restored=True
M14 RED  restored=True
M15 RED  restored=True
M16 GREEN (mutation NOT caught)  restored=True

| # | guard | result |
|---|---|---|
| M10 | vrmrig.spring_bones reads the VRM 1.0 VRMC_springBone block | RED |
| M11 | vrmrig.expression_names reads VRM 1.0 preset+custom expressions | RED |
| M12 | vrmrig.required_missing names the spec-required bones a file lacks | RED |
| M13 | wiring: any spelling of the ~/vtuber-kit path in scripts/**/*.py is caught | RED |
| M14 | wiring: a direct `import vrmrig` outside humanoid.py is caught | RED |
| M15 | readExpressions reads VRM 1.0 expressions and refuses a file with neither extension | RED |
| M16 | avatarVariants registry test reads expressions through readExpressions (a reader returning [] for 0.x must not pass) | GREEN (mutation NOT caught) |

### M10
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_springs_read_from_either_version_in_one_shape
======================================================================
FAIL: test_springs_read_from_either_version_in_one_shape (scripts.avatar.vrmrig_test.Versions.test_springs_read_from_either_version_in_one_shape)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 183, in test_springs_read_from_either_version_in_one_shape
    self.assertEqual(len(s['groups']), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 != 1
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M11
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_expressions_read_from_either_version
======================================================================
FAIL: test_expressions_read_from_either_version (scripts.avatar.vrmrig_test.Versions.test_expressions_read_from_either_version)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 164, in test_expressions_read_from_either_version
    self.assertEqual(vrmrig.expression_names(v1), ['blink', 'aa', 'wink'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: [] != ['blink', 'aa', 'wink']
Second list contains 3 additional elements.
First extra element 0:
'blink'
- []
+ ['blink', 'aa', 'wink']
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M12
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_required_bones_are_named_when_missing
======================================================================
FAIL: test_required_bones_are_named_when_missing (scripts.avatar.vrmrig_test.Versions.test_required_bones_are_named_when_missing)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 151, in test_required_bones_are_named_when_missing
    self.assertIn('head', missing)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^
AssertionError: 'head' not found in []
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### M13
```
$ python3 -m unittest -q scripts.avatar.humanoid_test.Wiring.test_no_module_hardcodes_the_kit_path
======================================================================
FAIL: test_no_module_hardcodes_the_kit_path (scripts.avatar.humanoid_test.Wiring.test_no_module_hardcodes_the_kit_path)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 136, in test_no_module_hardcodes_the_kit_path
    self.assertEqual(offenders, [], f'這些檔案寫死 ~/vtuber-kit 路徑：{offenders}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['avatar/make.py'] != []
First list contains 1 additional elements.
First extra element 0:
'avatar/make.py'
- ['avatar/make.py']
+ [] : 這些檔案寫死 ~/vtuber-kit 路徑：['avatar/make.py']
----------------------------------------------------------------------
Ran 1 test in 0.008s
FAILED (failures=1)
```

### M14
```
$ python3 -m unittest -q scripts.avatar.humanoid_test.Wiring.test_no_module_imports_vrmrig_directly
======================================================================
FAIL: test_no_module_imports_vrmrig_directly (scripts.avatar.humanoid_test.Wiring.test_no_module_imports_vrmrig_directly)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/humanoid_test.py", line 132, in test_no_module_imports_vrmrig_directly
    self.assertEqual(offenders, [], f'這些檔案直接 import vrmrig，沒走 humanoid.py：{offenders}')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Lists differ: ['avatar/pose.py'] != []
First list contains 1 additional elements.
First extra element 0:
'avatar/pose.py'
- ['avatar/pose.py']
+ [] : 這些檔案直接 import vrmrig，沒走 humanoid.py：['avatar/pose.py']
----------------------------------------------------------------------
Ran 1 test in 0.006s
FAILED (failures=1)
```

### M15
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/vrmHumanoid.test.ts -t expression names
rseGlb / readAccessorRows > de-strides and de-normalizes an accessor
   ↓ wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
 Test Files  1 failed (1)
      Tests  1 failed | 12 skipped (13)
   Start at  13:26:55
   Duration  459ms (transform 32ms, setup 46ms, collect 22ms, tests 5ms, environment 273ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > readHumanoid > reads expression names from either version and refuses a file with neither
AssertionError: expected [] to deeply equal [ 'blink', 'aa', 'wink' ]
- Expected
+ Received
- [
-   "blink",
-   "aa",
-   "wink",
- ]
+ []
 ❯ src/components/chat/vrmHumanoid.test.ts:85:33
     83|     const v1 = doc('1')
     84|     v1.extensions!.VRMC_vrm!.expressions = { preset: { blink: {}, aa: …
     85|     expect(readExpressions(v1)).toEqual(['blink', 'aa', 'wink'])
       |                                 ^
     86|     // A body with no expressions at all must not read as "the same na…
     87|     // every other body": that is exactly the silent no-op the registr…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M16
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/avatarVariants.test.ts -t same expression names
 RUN  v3.2.6 /Users/charles/portfolio
 ✓ src/components/chat/avatarVariants.test.ts (8 tests | 7 skipped) 24ms
 Test Files  1 passed (1)
      Tests  1 passed | 7 skipped (8)
   Start at  13:26:56
   Duration  315ms (transform 25ms, setup 23ms, collect 24ms, tests 24ms, environment 146ms, prepare 24ms)
```


## M16 第二次（registry 測試加 toContain 後）

M16 RED  restored=True

| # | guard | result |
|---|---|---|
| M16 | avatarVariants registry test reads expressions through readExpressions (a reader returning [] for 0.x must not pass) | RED |

### M16
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/avatarVariants.test.ts -t same expression names
 the default
   ↓ avatar variants > declares only files that are actually served
   ↓ avatar variants > gives every variant its own id
   ↓ avatar variants > gives every variant its own url
   ↓ avatar variants > gives every variant the same rig
   × avatar variants > gives every variant the same expression names 5ms
     → expected [] to include 'Blink'
   ↓ avatar variants > loads the resolved variant rather than a constant of its own
 Test Files  1 failed (1)
      Tests  1 failed | 7 skipped (8)
   Start at  13:27:28
   Duration  426ms (transform 31ms, setup 34ms, collect 24ms, tests 6ms, environment 250ms, prepare 31ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/avatarVariants.test.ts > avatar variants > gives every variant the same expression names
AssertionError: expected [] to include 'Blink'
 ❯ src/components/chat/avatarVariants.test.ts:117:23
    115|     const [first, ...rest] = AVATAR_VARIANTS
    116|     const reference = readExpressions(gltfOf(first.url))
    117|     expect(reference).toContain('Blink')
       |                       ^
    118|     expect(reference).toContain('A')
    119|     for (const other of rest) {
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```


## M17

M17 RED  restored=True

| # | guard | result |
|---|---|---|
| M17 | vrmrig.vrm_version reports 1.0 for a VRMC_vrm file | RED |

### M17
```
$ python3 -m unittest -q scripts.avatar.vrmrig_test.Versions.test_the_version_is_reported
======================================================================
FAIL: test_the_version_is_reported (scripts.avatar.vrmrig_test.Versions.test_the_version_is_reported)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 131, in test_the_version_is_reported
    self.assertEqual(vrmrig.vrm_version(gltf(self.NODES, self.BONES, version='1')), '1')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: '0' != '1'
- 0
+ 1
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

