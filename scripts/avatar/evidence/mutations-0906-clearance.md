wrote ['tails-no-colliders.vrm', 'tails-no-colliders.parts.json', 'skirt-on-hips.vrm', 'skirt-on-hips.parts.json']
C1 RED  restored=True
C2 RED  restored=True
C3 RED  restored=True
C4 RED  restored=True
C5 RED  restored=True
C6 RED  restored=True
C7 RED  restored=True
C8 RED  restored=True
C9 RED  restored=True
C10 RED  restored=True
C11 RED  restored=True
C12 RED  restored=True
C13 RED  restored=True
C14 RED  restored=True
C15 RED  restored=True
C16 RED  restored=True
C17 RED  restored=True
C19 RED  restored=True
C18 RED  restored=True
F1 RED  restored=True
E1 RED  restored=True
E2 RED  restored=True

| # | guard | result |
|---|---|---|
| C1 | springsim: the world crown is recorded per frame | RED |
| C2 | springsim: the crown is also projected through each frame's camera | RED |
| C3 | springsim: the camera stands on the side the body faces, by version | RED |
| C4 | springsim: hair inside the skin at rest (the roots) is left out of the body gate, or every clip reads the cap | RED |
| C5 | springsim.test: a skirt skinned wholly to the hips fails the skirt gate | RED |
| C6 | springsim.test: twintails with no colliders fail the coat gate (what the 2026-09-03 file did) | RED |
| C7 | crownBound: a browser sweep that drew the crown higher wins | RED |
| C8 | crownOn: the browser's fringe is added (squat's crownTop waiver stops being needed without it) | RED |
| C9 | crownOn: the crown is moved onto the measured body by its own resting crown (a taller body's crown rises with it) | RED |
| C10 | combineClearance: two producers on different rigs are refused | RED |
| C11 | combineClearance: a missing crownFringe is refused rather than defaulted | RED |
| C12 | rigSha: the producer writes the sha of the body it read, not the family's (the test's body is a scaled copy with another rig) | RED |
| C13 | measure-motions: the crown row is printed against each frame | RED |
| C14 | rigProbe.test: a composition change without a re-run of springsim --clearance is caught | RED |
| C15 | avatarVariants.test: every declared body is the rig the clearance file names (both produced halves moved together, because a sha changed in one is refused by combineClearance first — C10) | RED |
| C16 | rigProbe.test: a crownTop waiver the clip does not need fails | RED |
| C17 | springsim: the skirt depth is recorded (the twin comparison reads -Infinity against -Infinity otherwise: NaN) | RED |
| C19 | crownSeen: a browser sweep above the derived crown is recorded (drop it and scratchHead's crownTop waiver stops being needed, which is itself a failure) | RED |
| C18 | springsim: the body depth is recorded (dance's line pins the measure's cap, so it notices the reading vanishing as well as shrinking) | RED |
| F1 | sampleTimes: the clip is walked at 60 Hz as well as at its keys (keys only, the dance's deepest fingertip reads 0.3004 instead of 0.1975 and the waiver is a third too loose) | RED |
| E1 | envelope.heights: the heights are read off the body, not typed in (and the committed envelope was swept over them) | RED |
| E2 | envelope.sweep: the legs are posed by the clips, not left at rest | RED |

### C1
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t the hop throws her hair well above its resting crown
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 23968ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   × Milfy through the spring solver > dance: the hop throws her hair well above its resting crown 5ms
     → crown @0.00s over rest: expected -Infinity to be greater than or equal to 0.05
   ↓ Milfy through the spring solver > a 1.0 export of the same body simulates the same
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:17:37
   Duration  24.51s (transform 74ms, setup 40ms, collect 101ms, tests 23.97s, environment 277ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
AssertionError: crown @0.00s over rest: expected -Infinity to be greater than or equal to 0.05
 ❯ scripts/avatar/springsim.test.ts:130:81
    128|     // crownY the topmost vertex at any frame of the clip, springs inc…
    129|     expect(r.restCrownY, 'rest crown').toBeGreaterThan(1.5)
    130|     expect(r.crownY - r.restCrownY, `crown @${r.crownT.toFixed(2)}s ov…
       |                                                                                 ^
    131|     // And as the column's camera sees it: the hop comes toward the ca…
    132|     // the projected crown clears the projected rest by more still (20…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C2
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t the hop throws her hair well above its resting crown
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 23875ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   × Milfy through the spring solver > dance: the hop throws her hair well above its resting crown 4ms
     → projected crown over projected rest: expected -Infinity to be greater than or equal to 0.05
   ↓ Milfy through the spring solver > a 1.0 export of the same body simulates the same
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:18:02
   Duration  24.41s (transform 64ms, setup 43ms, collect 98ms, tests 23.88s, environment 264ms, prepare 32ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
AssertionError: projected crown over projected rest: expected -Infinity to be greater than or equal to 0.05
 ❯ scripts/avatar/springsim.test.ts:134:100
    132|     // the projected crown clears the projected rest by more still (20…
    133|     // 1.7099 against 1.5881, and the browser drew 1.7112).
    134|     expect(r.crownScreen.column - r.restCrownScreen.column, 'projected…
       |                                                                                                    ^
    135|     expect(r.crownScreen.column, 'perspective lifts the hop').toBeGrea…
    136|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C3
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t a 1.0 export of the same body simulates the same
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 41100ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   ↓ Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
   × Milfy through the spring solver > a 1.0 export of the same body simulates the same 17131ms
     → projected crown, 1.0 twin vs 0.x: expected 0.06904994750481896 to be less than or equal to 0.002
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:18:27
   Duration  41.67s (transform 68ms, setup 40ms, collect 107ms, tests 41.10s, environment 288ms, prepare 35ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > a 1.0 export of the same body simulates the same
AssertionError: projected crown, 1.0 twin vs 0.x: expected 0.06904994750481896 to be less than or equal to 0.002
 ❯ scripts/avatar/springsim.test.ts:160:104
    158|     expect(Math.abs(r.crownY - v0.crownY), 'crown, 1.0 twin vs 0.x').t…
    159|     // The camera stands on the side she faces, which the twin has tur…
    160|     expect(Math.abs(r.crownScreen.column - v0.crownScreen.column), 'pr…
       |                                                                                                        ^
    161|     expect(Math.abs(r.skirtDepthMm - v0.skirtDepthMm), 'skirt depth, 1…
    162|   }, 60_000)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C4
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t spin: the tails stay outside the cardigan and out of her body
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 25019ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   × Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body 5ms
     → deepest into the body @2.10s: expected 49.849246143033135 to be less than or equal to 20
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   ↓ Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
   ↓ Milfy through the spring solver > a 1.0 export of the same body simulates the same
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:19:10
   Duration  25.58s (transform 63ms, setup 40ms, collect 99ms, tests 25.02s, environment 290ms, prepare 34ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
AssertionError: deepest into the body @2.10s: expected 49.849246143033135 to be less than or equal to 20
 ❯ scripts/avatar/springsim.test.ts:106:85
    104|       const body = BODY_MM[clip]
    105|       if ('max' in body) {
    106|         expect(r.bodyDepthMm, `deepest into the body @${r.bodyWorstT.t…
       |                                                                                     ^
    107|       } else {
    108|         expect(r.bodyDepthMm, `body depth should still be pinned at th…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C5
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t the legs stay under the skirt  [SPRINGSIM_TEST_MODEL=/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/clearance-mut-zyqcy5r1/skirt-on-hips.vrm]
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 2 failed | 4 skipped) 23668ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   × Milfy through the spring solver > dance: the legs stay under the skirt 5ms
     → deepest leg through the skirt @8.70s: expected 48.85170394470631 to be less than or equal to 40
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   × Milfy through the spring solver > spin: the legs stay under the skirt 0ms
     → deepest leg t
[…]
test.ts > Milfy through the spring solver > dance: the legs stay under the skirt
AssertionError: deepest leg through the skirt @8.70s: expected 48.85170394470631 to be less than or equal to 40
 ❯ scripts/avatar/springsim.test.ts:121:93
    119|     it(`${clip}: the legs stay under the skirt`, () => {
    120|       const r = reports[clip]
    121|       expect(r.skirtDepthMm, `deepest leg through the skirt @${r.skirt…
       |                                                                                             ^
    122|     })
    123|   }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > spin: the legs stay under the skirt
AssertionError: deepest leg through the skirt @1.70s: expected 49.05150007606937 to be less than or equal to 40
 ❯ scripts/avatar/springsim.test.ts:121:93
    119|     it(`${clip}: the legs stay under the skirt`, () => {
    120|       const r = reports[clip]
    121|       expect(r.skirtDepthMm, `deepest leg through the skirt @${r.skirt…
       |                                                                                             ^
    122|     })
    123|   }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

### C6
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t dance: the tails stay outside the cardigan  [SPRINGSIM_TEST_MODEL=/var/folders/cl/njr49bx900ddfl_cpmv9_xcw0000gn/T/clearance-mut-zyqcy5r1/tails-no-colliders.vrm]
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 24064ms
   × Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body 5ms
     → at rest, inside the coat: expected 53.862027034558196 to be less than or equal to 5
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   ↓ Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
   ↓ Milfy through the spring solver > a 1.0 export of the same body simulates the same
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:20:01
   Duration  24.60s (transform 66ms, setup 42ms, collect 98ms, tests 24.06s, environment 270ms, prepare 35ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
AssertionError: at rest, inside the coat: expected 53.862027034558196 to be less than or equal to 5
 ❯ scripts/avatar/springsim.test.ts:101:61
     99|     it(`${clip}: the tails stay outside the cardigan and out of her bo…
    100|       const r = reports[clip]
    101|       expect(r.restCoatDepthMm, 'at rest, inside the coat').toBeLessTh…
       |                                                             ^
    102|       expect(r.coatDepthMm, `deepest into the coat @${r.coatWorstT.toF…
    103|       expect(r.coatAtWorst, 'share of the tail ≥5mm inside at the wors…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C7
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t transfers a clip crown onto another body
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (4 tests | 1 failed | 3 skipped) 5ms
   ↓ clearance producers > measure-motions --write records the rig it measured
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   × combineClearance > transfers a clip crown onto another body by its own resting crown 4ms
     → expected 1.7442 to be 1.9 // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 3 skipped (4)
   Start at  22:20:27
   Duration  481ms (transform 39ms, setup 37ms, collect 61ms, tests 5ms, environment 262ms, prepare 34ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > transfers a clip crown onto another body by its own resting crown
AssertionError: expected 1.7442 to be 1.9 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 1.9[39m
[31m+ 1.7442[39m
 ❯ src/components/chat/clearance.test.ts:180:54
    178|     // a browser sweep that drew it higher wins, per frame
    179|     const seen = combineClearance(measured, simulated, { ...decisions,…
    180|     expect(crownBound(seen, 'dance', 'column', 1.6)).toBe(1.9)
       |                                                      ^
    181|     expect(crownBound(seen, 'dance', 'waistUp', 1.6)).toBeCloseTo(crow…
    182|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C8
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t squat stays inside every frame it declares
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (121 tests | 1 failed | 120 skipped) 228ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the 
[…]
s on
   ↓ three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 120 skipped (121)
   Start at  22:20:28
   Duration  681ms (transform 74ms, setup 27ms, collect 114ms, tests 228ms, environment 180ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > squat stays inside every frame it declares
AssertionError: squat declares a crownTop waiver it does not need: expected -0.0013012408654178298 to be greater than 0
 ❯ src/components/chat/rigProbe.test.ts:600:80
    598|     }
    599|     if (crownBudget !== undefined) {
    600|       expect(crownPast, `${name} declares a crownTop waiver it does no…
       |                                                                                ^
    601|     }
    602|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C9
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t reports the derived crown against the top edge
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 6409ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   ↓ measure-motions > reports the face box and the finger skin it read off the body
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it printed
   × measure-motions > reports the derived crown against the top edge 3ms
     → expected '模型　　/var/fol
[…]
.6mm（模擬投影 1.8081，換到這具身體 560.0mm，瀏覽器邊緣 1.5mm）
   手沒進到臉裡　最近一次 2.236（要大於 1）
   頭尾站得住　髖部偏移 0.0mm（上限 80.0mm）
── dance　（waistUp、column）
   waistUp  往畫面左邊伸　0.9420　預算 0.7415　餘裕 -200.5mm
   waistUp  往畫面右邊伸　0.5631　預算 0.7415　餘裕  178.4mm
   waistUp  手的皮膚頂端　2.0054　預算 1.7922　餘裕 -213.2mm
   waistUp  髖部最低　　1.0159　下緣 0.6878　餘裕  328.0mm
   waistUp  髮頂　1.7133　上緣 1.7922　餘裕  78.9mm（模擬投影 1.7013，換到這具身體 560.0mm，瀏覽器邊緣 1.5mm）
   column   往畫面左邊伸　0.9420　預算 0.7415　餘裕 -200.5mm
   column   往畫面右邊伸　0.5631　預算 0.7415　餘裕  178.5mm
   column   手的皮膚頂端　2.0054　預算 1.7320　餘裕 -273.3mm
   column   髖部最低　　1.0159　下緣 0.5600　餘裕  455.9mm
   column   髮頂　1.7276　上緣 1.7320　餘裕  4.4mm（模擬投影 1.7099，換到這具身體 560.0mm，瀏覽器邊緣 1.5mm）
   手在臉裡但在放行範圍內　0.197（下限 0.190，t=8.22s）
   頭尾站得住　髖部偏移 63.5mm（上限 80.0mm）
19 項超出預算。上面每一列都指名是哪支動作、哪個構圖、哪個方向。
這不代表動作壞了，代表這具身體跟現有的構圖數字不相容：
要嘛調構圖（avatarMode.ts 的 framing），要嘛那支動作不給這具身體用。"
 ❯ scripts/measure-motions.test.ts:163:24
    161|     // A 35% taller body carries its crown up with it; the frame does …
    162|     const tallerText = taller.lines.join('\n')
    163|     expect(tallerText).toMatch(/髮頂　2\.\d{4}　上緣 1\.7320.*餘裕 -\d/)
       |                        ^
    164|   })
    165| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C10
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t pairs two producers only on the same rig
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (4 tests | 1 failed | 3 skipped) 4ms
   ↓ clearance producers > measure-motions --write records the rig it measured
   × combineClearance > pairs two producers only on the same rig 4ms
     → expected [Function] to throw an error
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 3 skipped (4)
   Start at  22:20:36
   Duration  344ms (transform 37ms, setup 24ms, collect 56ms, tests 4ms, environment 152ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > pairs two producers only on the same rig
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ src/components/chat/clearance.test.ts:160:90
    158|     expect(file.clips.dance.crownY).toBe(1.6647)
    159|     expect(file.clips.dance.faceRatio).toBe(0.3)
    160|     expect(() => combineClearance(measured, { ...simulated, rigSha: 'x…
       |                                                                                          ^
    161|     expect(() => combineClearance(measured, { ...simulated, family: 'g…
    162|     expect(() => combineClearance(measured, { ...simulated, clips: {} …
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C11
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t refuses a missing browser fringe
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (4 tests | 1 failed | 3 skipped) 4ms
   ↓ clearance producers > measure-motions --write records the rig it measured
   ↓ combineClearance > pairs two producers only on the same rig
   × combineClearance > refuses a missing browser fringe rather than defaulting it 4ms
     → expected [Function] to throw an error
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 3 skipped (4)
   Start at  22:20:37
   Duration  337ms (transform 34ms, setup 24ms, collect 52ms, tests 4ms, environment 152ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > refuses a missing browser fringe rather than defaulting it
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ src/components/chat/clearance.test.ts:170:62
    168|     // record of whether anyone ever checked it against a drawn pixel.
    169|     const bad = { ...decisions, crownFringe: Number.NaN }
    170|     expect(() => combineClearance(measured, simulated, bad)).toThrow(/…
       |                                                              ^
    171|   })
    172| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C12
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/clearance.test.ts -t measure-motions --write records the rig it measured
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/clearance.test.ts (4 tests | 1 failed | 3 skipped) 2459ms
   × clearance producers > measure-motions --write records the rig it measured 2458ms
     → expected 'e2aad79ec6667a5529934359339a6a08a29f7…' to be 'c022f36a1d2f3e1ffd1fc96a5256ec9cf8410…' // Object.is equality
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 3 skipped (4)
   Start at  22:20:38
   Duration  2.79s (transform 35ms, setup 24ms, collect 54ms, tests 2.46s, environment 147ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > clearance producers > measure-motions --write records the rig it measured
AssertionError: expected 'e2aad79ec6667a5529934359339a6a08a29f7…' to be 'c022f36a1d2f3e1ffd1fc96a5256ec9cf8410…' // Object.is equality
Expected: [32m"c022f36a1d2f3e1ffd1fc96a5256ec9cf84104ce1250764e77a8fe95e07cf1f3"[39m
Received: [31m"e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45"[39m
 ❯ src/components/chat/clearance.test.ts:89:29
     87|     expect(MEASURED.family).toBe('probe')
     88|     // This body's own rig, which is not the family's.
     89|     expect(MEASURED.rigSha).toBe(sha256(rigOf(body.json)))
       |                             ^
     90|     expect(MEASURED.rigSha).not.toBe(CLEARANCE.rigSha)
     91|     // Outside public/, the path is recorded as given.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C13
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t reports the derived crown against the top edge
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 6496ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   ↓ measure-motions > reports the face box and the finger skin it read off the body
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it printed
   × measure-motions > reports the derived crown against the top edge 3ms
     → expected '模型　　public/a
[…]
   手沒進到臉裡　最近一次 2.236（要大於 1）
   頭尾站得住　髖部偏移 0.0mm（上限 80.0mm）
── dance　（waistUp、column）
   waistUp  往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.7mm
   waistUp  往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.4mm
   waistUp  手的皮膚頂端　1.4886　預算 1.7922　餘裕  303.6mm
   waistUp  髖部最低　　0.7525　下緣 0.6878　餘裕  64.7mm
   waistUp  ⚠ 髮頂沒有量：沒有 clearance 檔可以對上緣
   column   往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.8mm
   column   往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.5mm
   column   手的皮膚頂端　1.4886　預算 1.7320　餘裕  243.5mm
   column   髖部最低　　0.7525　下緣 0.5600　餘裕  192.5mm
   column   ⚠ 髮頂沒有量：沒有 clearance 檔可以對上緣
   手在臉裡但在放行範圍內　0.197（下限 0.190，t=8.22s）
   頭尾站得住　髖部偏移 47.1mm（上限 80.0mm）
18 項超出預算。上面每一列都指名是哪支動作、哪個構圖、哪個方向。
這不代表動作壞了，代表這具身體跟現有的構圖數字不相容：
要嘛調構圖（avatarMode.ts 的 framing），要嘛那支動作不給這具身體用。"
 ❯ scripts/measure-motions.test.ts:159:25
    157|     // dance in the column: derived crown against the panned top edge
    158|     // (1.602 + 0.13), with room to spare on the shipped body.
    159|     expect(shippedText).toMatch(/column\s+髮頂　1\.7\d{3}　上緣 1\.7320.*餘裕 …
       |                         ^
    160|     expect(shippedText).not.toContain('推導不出來')
    161|     // A 35% taller body carries its crown up with it; the frame does …
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C14
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t was simulated under the composition the engine uses today
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (121 tests | 1 failed | 120 skipped) 6ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the fr
[…]
s of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 120 skipped (121)
   Start at  22:20:49
   Duration  423ms (transform 67ms, setup 25ms, collect 109ms, tests 6ms, environment 161ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > was simulated under the composition the engine uses today
AssertionError: expected { distance: 2.441, lookAtY: 1.016 } to deeply equal { distance: 2.441, lookAtY: 1.02 }
[32m- Expected[39m
[31m+ Received[39m
[2m  {[22m
[2m    "distance": 2.441,[22m
[32m-   "lookAtY": 1.02,[39m
[31m+   "lookAtY": 1.016,[39m
[2m  }[22m
 ❯ src/components/chat/rigProbe.test.ts:483:29
    481|     expect(f.tilt).toBe(AVATAR_CAMERA_TILT)
    482|     expect(f.frames.waistUp).toEqual(AVATAR_FRAMING_DEFAULT)
    483|     expect(f.frames.column).toEqual(AVATAR_FRAMING_COLUMN)
       |                             ^
    484|     for (const name of names) {
    485|       expect(f.pans[name] ?? null, `${name} pan when the clearance was…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C15
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/avatarVariants.test.ts -t gives every variant the rig the clearance file was measured on
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/avatarVariants.test.ts (9 tests | 1 failed | 8 skipped) 17ms
   ↓ avatar variants > resolves the active variant by default
   ↓ avatar variants > refuses an id it does not know instead of quietly using the default
   ↓ avatar variants > declares only files that are actually served
   ↓ avatar variants > gives every variant its own id
   ↓ avatar variants > gives every variant its own url
   ↓ avatar variants > gives every variant the same rig
   × avatar variants > gives every variant the rig the clearance file was measured on 16ms
 
[…]
iants > loads the resolved variant rather than a constant of its own
 Test Files  1 failed (1)
      Tests  1 failed | 8 skipped (9)
   Start at  22:20:50
   Duration  435ms (transform 42ms, setup 34ms, collect 64ms, tests 17ms, environment 191ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/avatarVariants.test.ts > avatar variants > gives every variant the rig the clearance file was measured on
AssertionError: pink is not the rig vroid-sample-b was measured on: expected 'e2aad79ec6667a5529934359339a6a08a29f7…' to be '0000000000000000000000000000000000000…' // Object.is equality
Expected: [32m"0000000000000000000000000000000000000000000000000000000000000000"[39m
Received: [31m"e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45"[39m
 ❯ src/components/chat/avatarVariants.test.ts:115:81
    113|     for (const v of AVATAR_VARIANTS) {
    114|       const sha = createHash('sha256').update(rigOf(gltfOf(v.url))).di…
    115|       expect(sha, `${v.id} is not the rig ${CLEARANCE.family} was meas…
       |                                                                                 ^
    116|     }
    117|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C16
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t akimbo stays inside every frame it declares
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (121 tests | 1 failed | 120 skipped) 228ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the 
[…]
on
   ↓ three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 120 skipped (121)
   Start at  22:20:51
   Duration  698ms (transform 74ms, setup 27ms, collect 119ms, tests 228ms, environment 185ms, prepare 32ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > akimbo stays inside every frame it declares
AssertionError: akimbo declares a crownTop waiver it does not need: expected -0.0012012408654178408 to be greater than 0
 ❯ src/components/chat/rigProbe.test.ts:600:80
    598|     }
    599|     if (crownBudget !== undefined) {
    600|       expect(crownPast, `${name} declares a crownTop waiver it does no…
       |                                                                                ^
    601|     }
    602|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C17
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t a 1.0 export of the same body simulates the same
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 46013ms
   ↓ Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   ↓ Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
   × Milfy through the spring solver > a 1.0 export of the same body simulates the same 19754ms
     → skirt depth, 1.0 twin vs 0.x: expected NaN to be less than or equal to 2
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:20:52
   Duration  46.51s (transform 72ms, setup 33ms, collect 111ms, tests 46.01s, environment 188ms, prepare 37ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > a 1.0 export of the same body simulates the same
AssertionError: skirt depth, 1.0 twin vs 0.x: expected NaN to be less than or equal to 2
 ❯ scripts/avatar/springsim.test.ts:161:88
    159|     // The camera stands on the side she faces, which the twin has tur…
    160|     expect(Math.abs(r.crownScreen.column - v0.crownScreen.column), 'pr…
    161|     expect(Math.abs(r.skirtDepthMm - v0.skirtDepthMm), 'skirt depth, 1…
       |                                                                                        ^
    162|   }, 60_000)
    163| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C19
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t scratchHead stays inside every frame it declares
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (121 tests | 1 failed | 120 skipped) 164ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the 
[…]
ree-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 120 skipped (121)
   Start at  22:21:40
   Duration  813ms (transform 89ms, setup 45ms, collect 141ms, tests 164ms, environment 307ms, prepare 41ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > scratchHead stays inside every frame it declares
AssertionError: scratchHead declares a crownTop waiver it does not need: expected -0.0009012408654178738 to be greater than 0
 ❯ src/components/chat/rigProbe.test.ts:600:80
    598|     }
    599|     if (crownBudget !== undefined) {
    600|       expect(crownPast, `${name} declares a crownTop waiver it does no…
       |                                                                                ^
    601|     }
    602|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### C18
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t dance: the tails stay outside the cardigan
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (6 tests | 1 failed | 5 skipped) 26795ms
   × Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body 6ms
     → body depth should still be pinned at the measure's cap: expected -Infinity to be close to 50, received difference is Infinity, but expected 0.05
   ↓ Milfy through the spring solver > dance: the legs stay under the skirt
   ↓ Milfy through the spring solver > spin: the tails stay outside the cardigan and out of her body
   ↓ Milfy through the spring solver > spin: the legs stay under the skirt
   ↓ Milfy through the spring solver > dance: the hop throws her hair well above its resting crown
   ↓ Milfy through the spring solver > a 1.0 export of the same body simulates the same
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:21:42
   Duration  27.33s (transform 84ms, setup 32ms, collect 129ms, tests 26.79s, environment 191ms, prepare 44ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy through the spring solver > dance: the tails stay outside the cardigan and out of her body
AssertionError: body depth should still be pinned at the measure's cap: expected -Infinity to be close to 50, received difference is Infinity, but expected 0.05
 ❯ scripts/avatar/springsim.test.ts:108:89
    106|         expect(r.bodyDepthMm, `deepest into the body @${r.bodyWorstT.t…
    107|       } else {
    108|         expect(r.bodyDepthMm, `body depth should still be pinned at th…
       |                                                                                         ^
    109|       }
    110|       expect(r.jumpDeg, `largest one-frame turn (${r.jumpBone} @${r.ju…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### F1
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t recognises the face waiver dance already ships with
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 3145ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   × measure-motions > recognises the face waiver dance already ships with 4ms
     → expected '   手在臉裡但在放行範圍內　0.300（下限 0.190，t=8.23s）' to match /0\.19[5-9].*下限 0\.190/
   ↓ measure-motions > reports the face box and the finger skin it read off the body
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it printed
   ↓ measure-motions > reports the derived crown against the top edge
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  22:22:10
   Duration  3.76s (transform 79ms, setup 39ms, collect 129ms, tests 3.15s, environment 296ms, prepare 39ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/measure-motions.test.ts > measure-motions > recognises the face waiver dance already ships with
AssertionError: expected '   手在臉裡但在放行範圍內　0.300（下限 0.190，t=8.23s）' to match /0\.19[5-9].*下限 0\.190/
[32m- Expected:[39m 
/0\.19[5-9].*下限 0\.190/
[31m+ Received:[39m 
"   手在臉裡但在放行範圍內　0.300（下限 0.190，t=8.23s）"
 ❯ scripts/measure-motions.test.ts:108:18
    106|     const line = shipped.lines.find((l) => l.includes('放行範圍內'))
    107|     expect(line, '找不到 dance 的放行說明').toBeDefined()
    108|     expect(line).toMatch(/0\.19[5-9].*下限 0\.190/)
       |                  ^
    109|   })
    110| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### E1
```
$ python3 -W ignore -m unittest -q scripts.avatar.envelope_test.Heights
======================================================================
FAIL: test_follow_the_body (scripts.avatar.envelope_test.Heights.test_follow_the_body)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/envelope_test.py", line 49, in test_follow_the_body
    self.assertAlmostEqual(tall[0], 0.68, places=3)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: np.float64(0.6) != 0.68 within 3 places (np.float64(0.08000000000000007) difference)
===============================
[…]
^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         verbose=verbose, header=header, equal_nan=equal_nan,
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         strict=strict)
                         ^^^^^^^^^^^^^^
  File "/opt/homebrew/lib/python3.14/site-packages/numpy/testing/_private/utils.py", line 842, in assert_array_compare
    raise AssertionError(msg)
AssertionError: 
Not equal to tolerance rtol=1e-07, atol=1e-06
(shapes (43,), (41,) mismatch)
 ACTUAL: array([0.5 , 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59, 0.6 ,
       0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7 , 0.71,
       0.72, 0.73, 0.74, 0.75, 0.76, 0.77, 0.78, 0.79, 0.8 , 0.81, 0.82,
       0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.9 , 0.91, 0.92])
 DESIRED: array([0.6 , 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7 ,
       0.71, 0.72, 0.73, 0.74, 0.75, 0.76, 0.77, 0.78, 0.79, 0.8 , 0.81,
       0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.9 , 0.91, 0.92,
       0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1.  ])
----------------------------------------------------------------------
Ran 3 tests in 0.033s
FAILED (failures=3)
```

### E2
```
$ python3 -W ignore -m unittest -q scripts.avatar.envelope_test.Sweep
======================================================================
FAIL: test_sweeps_where_the_legs_go_not_where_they_rest (scripts.avatar.envelope_test.Sweep.test_sweeps_where_the_legs_go_not_where_they_rest)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/envelope_test.py", line 77, in test_sweeps_where_the_legs_go_not_where_they_rest
    self.assertGreater(swept_r, rest_r + 0.01,
    ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^
                       f'swept {swept_r:.4f} vs rest {rest_r:.4f} at 0.85m')
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0.12622371925179476 not greater than 0.13622371315956117 : swept 0.1262 vs rest 0.1262 at 0.85m
----------------------------------------------------------------------
Ran 1 test in 0.166s
FAILED (failures=1)
```


---

## 2026-09-07 補記：C15 的測試改名，選擇器與收據一併更新

Phase 6b 把 `avatarVariants.test.ts` 那條測試從「gives every variant the rig
the clearance file was measured on」改名成「gives every variant the rig its own
family was measured on」（rig 現在held 的是該 variant **自己 family** 的 sha，
不是單一 clearance 檔的）。上面 C15 區塊裡的輸出是改名前跑的。

`clearance-0906-mutate.py` 的 `-t` 選擇器已跟著改。這件事本身就是一個陷阱：
`vitest -t <對不上的名字>` 也是非零退出，這份 harness 的 `ran_and_failed`
會把它判成 ABORT 而不是 RED，但如果沒有那道檢查，改名就會讓 C15 永遠「紅」下去
而其實一條測試都沒跑。改完之後重跑，仍然是 RED，逐字輸出如下。

### C15
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/avatarVariants.test.ts -t gives every variant the rig its own family was measured on
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/avatarVariants.test.ts (11 tests | 1 failed | 10 skipped) 14ms
   ↓ avatar variants > resolves the active variant by default
   ↓ avatar variants > refuses an id it does not know instead of quietly using the default
   ↓ avatar variants > declares only files that are actually served
   ↓ avatar variants > gives every variant its own id
   ↓ avatar variants > gives every variant its own url
   × avatar variants > gives every variant the rig its own family was measured on 13ms
     → pink is not the rig family vroid-sample-b was measur
[…]
iles  1 failed (1)
      Tests  1 failed | 10 skipped (11)
   Start at  00:03:53
   Duration  504ms (transform 50ms, setup 37ms, collect 65ms, tests 14ms, environment 271ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/avatarVariants.test.ts > avatar variants > gives every variant the rig its own family was measured on
AssertionError: pink is not the rig family vroid-sample-b was measured on: expected 'e2aad79ec6667a5529934359339a6a08a29f7…' to be '0000000000000000000000000000000000000…' // Object.is equality
Expected: [32m"0000000000000000000000000000000000000000000000000000000000000000"[39m
Received: [31m"e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45"[39m
 ❯ src/components/chat/avatarVariants.test.ts:105:80
    103|       expect(Object.keys(readHumanoid(doc).bones).length).toBeGreaterT…
    104|       const sha = createHash('sha256').update(rigOf(doc)).digest('hex')
    105|       expect(sha, `${v.id} is not the rig family ${v.family} was measu…
       |                                                                                ^
    106|         AVATAR_FAMILIES[v.family].rigSha,
    107|       )
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

