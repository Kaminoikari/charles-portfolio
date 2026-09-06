R1 RED  restored=True
R2 RED  restored=True
R3 RED  restored=True
R4 RED  restored=True
R5 RED  restored=True
R6 RED  restored=True
R7 RED  restored=True
R8 RED  restored=True
R9 RED  restored=True
P5 RED  restored=True
R10 RED  restored=True
M1 RED  restored=True
M2 RED  restored=True
V1 RED  restored=True
V2 RED  restored=True
S1 RED  restored=True
A1 RED  restored=True
P1 RED  restored=True
P2 RED  restored=True
P3 RED  restored=True
P4 RED  restored=True

| # | guard | result |
|---|---|---|
| R1 | applyMotion: the x/z flip is for a 0.x body, not a 1.0 one (the twin test alone lets this through: both bodies flipped the wrong way still agree up to the half turn) | RED |
| R2 | applyMotion: the flip is conditional at all (the pre-6a code) | RED |
| R3 | sync: the normalized pose is written onto the raw nodes through humanoid.update() | RED |
| R4 | deriveFaceBox: the Face mesh only, never the hair | RED |
| R5 | deriveFaceBox: head-dominant vertices only (invisible on the shipped Face mesh, which has none; a synthetic two-vertex mesh shows it) | RED |
| R6 | buildRigFrom: a 0.x body's thumb joints are renamed to three-vrm's 1.0 names | RED |
| R7 | handJoints: the thumb is sampled at Metacarpal/Proximal/Distal | RED |
| R8 | deriveFingerSkinRadius: the outer phalanges only, never the palm-reaching base joints | RED |
| R9 | skinnedVertices: vertices are skinned by their joints' rest matrices (a taller body's box scales with it) | RED |
| P5 | retarget_parity_test: the dump has to carry every humanoid bone, or the per-bone loop goes vacuous | RED |
| R10 | buildRigFrom: the rig carries the file's own version | RED |
| M1 | measure-motions: the derived face box is printed | RED |
| M2 | measure-motions: the printed finger skin is the derived one, not the 12mm constant | RED |
| V1 | buildNodes: the nodes are parented as the file says | RED |
| V2 | buildNodes: a node scale is applied | RED |
| S1 | springsim: each frame is posed through applyMotion (the pinned readings notice a body that never moves) | RED |
| A1 | avatarMode: the head band's chin is held to the derived face box | RED |
| P1 | motion.retarget: a 1.0 body is not flipped | RED |
| P2 | motion.retarget: a 0.x body IS flipped, as three-vrm flips it | RED |
| P3 | motion.retarget: the clip's thumb names are translated into the body's | RED |
| P4 | humanoid.model_bone_name: a 1.0 body keeps the 1.0 thumb names | RED |

