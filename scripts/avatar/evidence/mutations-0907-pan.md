N1 RED  restored=True
N2 RED  restored=True
N3 RED  restored=True
N4 RED  restored=True
N5 RED  restored=True
N6 RED  restored=True
N7 RED  restored=True
N8 GREEN  restored=True

| # | guard | result |
|---|---|---|
| N1 | a crownTop waiver is the ceiling the clip has to clear, so the five clips that carry one are not given a camera move nobody asked for | RED |
| N2 | a clip that fits where it stands is given no pan at all | RED |
| N3 | the crown a pan is solved against is the clip's worst over the frames it plays in, not the frame being panned (the waist-up pan is composed on the column's reading) | RED |
| N4 | the far end of the range is where her lowest hips leave the bottom edge | RED |
| N5 | the least-lift pan rounds UP to the centimetre, or the rounding puts the crown back outside | RED |
| N6 | the column takes the least lift that clears her hair; centring it would spend 9cm of her legs | RED |
| N7 | a declared pan that disagrees with the derivation is caught | RED |
| N8 | the frame-fit guard still runs against the panned frames (a formatting-only edit must NOT redden it) | GREEN |

### N1
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 29ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
g > resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:28
   Duration  638ms (transform 85ms, setup 42ms, collect 132ms, tests 29ms, environment 304ms, prepare 37ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: spin in column: expected +0 to be 0.02 // Object.is equality
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

### N2
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 25ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
lves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:29
   Duration  443ms (transform 72ms, setup 27ms, collect 108ms, tests 25ms, environment 158ms, prepare 35ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: peaceSign in waistUp: expected +0 to be -0.12 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- -0.12[39m
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

### N3
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 24ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
s a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:30
   Duration  432ms (transform 69ms, setup 27ms, collect 107ms, tests 24ms, environment 160ms, prepare 28ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in waistUp: expected -0.08 to be -0.09 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- -0.09[39m
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

### N4
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 26ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
resolves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:31
   Duration  469ms (transform 77ms, setup 25ms, collect 120ms, tests 26ms, environment 164ms, prepare 33ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in waistUp: expected -0.08 to be +0 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 0[39m
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

### N5
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 24ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
solves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:32
   Duration  421ms (transform 70ms, setup 26ms, collect 104ms, tests 24ms, environment 153ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in column: expected 0.13 to be 0.12 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 0.12[39m
[31m+ 0.13[39m
 ❯ src/components/chat/rigProbe.test.ts:522:62
    520|       for (const frame of def.placements) {
    521|         const want = panFor(CLEARANCE, name, frame, restCrown(), PAN_P…
    522|         expect(def.pan?.[frame] ?? 0, `${name} in ${frame}`).toBe(want)
       |                                                              ^
    523|       }
    524|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### N6
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 23ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
solves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:33
   Duration  447ms (transform 74ms, setup 28ms, collect 117ms, tests 23ms, environment 154ms, prepare 32ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in column: expected 0.13 to be 0.22 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- 0.22[39m
[31m+ 0.13[39m
 ❯ src/components/chat/rigProbe.test.ts:522:62
    520|       for (const frame of def.placements) {
    521|         const want = panFor(CLEARANCE, name, frame, restCrown(), PAN_P…
    522|         expect(def.pan?.[frame] ?? 0, `${name} in ${frame}`).toBe(want)
       |                                                              ^
    523|       }
    524|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### N7
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t pans by what the measurements leave room for
 RUN  v3.2.6 /Users/charles/portfolio
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 26ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
s a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  02:50:34
   Duration  440ms (transform 72ms, setup 27ms, collect 115ms, tests 26ms, environment 152ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
AssertionError: dance in waistUp: expected -0.09 to be -0.08 // Object.is equality
[32m- Expected[39m
[31m+ Received[39m
[32m- -0.08[39m
[31m+ -0.09[39m
 ❯ src/components/chat/rigProbe.test.ts:522:62
    520|       for (const frame of def.placements) {
    521|         const want = panFor(CLEARANCE, name, frame, restCrown(), PAN_P…
    522|         expect(def.pan?.[frame] ?? 0, `${name} in ${frame}`).toBe(want)
       |                                                              ^
    523|       }
    524|     }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### N8
```
$ npx vitest run /Users/charles/portfolio/src/components/chat/rigProbe.test.ts -t stays inside every frame it declares
 RUN  v3.2.6 /Users/charles/portfolio
 ✓ src/components/chat/rigProbe.test.ts (124 tests | 114 skipped) 2038ms
   ✓ bundled motions > peaceSign stays inside every frame it declares  383ms
   ✓ bundled motions > dance stays inside every frame it declares  635ms
 Test Files  1 passed (1)
      Tests  10 passed | 114 skipped (124)
   Start at  02:50:38
   Duration  2.44s (transform 68ms, setup 29ms, collect 104ms, tests 2.04s, environment 150ms, prepare 27ms)
```

