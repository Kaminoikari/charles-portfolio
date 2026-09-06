X1 RED  restored=True
X2 RED  restored=True
X3 RED  restored=True
X4 RED  restored=True
X5 RED  restored=True
X6 RED  restored=True
X8 RED  restored=True
X9 RED  restored=True
X7 RED  restored=True

| # | guard | result |
|---|---|---|
| X1 | two skinned meshes sharing a name are refused; keying both under it reads one mesh's primitive indices off the other | RED |
| X2 | a skinned mesh with no name is refused; an invented name resolves to nothing downstream | RED |
| X3 | the ?model= check is the URL parser's; the shape list it replaced lets /\evil.example/x.vrm through | RED |
| X4 | a 1.0 file carrying both thumb spellings is refused, not silently merged into one bone | RED |
| X5 | a pan the rounding pushed outside its own range is refused rather than returned | RED |
| X6 | the span is measured through the file's own fov, not the site's current one | RED |
| X8 | the ANSWER is checked too: /.//evil.example/x.vrm is same-origin as a URL object and normalises to an authority the loader parses cross-origin | RED |
| X9 | the report says whether there was a cardigan to measure, so the table can print — instead of a 0 nothing produced | RED |
| X7 | the shipped body is still accepted; a derivation that refuses everything is not a guard | RED |