### R1
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t flips the clip for the 0.x body it ships on
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 24ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
 humanoid rig > flips the clip for the 0.x body it ships on 24ms
     → expected 11.86390685393983 to be less than 0.5
   ↓ three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:37
   Duration  570ms (transform 77ms, setup 40ms, collect 99ms, tests 24ms, environment 275ms, prepare 38ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > flips the clip for the 0.x body it ships on
AssertionError: expected 11.86390685393983 to be less than 0.5
 ❯ src/components/chat/rigProbe.test.ts:952:21
    950|       for (const joint of handJoints(r, side)) closest = Math.min(clos…
    951|     }
    952|     expect(closest).toBeLessThan(0.5)
       |                     ^
    953|   })
    954| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R2
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t plays a clip on a VRM 1.0 twin without the VRM0 flip
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 32ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
arrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:38
   Duration  413ms (transform 57ms, setup 26ms, collect 80ms, tests 32ms, environment 156ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > plays a clip on a VRM 1.0 twin without the VRM0 flip, so the two bodies strike the same pose
AssertionError: hips x @3.89: expected -0.2344539996670861 to be close to 0.2344539996670861, received difference is 0.4689079993341722, but expected 5e-7
 ❯ src/components/chat/rigProbe.test.ts:931:40
    929|         const a = world(v0.bones[bone])
    930|         const b = world(v1.bones[bone])
    931|         expect(b.x, `${bone} x @${t}`).toBeCloseTo(-a.x, 6)
       |                                        ^
    932|         expect(b.y, `${bone} y @${t}`).toBeCloseTo(a.y, 6)
    933|         expect(b.z, `${bone} z @${t}`).toBeCloseTo(-a.z, 6)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R3
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t writes the pose through to the raw nodes
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 30ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
9948635 to be less than 0.000001
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:39
   Duration  424ms (transform 59ms, setup 26ms, collect 93ms, tests 30ms, environment 158ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
AssertionError: hips @0: expected 0.11078580939948635 to be less than 0.000001
 ❯ src/components/chat/rigProbe.test.ts:968:80
    966|           const raw = r.humanoid.getRawBoneNode(bone as never)
    967|           if (!raw) throw new Error(`no raw ${bone}`)
    968|           expect(world(raw).distanceTo(world(r.bones[bone])), `${bone}…
       |                                                                                ^
    969|         }
    970|       }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R4
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t derives the face box from the Face mesh
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 18ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
m the Face mesh instead of carrying 2026-08-19 numbers 17ms
     → min.x: expected 0.031160282038069115 to be less than 0.002
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:40
   Duration  410ms (transform 58ms, setup 26ms, collect 88ms, tests 18ms, environment 159ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
AssertionError: min.x: expected 0.031160282038069115 to be less than 0.002
 ❯ src/components/chat/rigProbe.test.ts:981:88
    979|     for (const side of ['min', 'max'] as const) {
    980|       for (const [k, axis] of (['x', 'y', 'z'] as const).entries()) {
    981|         expect(Math.abs(r.faceBox[side][axis] - expected[side][k]), `$…
       |                                                                                        ^
    982|       }
    983|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R5
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t leaves the neck rows of the Face mesh out of the face box
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 6ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the fr
[…]
 derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   × three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box 5ms
     → expected 0.8999999119341392 to be close to 1.4, received difference is 0.5000000880658607, but expected 5e-7
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:41
   Duration  449ms (transform 61ms, setup 27ms, collect 92ms, tests 6ms, environment 177ms, prepare 43ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
AssertionError: expected 0.8999999119341392 to be close to 1.4, received difference is 0.5000000880658607, but expected 5e-7
 ❯ src/components/chat/rigProbe.test.ts:1053:29
    1051|     out.set(bin, binAt + 8)
    1052|     const r = buildRig(out)
    1053|     expect(r.faceBox.min.y).toBeCloseTo(1.4, 6)
       |                             ^
    1054|     expect(r.faceBox.max.y).toBeCloseTo(1.4, 6)
    1055|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R6
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t names the thumb joints the way three-vrm does
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 12ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
 ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:42
   Duration  437ms (transform 57ms, setup 30ms, collect 84ms, tests 12ms, environment 199ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > names the thumb joints the way three-vrm does, and a thumb track lands on them
AssertionError: expected false to be true // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- true[39m
[31m+ false[39m
 ❯ src/components/chat/rigProbe.test.ts:908:46
    906|     // them on import to the 1.0 Metacarpal/Proximal/Distal, which is …
    907|     // every .vrma names them, so no renaming is left for a track to m…
    908|     expect('leftThumbMetacarpal' in r.bones).toBe(true)
       |                                              ^
    909|     expect('leftThumbIntermediate' in r.bones).toBe(false)
    910|     expect(handJoints(r, 'left')).toHaveLength(21)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R7
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t names the thumb joints the way three-vrm does
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 25ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
ce mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:43
   Duration  435ms (transform 68ms, setup 25ms, collect 98ms, tests 25ms, environment 155ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > names the thumb joints the way three-vrm does, and a thumb track lands on them
AssertionError: expected [ Vector3{ …(3) }, …(19) ] to have a length of 21 but got 20
[32m- Expected[39m
[31m+ Received[39m
[32m- 21[39m
[31m+ 20[39m
 ❯ src/components/chat/rigProbe.test.ts:910:35
    908|     expect('leftThumbMetacarpal' in r.bones).toBe(true)
    909|     expect('leftThumbIntermediate' in r.bones).toBe(false)
    910|     expect(handJoints(r, 'left')).toHaveLength(21)
       |                                   ^
    911|     const m = motion('dance')
    912|     expect('leftThumbMetacarpal' in m.rotation).toBe(true)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R8
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t reads a finger skin radius off the mesh
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 20ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
ose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   × three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin 20ms
     → expected 0.056083322654686595 to be less than 0.02
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:44
   Duration  401ms (transform 55ms, setup 24ms, collect 82ms, tests 20ms, environment 157ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
AssertionError: expected 0.056083322654686595 to be less than 0.02
 ❯ src/components/chat/rigProbe.test.ts:1063:20
    1061|     const radius = deriveFingerSkinRadius(parseGlb(asset('AvatarSample…
    1062|     expect(radius).toBeGreaterThanOrEqual(SKIN_ABOVE_JOINT)
    1063|     expect(radius).toBeLessThan(0.02)
       |                    ^
    1064|   })
    1065| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### R9
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t reports the face box and the finger skin
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 2656ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   × measure-motions > reports the face box and the finger skin it read off the body 3ms
     → expected '模型　　/var/folders/cl/njr49bx900ddfl_cp…' to match /臉部盒　x -0\.12\d…0\.12\d　y 1\.73\d…2\.0…/
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it 
[…]
p  往畫面右邊伸　0.7358　預算 0.7415　餘裕  5.7mm
   waistUp  手的皮膚頂端　2.4380　預算 1.8722　餘裕 -565.8mm
   waistUp  髖部最低　　1.1912　下緣 0.7678　餘裕  423.4mm
   手沒進到臉裡　最近一次 15.048（要大於 1）
   頭尾站得住　髖部偏移 -5.6mm（上限 80.0mm）
── dance　（waistUp、column）
   waistUp  往畫面左邊伸　0.9420　預算 0.7415　餘裕 -200.5mm
   waistUp  往畫面右邊伸　0.5631　預算 0.7415　餘裕  178.4mm
   waistUp  手的皮膚頂端　2.0054　預算 1.7922　餘裕 -213.2mm
   waistUp  髖部最低　　1.0159　下緣 0.6878　餘裕  328.0mm
   column   往畫面左邊伸　0.9420　預算 0.7415　餘裕 -200.5mm
   column   往畫面右邊伸　0.5631　預算 0.7415　餘裕  178.5mm
   column   手的皮膚頂端　2.0054　預算 1.7320　餘裕 -273.3mm
   column   髖部最低　　1.0159　下緣 0.5600　餘裕  455.9mm
   ⚠ 手伸進臉裡：橢球值 0.279，下限 0.290（已放行），最深的一幀在 t=17.50s
   ⓘ 髮頂 1.7276（對舊身體量的，上緣 1.7320）。這個數字推導不出來，換身體要在瀏覽器裡重量一次。
   頭尾站得住　髖部偏移 63.5mm（上限 80.0mm）
21 項超出預算。上面每一列都指名是哪支動作、哪個構圖、哪個方向。
這不代表動作壞了，代表這具身體跟現有的構圖數字不相容：
要嘛調構圖（avatarMode.ts 的 framing），要嘛那支動作不給這具身體用。"
 ❯ scripts/measure-motions.test.ts:114:37
    112|     expect(text).toMatch(/指尖皮厚　18\.\dmm/)
    113|     // A taller body's box scales with it: derived, not carried.
    114|     expect(taller.lines.join('\n')).toMatch(/臉部盒　x -0\.12\d…0\.12\d　y …
       |                                     ^
    115|   })
    116| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### P5
```
$ python3 -W ignore -m unittest -q scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_vrm1_twin
======================================================================
FAIL: test_vrm1_twin (scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_vrm1_twin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 164, in test_vrm1_twin
    self.compare('twin')
    ~~~~~~~~~~~~^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 149, in compare
    self.assertEqual(set(theirs), expected, f'{name}@{at:.2f} dumped bone set')
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the second set but not the first:
'leftThumbProximal'
'rightThumbProximal'
'rightThumbDistal'
'leftThumbMetacarpal'
'rightThumbMetacarpal'
'leftThumbDistal' : dance@3.35 dumped bone set
----------------------------------------------------------------------
Ran 1 test in 0.435s
FAILED (failures=1)
```

### R10
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t is a VRMHumanoid and knows which VRM version it came from
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (118 tests | 1 failed | 117 skipped) 22ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resting arm as straight and a folded one as flexed
   ↓ guard sensitivity > sees a hand that leaves the f
[…]
tes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the Face mesh instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows of the Face mesh out of the face box
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 117 skipped (118)
   Start at  16:38:49
   Duration  460ms (transform 68ms, setup 28ms, collect 97ms, tests 22ms, environment 187ms, prepare 31ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > three-vrm humanoid rig > is a VRMHumanoid and knows which VRM version it came from
AssertionError: expected '0' to be '1' // Object.is equality
Expected: [32m"1"[39m
Received: [31m"0"[39m
 ❯ src/components/chat/rigProbe.test.ts:900:74
    898|     expect(r.humanoid).toBeInstanceOf(VRMHumanoid)
    899|     expect(r.version).toBe('0')
    900|     expect(buildRig(vrm1Twin(asset('AvatarSample_B_webp.vrm'))).versio…
       |                                                                          ^
    901|   })
    902| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M1
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t reports the face box and the finger skin
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 2716ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   × measure-motions > reports the face box and the finger skin it read off the body 3ms
     → expected '模型　　public/avatar/AvatarSample_B_webp…' to match /臉部盒　x -0\.09\d…0\.09\d　y 1\.287…1\.503/
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it 
[…]
7415　餘裕  435.2mm
   waistUp  往畫面右邊伸　0.5450　預算 0.7415　餘裕  196.5mm
   waistUp  手的皮膚頂端　1.8091　預算 1.8722　餘裕  63.1mm
   waistUp  髖部最低　　0.8824　下緣 0.7678　餘裕  114.6mm
   手沒進到臉裡　最近一次 2.236（要大於 1）
   頭尾站得住　髖部偏移 -4.1mm（上限 80.0mm）
── dance　（waistUp、column）
   waistUp  往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.7mm
   waistUp  往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.4mm
   waistUp  手的皮膚頂端　1.4886　預算 1.7922　餘裕  303.6mm
   waistUp  髖部最低　　0.7525　下緣 0.6878　餘裕  64.7mm
   column   往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.8mm
   column   往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.5mm
   column   手的皮膚頂端　1.4886　預算 1.7320　餘裕  243.5mm
   column   髖部最低　　0.7525　下緣 0.5600　餘裕  192.5mm
   手在臉裡但在放行範圍內　0.300（下限 0.290，t=8.23s）
   ⓘ 髮頂 1.7276（對舊身體量的，上緣 1.7320）。這個數字推導不出來，換身體要在瀏覽器裡重量一次。
   頭尾站得住　髖部偏移 47.1mm（上限 80.0mm）
全部動作在這具身體上都待在預算內，可以直接沿用。"
 ❯ scripts/measure-motions.test.ts:111:18
    109|     // constant instead would still match a looser pattern.
    110|     const text = shipped.lines.join('\n')
    111|     expect(text).toMatch(/臉部盒　x -0\.09\d…0\.09\d　y 1\.287…1\.503/)
       |                  ^
    112|     expect(text).toMatch(/指尖皮厚　18\.\dmm/)
    113|     // A taller body's box scales with it: derived, not carried.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### M2
```
$ npx vitest run /Users/charles/portfolio/scripts/measure-motions.test.ts -t reports the face box and the finger skin
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/measure-motions.test.ts (6 tests | 1 failed | 5 skipped) 2660ms
   ↓ measure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   × measure-motions > reports the face box and the finger skin it read off the body 3ms
     → expected '模型　　public/avatar/AvatarSample_B_webp…' to match /指尖皮厚　18\.\dmm/
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it printed
   ↓ measure-moti
[…]
.2mm
   waistUp  往畫面右邊伸　0.5450　預算 0.7415　餘裕  196.5mm
   waistUp  手的皮膚頂端　1.8091　預算 1.8722　餘裕  63.1mm
   waistUp  髖部最低　　0.8824　下緣 0.7678　餘裕  114.6mm
   手沒進到臉裡　最近一次 2.236（要大於 1）
   頭尾站得住　髖部偏移 -4.1mm（上限 80.0mm）
── dance　（waistUp、column）
   waistUp  往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.7mm
   waistUp  往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.4mm
   waistUp  手的皮膚頂端　1.4886　預算 1.7922　餘裕  303.6mm
   waistUp  髖部最低　　0.7525　下緣 0.6878　餘裕  64.7mm
   column   往畫面左邊伸　0.6978　預算 0.7415　餘裕  43.8mm
   column   往畫面右邊伸　0.4171　預算 0.7415　餘裕  324.5mm
   column   手的皮膚頂端　1.4886　預算 1.7320　餘裕  243.5mm
   column   髖部最低　　0.7525　下緣 0.5600　餘裕  192.5mm
   手在臉裡但在放行範圍內　0.300（下限 0.290，t=8.23s）
   ⓘ 髮頂 1.7276（對舊身體量的，上緣 1.7320）。這個數字推導不出來，換身體要在瀏覽器裡重量一次。
   頭尾站得住　髖部偏移 47.1mm（上限 80.0mm）
全部動作在這具身體上都待在預算內，可以直接沿用。"
 ❯ scripts/measure-motions.test.ts:112:18
    110|     const text = shipped.lines.join('\n')
    111|     expect(text).toMatch(/臉部盒　x -0\.09\d…0\.09\d　y 1\.287…1\.503/)
    112|     expect(text).toMatch(/指尖皮厚　18\.\dmm/)
       |                  ^
    113|     // A taller body's box scales with it: derived, not carried.
    114|     expect(taller.lines.join('\n')).toMatch(/臉部盒　x -0\.12\d…0\.12\d　y …
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### V1
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/vrmHumanoid.test.ts -t rebuilds the glTF node tree
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/vrmHumanoid.test.ts (15 tests | 1 failed | 14 skipped) 9ms
   ↓ readHumanoid > reads the same bones from a VRM 1.0 map as from its 0.x twin, and says which it saw
   ↓ readHumanoid > carries the forward axis with the version
   ↓ readHumanoid > names both extensions when neither is present
   ↓ readHumanoid > lists the spec-required bones a body lacks
   ↓ readHumanoid > reads expression names from either version and refuses a file with neither
   ↓ readHumanoid > reads a .vrma map through its own extension
   ↓ readSprings > returns
[…]
3 {
    "x": 0,
    "y": 0,
    "z": 0,
  },
  "quaternion": Quaternion {
    "_onChangeCallback": [Function onQuaternionChange],
    "_w": 1,
    "_x": 0,
    "_y": 0,
    "_z": 0,
    "isQuaternion": true,
  },
  "receiveShadow": false,
  "renderOrder": 0,
  "rotation": Euler {
    "_onChangeCallback": [Function onRotationChange],
    "_order": "XYZ",
    "_x": -0,
    "_y": 0,
    "_z": -0,
    "isEuler": true,
  },
  "scale": Vector3 {
    "x": 1,
    "y": 1,
    "z": 1,
  },
  "static": false,
  "type": "Bone",
  "up": Vector3 {
    "x": 0,
    "y": 1,
    "z": 0,
  },
  "userData": {},
  "uuid": "e00828de-4665-4292-a6b0-cf3ffa790d50",
  "visible": true,
}
[31m+ Received:[39m 
null
 ❯ src/components/chat/vrmHumanoid.test.ts:166:65
    164|     expect(nodes).toHaveLength(shipped.json.nodes.length)
    165|     shipped.json.nodes.forEach((n, i) => {
    166|       for (const c of n.children ?? []) expect(nodes[c].parent).toBe(n…
       |                                                                 ^
    167|     })
    168|     expect(scene.children.map((o) => nodes.indexOf(o))).toEqual(shippe…
 ❯ src/components/chat/vrmHumanoid.test.ts:165:24
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### V2
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/vrmHumanoid.test.ts -t honours a matrix node and a scale
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/vrmHumanoid.test.ts (15 tests | 1 failed | 14 skipped) 6ms
   ↓ readHumanoid > reads the same bones from a VRM 1.0 map as from its 0.x twin, and says which it saw
   ↓ readHumanoid > carries the forward axis with the version
   ↓ readHumanoid > names both extensions when neither is present
   ↓ readHumanoid > lists the spec-required bones a body lacks
   ↓ readHumanoid > reads expression names from either version and refuses a file with neither
   ↓ readHumanoid > reads a .vrma map through its own extension
   ↓ readSprings > returns
[…]
 the BIN chunk behind a JSON chunk whose length is not a multiple of four
   ↓ parseGlb / readAccessorRows > de-strides and de-normalizes an accessor
   ↓ buildNodes > rebuilds the glTF node tree as THREE objects, parented and placed as the file says
   × buildNodes > honours a matrix node and a scale 5ms
     → expected 1 to be 2 // Object.is equality
   ↓ wiring > no file outside vrmHumanoid.ts reads the humanoid map inline
 Test Files  1 failed (1)
      Tests  1 failed | 14 skipped (15)
   Start at  16:38:58
   Duration  379ms (transform 30ms, setup 24ms, collect 45ms, tests 6ms, environment 187ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/vrmHumanoid.test.ts > buildNodes > honours a matrix node and a scale
AssertionError: expected 1 to be 2 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 2[39m
[31m+ 1[39m
 ❯ src/components/chat/vrmHumanoid.test.ts:181:30
    179|     expect(nodes[0].position.y).toBe(1)
    180|     expect(nodes[1].getWorldPosition(new THREE.Vector3()).y).toBeClose…
    181|     expect(nodes[1].scale.x).toBe(2)
       |                              ^
    182|   })
    183| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### S1
```
$ npx vitest run /Users/charles/portfolio/scripts/avatar/springsim.test.ts -t dance: the tails stay outside
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ scripts/avatar/springsim.test.ts (2 tests | 1 failed | 1 skipped) 4239ms
   × Milfy twintails through the spring solver > dance: the tails stay outside the cardigan and out of her body 4238ms
     → coat depth vs the recorded reading: expected 37 to be less than or equal to 2
   ↓ Milfy twintails through the spring solver > spin: the tails stay outside the cardigan and out of her body
 Test Files  1 failed (1)
      Tests  1 failed | 1 skipped (2)
   Start at  16:38:59
   Duration  4.69s (transform 67ms, setup 29ms, collect 90ms, tests 4.24s, environment 156ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/avatar/springsim.test.ts > Milfy twintails through the spring solver > dance: the tails stay outside the cardigan and out of her body
AssertionError: coat depth vs the recorded reading: expected 37 to be less than or equal to 2
 ❯ scripts/avatar/springsim.test.ts:61:97
     59|       if (!process.env.SPRINGSIM_TEST_MODEL) {
     60|         const pin = READINGS[clip]
     61|         expect(Math.abs(r.coatDepthMm - pin.coatDepthMm), 'coat depth …
       |                                                                                                 ^
     62|         expect(Math.abs(r.coatWorstT - pin.coatWorstT), 'worst frame v…
     63|         expect(Math.abs(r.coatWorstYaw - pin.coatWorstYaw), 'yaw at th…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### A1
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/avatarMode.test.ts -t takes her chin from the same box
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/avatarMode.test.ts (74 tests | 1 failed | 73 skipped) 11ms
   ↓ deriveAvatarMode > is idle with empty input and no stream
   ↓ deriveAvatarMode > is listening while the visitor has typed anything
   ↓ deriveAvatarMode > treats whitespace-only input as typing too (IME composition often is)
   ↓ deriveAvatarMode > is speaking for the whole streaming window, regardless of input
   ↓ avatarPlacement > stands above the launcher whenever the panel is stowed, any viewport
   ↓ avatarPlacement > stands beside the docked panel only when the v
[…]
hed
   ↓ stepFramePan > takes about a second to cover a pan, not a frame
   ↓ stepFramePan > gets there in time for the frames the pan exists for
   ↓ stepFramePan > arrives exactly, so a parked camera stops being rewritten
   ↓ stepFramePan > comes back the same way it went
   ↓ stepFramePan > covers the same ground whatever the frame rate
 Test Files  1 failed (1)
      Tests  1 failed | 73 skipped (74)
   Start at  16:39:05
   Duration  430ms (transform 57ms, setup 30ms, collect 78ms, tests 11ms, environment 165ms, prepare 37ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/avatarMode.test.ts > avatar camera framing > takes her chin from the same box rigProbe measures fingers against
AssertionError: expected 0.007256715891528209 to be less than 0.001
 ❯ src/components/chat/avatarMode.test.ts:647:68
    645|   it('takes her chin from the same box rigProbe measures fingers again…
    646|     const shipped = buildRig(new Uint8Array(readFileSync(path.join(pro…
    647|     expect(Math.abs(AVATAR_HEAD_BOTTOM_Y - shipped.faceBox.min.y)).toB…
       |                                                                    ^
    648|   })
    649| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### P1
```
$ python3 -W ignore -m unittest -q scripts.avatar.retarget_parity_test.MotionPyAlone.test_a_vrm1_twin_poses_as_the_shipped_body_turned_round
======================================================================
FAIL: test_a_vrm1_twin_poses_as_the_shipped_body_turned_round (scripts.avatar.retarget_parity_test.MotionPyAlone.test_a_vrm1_twin_poses_as_the_shipped_body_turned_round)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 103, in test_a_vrm1_twin_poses_as_the_shipped_body_turned_round
    self.assertLess(angle_deg(expected, v1[bone]), 1e-4, bone)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 13.204872149409326 not less than 0.0001 : hips
----------------------------------------------------------------------
Ran 1 test in 0.018s
FAILED (failures=1)
```

### P2
```
$ python3 -W ignore -m unittest -q scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_shipped_vrm0_body
  parity shipped: worst bone modelPose@6.58s rightThumbDistal 179.7460° (limit 0.5°)
======================================================================
FAIL: test_shipped_vrm0_body (scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_shipped_vrm0_body)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 161, in test_shipped_vrm0_body
    self.compare('shipped')
    ~~~~~~~~~~~~^^^^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 157, in compare
    self.assertLess(worst[0], MAX_DEG, f'worst bone {worst[1]}: {worst[0]:.3f}°')
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 179.74595641198243 not less than 0.5 : worst bone modelPose@6.58s rightThumbDistal: 179.746°
----------------------------------------------------------------------
Ran 1 test in 0.460s
FAILED (failures=1)
```

### P3
```
$ python3 -W ignore -m unittest -q scripts.avatar.retarget_parity_test.MotionPyAlone.test_a_thumb_track_lands_on_the_thumb_it_names
======================================================================
FAIL: test_a_thumb_track_lands_on_the_thumb_it_names (scripts.avatar.retarget_parity_test.MotionPyAlone.test_a_thumb_track_lands_on_the_thumb_it_names)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 111, in test_a_thumb_track_lands_on_the_thumb_it_names
    self.assertIn(bone, out)
    ~~~~~~~~~~~~~^^^^^^^^^^^
AssertionError: 'leftThumbIntermediate' not found in {'hips': array([-0.0529084
[…]
26223]), 'rightRingProximal': array([-0.03352494, -0.02255361,  0.66638259, -0.74451438]), 'rightRingIntermediate': array([ 0.0037074 , -0.00107594,  0.6555121 , -0.7551748 ]), 'rightRingDistal': array([ 0.00370738, -0.00107596,  0.65551223, -0.75517469]), 'rightThumbProximal': array([-0.33491623, -0.8404472 ,  0.04585709,  0.42352893]), 'rightThumbDistal': array([ 0.0285996 ,  0.7817713 , -0.01756874, -0.62266126]), 'leftUpperLeg': array([-2.03293470e-02,  7.49293045e-05, -4.15702097e-02,  9.98928741e-01]), 'leftLowerLeg': array([-0.14402298, -0.06031384,  0.00713184,  0.98770884]), 'leftFoot': array([ 1.08573007e-01, -7.67553437e-02, -1.09133853e-04,  9.91120834e-01]), 'leftToes': array([ 1.47744866e-03, -1.07778627e-08, -1.66503325e-09,  9.99998909e-01]), 'rightUpperLeg': array([-0.02932448, -0.00602629,  0.02827598,  0.99915175]), 'rightLowerLeg': array([-0.15490957, -0.01297144,  0.00410387,  0.98783497]), 'rightFoot': array([ 0.10454644,  0.01276533, -0.02023265,  0.99423223]), 'rightToes': array([ 7.84511395e-03, -3.17038114e-09,  1.03317014e-09,  9.99969227e-01])}
----------------------------------------------------------------------
Ran 1 test in 0.016s
FAILED (failures=1)
```

### P4
```
$ python3 -W ignore -m unittest -q scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_vrm1_twin
======================================================================
FAIL: test_vrm1_twin (scripts.avatar.retarget_parity_test.AgainstThreeVrm.test_vrm1_twin)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 164, in test_vrm1_twin
    self.compare('twin')
    ~~~~~~~~~~~~^^^^^^^^
  File "/Users/charles/portfolio/scripts/avatar/retarget_parity_test.py", line 152, in compare
    self.assertIn(bone, ours, f'{name}@{at:.2f} {vrm1_name}')
    ~~~~~~~~~~~~~^^^^^^^
[…]
roximal': array([0.06136353, 0.39343755, 0.02088809, 0.9170633 ]), 'rightIndexIntermediate': array([ 0.24727605, -0.35118585,  0.56374374, -0.70548994]), 'rightIndexDistal': array([-0.43633265,  0.13910025, -0.87574836,  0.1527408 ]), 'rightMiddleProximal': array([0.07797   , 0.47627081, 0.00603168, 0.87581415]), 'rightMiddleIntermediate': array([ 0.26380645, -0.41704953,  0.56002114, -0.66547139]), 'rightMiddleDistal': array([-0.47764254,  0.15556826, -0.85447597,  0.13238931]), 'rightRingProximal': array([ 0.11851566,  0.55177857, -0.01043918,  0.82546077]), 'rightRingIntermediate': array([ 0.27352015, -0.49622988,  0.5447049 , -0.61825497]), 'rightRingDistal': array([-0.5328572 ,  0.19993437, -0.81470601,  0.1111016 ]), 'rightLittleProximal': array([0.1177895 , 0.61179159, 0.0061007 , 0.78217611]), 'rightLittleIntermediate': array([ 0.29335898, -0.53573084,  0.51920516, -0.5977951 ]), 'rightLittleDistal': array([-0.56229564,  0.1999633 , -0.79281539,  0.12362057]), 'upperChest': array([-0.09534338,  0.932621  , -0.10829238, -0.33075741])} : dance@3.35 leftThumbProximal
----------------------------------------------------------------------
Ran 1 test in 0.443s
FAILED (failures=1)
```

