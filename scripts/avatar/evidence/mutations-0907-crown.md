K1 RED  restored=True
K2 RED  restored=True
K3 RED  restored=True
K4 RED  restored=True
K5 RED  restored=True
K6 RED  restored=True
K7 RED  restored=True
K8 RED  restored=True
K9 RED  restored=True

| # | guard | result |
|---|---|---|
| K1 | a body simulated in its own right raises the family's crown | RED |
| K2 | a crownTop waiver raises the frame edge and never lowers it | RED |
| K3 | the VRoid body's own simulation is actually wired into the family file | RED |
| K4 | the geometry hash tells two bodies apart rather than returning the same digest for everything | RED |
| K5 | dance's declared pan is the one panFor derives from the raised crown | RED |
| K6 | and playFingers keeps the pan that replaced its waiver | RED |
| K7 | the report reads a waiver as a raise too, not only the two guards | RED |
| K8 | a second body simulated under another composition is refused, not averaged in | RED |
| K9 | a camera too slow to arrive before the crown does is caught | RED |

### K1
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t carries every simulated body into the crown it hands out
ly equal []
[32m- Expected[39m
[31m+ Received[39m
[32m- [][39m
[31m+ [[39m
[31m+   "peaceSign/waistUp: /avatar/mika-pink.vrm draws 1.5708, the file bounds 1.5554",[39m
[31m+   "modelPose/waistUp: /avatar/mika-pink.vrm draws 1.5920, the file bounds 1.5806",[39m
[31m+   "modelPose/column: /avatar/mika-pink.vrm draws 1.5861, the file bounds 1.5848",[39m
[31m+   "spin/waistUp: /avatar/mika-pink.vrm draws 1.6136, the file bounds 1.6036",[39m
[31m+   "spin/column: /avatar/mika-pink.vrm draws 1.6197, the file bounds 1.6185",[39m
[31m+   "playFingers/waistUp: /avatar/mika-pink.vrm draws 1.6220, the file bounds 1.5913",[39m
[31m+   "playFingers/column: /avatar/mika-pink.vrm draws 1.6143, the file bounds 1.6053",[39m
[31m+   "scratchHead/waistUp: /avatar/mika-pink.vrm draws 1.6185, the file bounds 1.5913",[39m
[31m+   "scratchHead/column: /avatar/mika-pink.vrm draws 1.6142, the file bounds 1.6068",[39m
[31m+   "stretch/waistUp: /avatar/mika-pink.vrm draws 1.8288, the file bounds 1.8159",[39m
[31m+   "dance/waistUp: /avatar/mika-pink.vrm draws 1.7244, the file bounds 1.7133",[39m
[31m+   "dance/column: /avatar/mika-pink.vrm draws 1.7389, the file bounds 1.7276",[39m
[31m+ ][39m
 ❯ src/components/chat/clearance.test.ts:203:91
    201|     }
    202|     expect(CLEARANCE.alsoSimulated.length, 'a second body was simulate…
    203|     expect(missed, 'the family hands out a crown lower than one of its…
       |                                                                                           ^
    204|   })
    205| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K2
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t lets a waiver raise a frame edge and never lower one
inside the frame it is filmed in
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a second body simulated under another composition
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   × combineClearance > lets a waiver raise a frame edge and never lower one 3ms
     → expected 0.10129999999999995 to be close to -0.16088114588426672, received difference is 0.26218114588426666, but expected 5e-10
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  14:49:42
   Duration  358ms (transform 53ms, setup 23ms, collect 77ms, tests 3ms, environment 152ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > lets a waiver raise a frame edge and never lower one
AssertionError: expected 0.10129999999999995 to be close to -0.16088114588426672, received difference is 0.26218114588426666, but expected 5e-10
 ❯ src/components/chat/clearance.test.ts:414:25
    412|     // against the waiver instead, it would ask for one it does not ne…
    413|     expect(crown).toBeLessThan(wide.top)
    414|     expect(range.least).toBeCloseTo(crown - wide.top, 9)
       |                         ^
    415|     expect(range.least).toBeLessThan(0)
    416|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K3
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t carries every simulated body into the crown it hands out
 by the time the crown gets there, not only at rest
   ↓ every body of the family, not only the one that was simulated > keeps every declared body inside the frame it is filmed in
   ↓ combineClearance > pairs two producers only on the same rig
   ↓ combineClearance > refuses a second body simulated under another composition
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   ↓ combineClearance > lets a waiver raise a frame edge and never lower one
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  14:49:43
   Duration  347ms (transform 53ms, setup 23ms, collect 79ms, tests 3ms, environment 142ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > every body of the family, not only the one that was simulated > carries every simulated body into the crown it hands out
AssertionError: a second body was simulated at all: expected 0 to be greater than 0
 ❯ src/components/chat/clearance.test.ts:202:82
    200|       }
    201|     }
    202|     expect(CLEARANCE.alsoSimulated.length, 'a second body was simulate…
       |                                                                                  ^
    203|     expect(missed, 'the family hands out a crown lower than one of its…
    204|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K4
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t is one simulation because the two VRoid bodies are one geometry
 producers only on the same rig
   ↓ combineClearance > refuses a second body simulated under another composition
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   ↓ combineClearance > lets a waiver raise a frame edge and never lower one
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  14:49:44
   Duration  523ms (transform 54ms, setup 27ms, collect 77ms, tests 167ms, environment 148ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > every body of the family, not only the one that was simulated > is one simulation because the two VRoid bodies are one geometry
AssertionError: /avatar/AvatarSample_B_webp.vrm is no longer the same mesh as /avatar/mika-pink.vrm: expected 'b5f5a9c87fd2fca7' to be 'c849ab91c4ec5384' // Object.is equality
Expected: [32m"c849ab91c4ec5384"[39m
Received: [31m"b5f5a9c87fd2fca7"[39m
 ❯ src/components/chat/clearance.test.ts:168:8
    166|     expect(pink && base, 'both VRoid variants are declared').toBeTruth…
    167|     expect(geometry(base!.url), `${base!.url} is no longer the same me…
    168|       .toBe(geometry('/avatar/mika-milfy-12.vrm'))
       |        ^
    169|     expect(PINK_SIMULATED.simulatedOn, 'and pink is the one that was s…
    170|   })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K5
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for, not by a number dialled in
e-vrm humanoid rig > flips the clip for the 0.x body it ships on
   ↓ three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the meshes the expressions move, instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows out of the face box
   ↓ three-vrm humanoid rig > finds the face by what the expressions move, not by what a mesh is called
   ↓ three-vrm humanoid rig > resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  14:49:45
   Duration  397ms (transform 64ms, setup 24ms, collect 98ms, tests 23ms, environment 145ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in waistUp: expected -0.08 to be -0.07 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- -0.07[39m
[31m+ -0.08[39m
 ❯ src/components/chat/rigProbe.test.ts:522:62
    520|       for (const frame of def.placements) {
    521|         const want = panFor(CLEARANCE, name, frame, restCrown(), PAN_P…
    522|         expect(def.pan?.[frame] ?? 0, `${name} in ${frame}`).toBe(want)
       |                                                              ^
    523|       }
    524|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K6
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for, not by a number dialled in
three-vrm humanoid rig > flips the clip for the 0.x body it ships on
   ↓ three-vrm humanoid rig > writes the pose through to the raw nodes, rest rotations included
   ↓ three-vrm humanoid rig > derives the face box from the meshes the expressions move, instead of carrying 2026-08-19 numbers
   ↓ three-vrm humanoid rig > leaves the neck rows out of the face box
   ↓ three-vrm humanoid rig > finds the face by what the expressions move, not by what a mesh is called
   ↓ three-vrm humanoid rig > resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  14:49:46
   Duration  391ms (transform 64ms, setup 24ms, collect 95ms, tests 22ms, environment 143ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: playFingers in column: expected +0 to be 0.02 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 0.02[39m
[31m+ 0[39m
 ❯ src/components/chat/rigProbe.test.ts:522:62
    520|       for (const frame of def.placements) {
    521|         const want = panFor(CLEARANCE, name, frame, restCrown(), PAN_P…
    522|         expect(def.pan?.[frame] ?? 0, `${name} in ${frame}`).toBe(want)
       |                                                              ^
    523|       }
    524|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K7
```
$ npx vitest run --root /Users/charles/portfolio scripts/measure-motions.test.ts -t lets a waiver raise the top edge it reports against, never lower it
sure-motions > reports the shipped body as fitting, waiver and all
   ↓ measure-motions > recognises the face waiver dance already ships with
   ↓ measure-motions > reports the face box and the finger skin it read off the body
   ↓ measure-motions > says no when the same clips are asked to run on a taller body
   ↓ measure-motions > counts exactly the violations it printed
   ↓ measure-motions > reports the derived crown against the top edge
   × measure-motions > lets a waiver raise the top edge it reports against, never lower it 5ms
     → expected '   waistUp  髮頂　1.8409　上緣 1.8722（已放行到 …' to match /髮頂　1\.8\d{3}　上緣 1\.8722（已放行到 1\.6200）…/
 Test Files  1 failed (1)
      Tests  1 failed | 6 skipped (7)
   Start at  14:49:46
   Duration  9.95s (transform 70ms, setup 24ms, collect 109ms, tests 9.57s, environment 141ms, prepare 25ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  scripts/measure-motions.test.ts > measure-motions > lets a waiver raise the top edge it reports against, never lower it
AssertionError: expected '   waistUp  髮頂　1.8409　上緣 1.8722（已放行到 …' to match /髮頂　1\.8\d{3}　上緣 1\.8722（已放行到 1\.6200）…/
[32m- Expected:[39m 
/髮頂　1\.8\d{3}　上緣 1\.8722（已放行到 1\.6200）　餘裕  \d/
[31m+ Received:[39m 
"   waistUp  髮頂　1.8409　上緣 1.8722（已放行到 1.6200）　餘裕 -220.9mm（模擬投影 1.5958，換到這具身體 243.6mm，瀏覽器邊緣 1.5mm）"
 ❯ scripts/measure-motions.test.ts:189:18
    187|     )
    188|     expect(line, waiverBand.lines.join('\n')).toBeDefined()
    189|     expect(line).toMatch(/髮頂　1\.8\d{3}　上緣 1\.8722（已放行到 1\.6200）　餘裕  \d…
       |                  ^
    190|   })
    191| })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K8
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t refuses a second body simulated under another composition
ed > keeps every declared body inside the frame it is filmed in
   ↓ combineClearance > pairs two producers only on the same rig
   × combineClearance > refuses a second body simulated under another composition 4ms
     → expected [Function] to throw an error
   ↓ combineClearance > refuses a missing browser fringe rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   ↓ combineClearance > lets a waiver raise a frame edge and never lower one
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  14:49:57
   Duration  484ms (transform 57ms, setup 35ms, collect 80ms, tests 5ms, environment 258ms, prepare 30ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > combineClearance > refuses a second body simulated under another composition
AssertionError: expected [Function] to throw an error
[32m- Expected:[39m 
null
[31m+ Received:[39m 
undefined
 ❯ src/components/chat/clearance.test.ts:335:8
    333|     const otherLens = { ...twin, framings: { ...twin.framings, fov: 13…
    334|     expect(() => combineClearance(measured, simulated, decisions, [oth…
    335|       .toThrow(/composition/)
       |        ^
    336|     const otherPan = { ...twin, framings: { ...twin.framings, pans: { …
    337|     expect(() => combineClearance(measured, simulated, decisions, [oth…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### K9
```
$ npx vitest run --root /Users/charles/portfolio src/components/chat/clearance.test.ts -t has the pan it needs by the time the crown gets there
inge rather than defaulting it
   ↓ combineClearance > measures the pan against the fov the file was produced under
   ↓ combineClearance > refuses a pan that its own rounding puts outside the range
   ↓ combineClearance > lets a waiver raise a frame edge and never lower one
   ↓ combineClearance > transfers a clip crown onto another body by its own resting crown
 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  14:49:58
   Duration  355ms (transform 52ms, setup 24ms, collect 72ms, tests 5ms, environment 151ms, prepare 26ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/clearance.test.ts > every body of the family, not only the one that was simulated > has the pan it needs by the time the crown gets there, not only at rest
AssertionError: a clip reaches its crown before the pan that clears it does: expected [ …(3) ] to deeply equal []
[32m- Expected[39m
[31m+ Received[39m
[32m- [][39m
[31m+ [[39m
[31m+   "playFingers/column: /avatar/mika-pink.vrm draws 1.6143 at t=4.37s, edge only 1.6121 by then",[39m
[31m+   "scratchHead/column: /avatar/mika-pink.vrm draws 1.6142 at t=1.1s, edge only 1.6053 by then",[39m
[31m+   "dance/column: /avatar/mika-pink.vrm draws 1.7389 at t=11.97s, edge only 1.7215 by then",[39m
[31m+ ][39m
 ❯ src/components/chat/clearance.test.ts:245:81
    243|       }
    244|     }
    245|     expect(late, 'a clip reaches its crown before the pan that clears …
       |                                                                                 ^
    246|   })
    247| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

