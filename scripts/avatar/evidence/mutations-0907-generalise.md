E1 RED  restored=True
E2 RED  restored=True
E3 RED  restored=True
S1 RED  restored=True
S2 RED  restored=True
S3 RED  restored=True
S4 RED  restored=True
S5 RED  restored=True
S6 RED  restored=True
S7 RED  restored=True

| # | guard | result |
|---|---|---|
| E1 | deriveFaceBox identifies the face by the expression binds; the pre-2026-09-07 rule (a mesh CALLED Face) picks a decoy on a body that has one | RED |
| E2 | expressionMeshes, VRM 0.x: a blendShape bind names a MESH index, and it is that mesh that is the face | RED |
| E3 | expressionMeshes, VRM 1.0: a bind names a NODE, so it has to be resolved to that node's mesh (taking the node index as a mesh index is the silent version of this bug) | RED |
| S1 | SPRING_DOMINATED is a threshold: at 0 every primitive is hair, and the skirt and the coat get simulated as strands | RED |
| S2 | and it has to be reachable: above 1 nothing is ever hair, which would leave the solver with no strands to move | RED |
| S3 | everything that is not hair or face still gets listed, or the crown stops seeing most of the body | RED |
| S4 | runClip asks for the keys `Face` and `Body_Skin` exactly, so one mesh in each role has to take the plain name (on a five-mesh body nothing else would) | RED |
| S5 | the derived waist is the hips joint in world space, not a placeholder (its consumer is the coat hem band, waist − 4cm) | RED |
| S6 | a body with no .parts.json beside it is simulated from a derived manifest instead of being refused — the whole point of the change | RED |
| S7 | hair is decided per primitive by how much of IT the springs drive, not by whether the file has springs at all | RED |

