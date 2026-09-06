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
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 26ms
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
   Start at  03:18:21
   Duration  427ms (transform 68ms, setup 25ms, collect 104ms, tests 26ms, environment 159ms, prepare 28ms)
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
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 27ms
   ↓ rigProbe > rebuilds the shipped model rest pose it is going to measure against
   ↓ rigProbe > accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it
   ↓ rigProbe > sees a fingertip inside her skull (the retired cheekPoke pose)
   ↓ rigProbe > sees a peace sign whose palm faces away (the retired mirrored wrist twist)
   ↓ rigProbe > reports a resti
[…]
olves a 1.0 expression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  03:18:22
   Duration  417ms (transform 65ms, setup 24ms, collect 99ms, tests 27ms, environment 158ms, prepare 27ms)
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
   Start at  03:18:23
   Duration  416ms (transform 69ms, setup 26ms, collect 105ms, tests 24ms, environment 152ms, prepare 26ms)
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
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 24ms
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
   Start at  03:18:24
   Duration  426ms (transform 71ms, setup 24ms, collect 116ms, tests 24ms, environment 150ms, prepare 27ms)
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
xpression bind through the node it names to that node's mesh
   ↓ three-vrm humanoid rig > reads a finger skin radius off the mesh that covers the hand-measured margin
 Test Files  1 failed (1)
      Tests  1 failed | 123 skipped (124)
   Start at  03:18:25
   Duration  422ms (transform 75ms, setup 24ms, collect 114ms, tests 24ms, environment 149ms, prepare 27ms)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/chat/rigProbe.test.ts > bundled motions > pans by what the measurements leave room for, not by a number dialled in
Error: clearance vroid-sample-b: dance in column has no pan on the centimetre (125.6mm..322.5mm rounds to 120mm)
 ❯ panFor src/components/chat/clearance.ts:358:11
    356|   // number in a composition nobody measured.
    357|   if (pan < least - 1e-9 || pan > most + 1e-9) {
    358|     throw new Error(
       |           ^
    359|       `clearance ${file.family}: ${clip} in ${frame} has no pan on the…
    360|       `(${(least * 1000).toFixed(1)}mm..${(most * 1000).toFixed(1)}mm …
 ❯ src/components/chat/rigProbe.test.ts:521:22
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### N6
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
   Start at  03:18:26
   Duration  418ms (transform 72ms, setup 25ms, collect 108ms, tests 24ms, environment 152ms, prepare 27ms)
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
 ❯ src/components/chat/rigProbe.test.ts (124 tests | 1 failed | 123 skipped) 29ms
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
   Start at  03:18:27
   Duration  432ms (transform 74ms, setup 27ms, collect 110ms, tests 29ms, environment 152ms, prepare 25ms)
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
 ✓ src/components/chat/rigProbe.test.ts (124 tests | 114 skipped) 2087ms
   ✓ bundled motions > peaceSign stays inside every frame it declares  391ms
   ✓ bundled motions > dance stays inside every frame it declares  635ms
 Test Files  1 passed (1)
      Tests  10 passed | 114 skipped (124)
   Start at  03:18:30
   Duration  2.48s (transform 66ms, setup 25ms, collect 104ms, tests 2.09s, environment 150ms, prepare 26ms)
```

