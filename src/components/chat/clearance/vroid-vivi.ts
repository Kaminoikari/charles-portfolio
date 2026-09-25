// The clearance of the Vivi family: one body, declared in avatarVariants.ts
// as `vivi` and offered to visitors since 2026-09-25.
//
// One of eleven VRoid official sample avatars registered as rig families on
// 2026-09-11. Five went in first and six followed the same day, once the four
// rules they landed on were fixed rather than waived around; those, and what
// each body cost to bring in, are in docs/plans/avatar-families-vroid-samples.md
//
// Served at 1.12x its export since 2026-09-26: the export's crown rests at
// 1.4122, 0.17m under Mika's, and the owner asked for her to stand as tall as
// the others. scripts/avatar/scalebody.py scaled it to Mika's 1.582 as
// Vivi_webp-2.vrm, and every number below was measured again on that file.
// scalebody leaves gravityPower alone, so her hair hangs as the export's did
// at the old size (see that script's header).
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. Only the fringe
// below is a judgement, and it is a carried one.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-vivi.measured.gen'
import { SIMULATED } from './vroid-vivi.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body. The fringe is the gap between the topmost DRAWN
  // pixel and the topmost vertex, and reading it means rendering the body and
  // looking at it, and nothing rendered this one before it was offered. It carries the VRoid family's
  // 1.5mm, measured 2026-09-06 on the Milfy body in the same engine at the same
  // framing, on the same grounds the `twist` family carries it. It was offered on
  // 2026-09-25 without that measurement, on a top-edge sweep of every clip in
  // both frames instead (evidence/offer-0925-topedge.log). Measure it the way
  // the recipe says before trusting a pan that rests on it.
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body. Offered 2026-09-25 on a top-edge sweep of every clip instead (evidence/offer-0925-topedge.log).',
  // No browser sweep has recorded a crown on this body, so there is nothing it could have seen
  // that the simulator did not.
  crownSeen: {},
  // Derived by scripts/derive-pans.ts from this family's own crown and hips, re-run
  // against a re-simulated body until a pass changed nothing. Receipt and the
  // pass count for every body measured: evidence/vroid-samples-0911-pans.log
  // (the fixed point, all fourteen families) and evidence/vroid-samples-0911.log
  // (the run that first measured the eleven, written while six were still held).
  // Re-derived 2026-09-26 for the body scaled to Mika's height (see below),
  // settled on the second pass: evidence/vivi-height-0926.log. This body's
  // resting hair sits at 1.582.
  pans: {
    spin: { column: 0.02 },
    squat: { column: 0.01 },
    akimbo: { column: 0.01 },
    playFingers: { column: 0.01 },
    scratchHead: { column: 0.01 },
    idleLoop: { column: 0.01 },
    dance: { waistUp: -0.09, column: 0.11 },
  },
  // Properties of the CLIP as this rig wears it, not an owner accepting
  // something ugly: no one has watched this body, so it declares no crownTop
  // framing waiver. Each budget is the measurement with a hair of room, and
  // rigProbe.test.ts reddens on any the clip stops needing.
  // hipsDrift and endWrist are metres, so the 1.12x scale of 2026-09-26 took
  // them up with the body. Measured now: idleLoop drift 0.1507, dance drift
  // 0.1388, dance end wrist 1.1899; the budgets were 0.14, 0.13 and 1.07.
  waivers: {
    scratchHead: { handInHead: 0.55 },
    dance: { handInHead: 0.26, hipsDrift: 0.14, endWrist: 1.2 },
    idleLoop: { hipsDrift: 0.16 },
  },
  // A clip here is one this body cannot wear: its crown cannot be brought into
  // the frame before its hips leave it, at any pan. `motionsFor` stops offering
  // it. The reason carries the measurement that put it there.
  //
  // Note that `excluded` is per CLIP, not per clip and frame, so excluding one
  // drops it from every placement including any it does fit. That coarseness
  // costs nothing while no unoffered family is ever played, and it is the
  // declared behaviour of motionsFor rather than something decided here.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