### E1
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t finds the face by what the expressions move
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 6ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the fr
[…]
9000000238418582 to be close to 1.4, received difference is 0.5000000238418583, but expected 5e-7
   ↓ three-vrm humanoid rig > resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  03:18:06
   Duration  486ms (transform 75ms, setup 36ms, collect 112ms, tests 6ms, environment 216ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > finds the face by what the expressions move, not by what a mesh is called
AssertionError: the bound mesh is the face: expected 1.9000000238418582 to be close to 1.4, received difference is 0.5000000238418583, but expected 5e-7
 ❯ src/components/chat/rigProbe.test.ts:1269:59
    1267|       }),
    1268|     )
    1269|     expect(r.faceBox.min.y, 'the bound mesh is the face').toBeCloseTo(…
       |                                                           ^
    1270|     expect(r.faceBox.max.y, 'and the mesh merely CALLED Face is not').…
    1271|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### E2
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t derives the face box from the meshes the expressions move
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 15ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
 rig > finds the face by what the expressions move, not by what a mesh is called
   ↓ three-vrm humanoid rig > resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  03:18:07
   Duration  413ms (transform 72ms, setup 26ms, collect 109ms, tests 15ms, environment 154ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > derives the face box from the meshes the expressions move, instead of carrying 2026-08-19 numbers
AssertionError: min.x: expected 0.007323108434668893 to be less than 0.002
 ❯ src/components/chat/rigProbe.test.ts:1126:88
    1124|     for (const side of ['min', 'max'] as const) {
    1125|       for (const [k, axis] of (['x', 'y', 'z'] as const).entries()) {
    1126|         expect(Math.abs(r.faceBox[side][axis] - expected[side][k]), `$…
       |                                                                                        ^
    1127|       }
    1128|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### E3
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t resolves a 1.0 expression bind through the node it names
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 6ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the fr
[…]
ession bind through the node it names to that node's mesh 6ms
     → no vertex of the expression-driven meshes is skinned to the head: the face box cannot be derived
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  03:18:08
   Duration  404ms (transform 70ms, setup 24ms, collect 115ms, tests 6ms, environment 146ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > resolves a 1.0 expression bind through the node it names to that node's mesh
Error: no vertex of the expression-driven meshes is skinned to the head: the face box cannot be derived
 ❯ deriveFaceBox src/components/chat/rigProbe.ts:344:11
    342|   }
    343|   if (count === 0) {
    344|     throw new Error(
       |           ^
    345|       faces.size === 0
    346|         ? 'this file declares no expression morph target binds, so the…
 ❯ buildRigFrom src/components/chat/rigProbe.ts:203:19
 ❯ buildRig src/components/chat/rigProbe.ts:209:10
 ❯ src/components/chat/rigProbe.test.ts:1277:15
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S1
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t calls moving hair hair, and calls nothing else hair
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 27ms
   × parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair 27ms
     → derived Hair_* contains Hair001.baked[65], which the build calls something else: expected false to be true // Object.is equality
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manif
[…]
 a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:09
   Duration  429ms (transform 74ms, setup 25ms, collect 114ms, tests 27ms, environment 150ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
AssertionError: derived Hair_* contains Hair001.baked[65], which the build calls something else: expected false to be true // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- true[39m
[31m+ false[39m
 ❯ scripts/avatar/springsim.derive.test.ts:74:127
     72|     // and the scalp cap are skinned to the head bone and have no spri…
     73|     // are still listed (under Body_Skin), which is what the crown nee…
     74|     for (const k of saidHair) expect(reallyHair.has(k), `derived Hair_…
       |                                                                                                                               ^
     75|   })
     76| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S2
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t calls moving hair hair, and calls nothing else hair
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 20ms
   × parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair 20ms
     → the derivation finds moving hair at all: expected 0 to be greater than 0
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the
[…]
 wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:10
   Duration  412ms (transform 73ms, setup 25ms, collect 111ms, tests 20ms, environment 150ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
AssertionError: the derivation finds moving hair at all: expected 0 to be greater than 0
 ❯ scripts/avatar/springsim.derive.test.ts:69:70
     67|       if (name.startsWith('Hair_')) for (const pi of part.primitives) …
     68|     }
     69|     expect(saidHair.size, 'the derivation finds moving hair at all').t…
       |                                                                      ^
     70|     // One direction only, and it is the one that matters. Everything …
     71|     // hair really is hair; the reverse is false by design, because th…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S3
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t puts every skinned primitive somewhere
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 22ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   × parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body 21ms
     → Body.baked[0] is in the build's manifest but nothing derived lists it: expected false to be true // Object.is equality
   ↓ parts read off the file, for a body no build wrote a manifest for > 
[…]
read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:10
   Duration  415ms (transform 77ms, setup 25ms, collect 112ms, tests 22ms, environment 151ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
AssertionError: Body.baked[0] is in the build's manifest but nothing derived lists it: expected false to be true // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- true[39m
[31m+ false[39m
 ❯ scripts/avatar/springsim.derive.test.ts:82:119
     80|     const everything = new Set<string>()
     81|     for (const part of Object.values(truth.parts)) for (const pi of pa…
     82|     for (const k of everything) expect(listed.has(k), `${k} is in the …
       |                                                                                                                       ^
     83|   })
     84| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S4
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t names one Face and one Body_Skin
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 21ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   × parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the mesh layout is 21ms
     → Face: expected undefined to be defined
   ↓ parts read of
[…]
 file, for a body no build wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:11
   Duration  413ms (transform 71ms, setup 25ms, collect 108ms, tests 21ms, environment 149ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the mesh layout is
AssertionError: Face: expected undefined to be defined
 ❯ scripts/avatar/springsim.derive.test.ts:89:42
     87|     // role (the fixture has five meshes) must still answer them, or t…
     88|     // simulator refuses a body it could have measured.
     89|     expect(derived().parts.Face, 'Face').toBeDefined()
       |                                          ^
     90|     expect(derived().parts.Body_Skin, 'Body_Skin').toBeDefined()
     91|     expect(derived().derived, 'the manifest says it was derived, so ma…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S5
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t puts the waist within a hand of where the build measured it
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 20ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the mesh layout is
   ↓ parts read off the file, for a body no build wrote a manifest fo
[…]
s read off the file, for a body no build wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
   × parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it 19ms
     → expected 0.9600000000000001 to be less than 0.1
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:12
   Duration  417ms (transform 74ms, setup 24ms, collect 110ms, tests 20ms, environment 148ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
AssertionError: expected 0.9600000000000001 to be less than 0.1
 ❯ scripts/avatar/springsim.derive.test.ts:143:73
    141|     // the whole requirement — but "close" has to be stated, or a deri…
    142|     // that returned zero would pass everything above.
    143|     expect(Math.abs(derived().landmarks.waist - truth.landmarks.waist)…
       |                                                                         ^
    144|   })
    145| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S6
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t simulates a body with no manifest beside it
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 34ms
   ↓ parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manifest for > names one Face and one Body_Skin, whatever the mesh layout is
   × parts read off the file, for a body no build wrote a manifest fo
[…]
 for a body no build wrote a manifest for > refuses a body whose skinned meshes it cannot address by name
   ↓ parts read off the file, for a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:13
   Duration  439ms (transform 81ms, setup 25ms, collect 125ms, tests 34ms, environment 149ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > simulates a body with no manifest beside it, and gets a crown out of it
Error: no manifest
 ❯ buildManifest scripts/avatar/springsim.ts:274:11
    272|     // pipeline had built: not the Seed-san fixture, and not mika-pink…
    273|     // base body either, whose crowns therefore had to come from a bro…
    274|     throw new Error('no manifest')
       |           ^
    275|   }
    276|   const m = JSON.parse(text) as Partial<Manifest>
 ❯ readManifest scripts/avatar/springsim.ts:259:17
 ❯ runClip scripts/avatar/springsim.ts:877:20
 ❯ scripts/avatar/springsim.derive.test.ts:101:27
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S7
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.derive.test.ts -t calls moving hair hair, and calls nothing else hair
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.derive.test.ts (6 tests | 1 failed | 5 skipped) 24ms
   × parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair 23ms
     → derived Hair_* contains Hair001.baked[65], which the build calls something else: expected false to be true // Object.is equality
   ↓ parts read off the file, for a body no build wrote a manifest for > puts every skinned primitive somewhere, so the crown still sees the whole body
   ↓ parts read off the file, for a body no build wrote a manif
[…]
 a body no build wrote a manifest for > puts the waist within a hand of where the build measured it
 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
   Start at  03:18:14
   Duration  416ms (transform 68ms, setup 24ms, collect 103ms, tests 24ms, environment 153ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.derive.test.ts > parts read off the file, for a body no build wrote a manifest for > calls moving hair hair, and calls nothing else hair
AssertionError: derived Hair_* contains Hair001.baked[65], which the build calls something else: expected false to be true // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- true[39m
[31m+ false[39m
 ❯ scripts/avatar/springsim.derive.test.ts:74:127
     72|     // and the scalp cap are skinned to the head bone and have no spri…
     73|     // are still listed (under Body_Skin), which is what the crown nee…
     74|     for (const k of saidHair) expect(reallyHair.has(k), `derived Hair_…
       |                                                                                                                               ^
     75|   })
     76| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