### X1
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t refuses a body whose skinned meshes it cannot address by name
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 29ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Ski
[…]
whose skinned meshes it cannot address by name 28ms
     → expected [Function] to throw an error
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:03
   Duration  579ms (transform 84ms, setup 39ms, collect 122ms, tests 29ms, environment 272ms, prepare 32ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ scripts/avatar/springsim.derive.test.ts:138:44
    136|     const shared = first.name as string
    137|     second.name = shared
    138|     expect(() => deriveManifest(twoAlike)).toThrowError(new RegExp(sha…
       |                                            ^
    139| 
    140|     const nameless = glbOf(MODEL)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X2
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t refuses a body whose skinned meshes it cannot address by name
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 55ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Ski
[…]
ot address by name 55ms
     → expected [Function] to throw an error
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:04
   Duration  461ms (transform 78ms, setup 25ms, collect 116ms, tests 55ms, environment 150ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ scripts/avatar/springsim.derive.test.ts:143:44
    141|     const anon = nameless.json.nodes.filter((n) => n.mesh !== undefine…
    142|     delete nameless.json.meshes[anon.mesh as number].name
    143|     expect(() => deriveManifest(nameless)).toThrowError(/沒有名字/)
       |                                            ^
    144|   })
    145| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X3
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/live-preview.test.ts -t refuses a model URL that leaves this site
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/live-preview.test.ts (7 tests | 1 failed | 6 skipped) 5ms
   ↓ Mika Milfy live preview config > loads the local-only Mika Milfy model
   ↓ Mika Milfy live preview config > tells the engine which rig the previewed build came off
   ↓ Mika Milfy live preview config > loads another build when one is asked for, and says which
   × Mika Milfy live preview config > refuses a model URL that leaves this site 5ms
     → /\evil.example/x.vrm: expecte
[…]
live preview config > offers every procedural gesture exposed by the avatar handle
   ↓ Mika Milfy live preview config > gives every preview control a unique label
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
   Start at  03:40:05
   Duration  399ms (transform 65ms, setup 26ms, collect 106ms, tests 5ms, environment 152ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/live-preview.test.ts > Mika Milfy live preview config > refuses a model URL that leaves this site
AssertionError: /\evil.example/x.vrm: expected '/x.vrm' to be '/avatar/mika-milfy-12.vrm' // Object.is equality
Expected: [32m"/[7mavatar/mika-milfy-12[27m.vrm"[39m
Received: [31m"/[7mx[27m.vrm"[39m
 ❯ scripts/avatar/live-preview.test.ts:66:28
     64|                        'avatar/relative.vrm']) {
     65|       const got = resolvePreviewModel(`?model=${encodeURIComponent(bad…
     66|       expect(got.url, bad).toBe(MIKA_MILFY_MODEL_URL)
       |                            ^
     67|       expect(got.problem, bad).toContain(bad)
     68|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X4
```
$ python3 -W ignore -m unittest -v vrmrig_test.Versions.test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged
test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged (vrmrig_test.Versions.test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged) ... FAIL
======================================================================
FAIL: test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged (vrmrig_test.Versions.test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/vrmrig_test.py", line 188, in test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged
    with self.assertRaises(vrmrig.BadRig) as cm:
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: BadRig not raised
----------------------------------------------------------------------
Ran 1 test in 0.000s
FAILED (failures=1)
```

### X5
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t refuses a pan that its own rounding puts outside the range
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (6 tests | 1 failed | 5 skipped) 4ms
   ↓ clearance producers > measure-motions --write records the rig it measured
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   × combineClearance > refuses a pan that its own rounding puts outside the range 4ms
     → expected [Function] to throw an error
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:06
   Duration  352ms (transform 44ms, setup 25ms, collect 66ms, tests 4ms, environment 151ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > refuses a pan that its own rounding puts outside the range
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ src/components/chat/clearance.test.ts:207:8
    205|     expect(r.least, 'and one that does not contain zero').toBeGreaterT…
    206|     expect(() => panFor(pinched, 'dance', 'column', pinched.restCrownY…
    207|       .toThrow(/no pan on the centimetre/)
       |        ^
    208|   })
    209| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X6
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t measures the pan against the fov the file was produced under
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (6 tests | 1 failed | 5 skipped) 3ms
   ↓ clearance producers > measure-motions --write records the rig it measured
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   × combineClearance > measures the pan against the fov the file was produced under 3ms
     → expected 0.11786774908543673 to be greater than 0.11786774908543673
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:06
   Duration  345ms (transform 41ms, setup 25ms, collect 62ms, tests 3ms, environment 150ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > measures the pan against the fov the file was produced under
AssertionError: expected 0.11786774908543673 to be greater than 0.11786774908543673
 ❯ src/components/chat/clearance.test.ts:185:25
    183|     const wide = panRange(file, 'dance', 'column', file.restCrownY, ['…
    184|     const tight = panRange(narrow, 'dance', 'column', narrow.restCrown…
    185|     expect(tight.least).toBeGreaterThan(wide.least)
       |                         ^
    186|     expect(tight.most).toBeLessThan(wide.most)
    187|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X8
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/live-preview.test.ts -t refuses a model URL that leaves this site
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/live-preview.test.ts (7 tests | 1 failed | 6 skipped) 5ms
   ↓ Mika Milfy live preview config > loads the local-only Mika Milfy model
   ↓ Mika Milfy live preview config > tells the engine which rig the previewed build came off
   ↓ Mika Milfy live preview config > loads another build when one is asked for, and says which
   × Mika Milfy live preview config > refuses a model URL that leaves this site 5ms
     → /.//evil.example/x.vrm: expec
[…]
very procedural gesture exposed by the avatar handle
   ↓ Mika Milfy live preview config > gives every preview control a unique label
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
   Start at  03:40:07
   Duration  406ms (transform 68ms, setup 29ms, collect 110ms, tests 5ms, environment 153ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/live-preview.test.ts > Mika Milfy live preview config > refuses a model URL that leaves this site
AssertionError: /.//evil.example/x.vrm: expected '//evil.example/x.vrm' to be '/avatar/mika-milfy-12.vrm' // Object.is equality
Expected: [32m"/[7mavatar/mika-milfy-12[27m.vrm"[39m
Received: [31m"/[7m/evil.example/x[27m.vrm"[39m
 ❯ scripts/avatar/live-preview.test.ts:66:28
     64|                        'avatar/relative.vrm']) {
     65|       const got = resolvePreviewModel(`?model=${encodeURIComponent(bad…
     66|       expect(got.url, bad).toBe(MIKA_MILFY_MODEL_URL)
       |                            ^
     67|       expect(got.problem, bad).toContain(bad)
     68|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X9
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t simulates a body with no manifest beside it
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 24339ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_
[…]
Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:08
   Duration  24.76s (transform 75ms, setup 24ms, collect 115ms, tests 24.34s, environment 151ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > simulates a body with no manifest beside it, and gets a crown out of it
AssertionError: a derived manifest has no cardigan: expected true to be false // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- false[39m
[31m+ true[39m
 ❯ scripts/avatar/springsim.derive.test.ts:120:67
    118|     // The table prints `—` for them off these two flags, so a column …
    119|     // cannot be read as a clean result.
    120|     expect(noParts.hasCoat, 'a derived manifest has no cardigan').toBe…
       |                                                                   ^
    121|     expect(noParts.hasSkirt, 'and no skirt').toBe(false)
    122|     expect(built.hasCoat, 'the built one has both').toBe(true)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### X7
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t names one Face and one Body_Skin
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 11ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   × parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Ski
[…]
nned meshes it cannot address by name
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:40:34
   Duration  538ms (transform 76ms, setup 36ms, collect 113ms, tests 11ms, environment 259ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the mesh layout is
Error: 這個檔的帶皮 mesh 名字不能當部件名：。manifest 用 mesh 名找 mesh，重名會把一個 mesh 的 primitive 編號套到另一個上。
 ❯ deriveManifest scripts/avatar/springsim.ts:179:11
    177|   const repeated = [...new Set(names.filter((n, i) => n && names.index…
    178|   if (true) {
    179|     throw new Error(
       |           ^
    180|       '這個檔的帶皮 mesh 名字不能當部件名：' +
    181|       (unnamed ? `${unnamed} 個沒有名字` : '') +
 ❯ derived scripts/avatar/springsim.derive.test.ts:58:72
 ❯ scripts/avatar/springsim.derive.test.ts:89:12
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

