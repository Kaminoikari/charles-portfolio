// The clearance of the Sendagaya Shibu family: one body, declared in avatarVariants.ts
// as `sendagaya-shibu` and not offered to visitors.
//
// One of eleven VRoid official sample avatars registered as rig families on
// 2026-09-11. Five went in first and six followed the same day, once the four
// rules they landed on were fixed rather than waived around; those, and what
// each body cost to bring in, are in docs/plans/avatar-families-vroid-samples.md
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. Only the fringe
// below is a judgement, and it is a carried one.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-sendagaya-shibu.measured.gen'
import { SIMULATED } from './vroid-sendagaya-shibu.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body. The fringe is the gap between the topmost DRAWN
  // pixel and the topmost vertex, and reading it means rendering the body and
  // looking at it; nothing renders this one. It carries the VRoid family's
  // 1.5mm, measured 2026-09-06 on the Milfy body in the same engine at the same
  // framing, on the same grounds the `twist` family carries it. STRIP THIS
  // before offering `sendagaya-shibu`: measure it the way the recipe says and replace
  // both fields.
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body: nothing renders it. Re-measure before offering it.',
  // No browser has drawn this body, so there is nothing a sweep could have seen
  // that the simulator did not.
  crownSeen: {},
  // Derived by scripts/derive-pans.ts from this family's own crown and hips, re-run
  // against a re-simulated body until a pass changed nothing. Receipt and the
  // pass count for every body measured: evidence/vroid-samples-0911-pans.log
  // (the fixed point, all fourteen families) and evidence/vroid-samples-0911.log
  // (the run that first measured the eleven, written while six were still held).
  // This body's resting hair sits at 1.6158.
  pans: {
    modelPose: { column: 0.02 },
    spin: { column: 0.06 },
    squat: { column: 0.03 },
    akimbo: { column: 0.03 },
    playFingers: { column: 0.03 },
    scratchHead: { column: 0.05 },
    idleLoop: { column: 0.03 },
    stretch: { waistUp: 0.07 },
    dance: { column: 0.14 },
  },
  // Properties of the CLIP as this rig wears it, not an owner accepting
  // something ugly: no one has watched this body, so it declares no crownTop
  // framing waiver. Each budget is the measurement with a hair of room, and
  // rigProbe.test.ts reddens on any the clip stops needing.
  waivers: {
    scratchHead: { handInHead: 0.76 },
    dance: { handInHead: 0.18, hipsDrift: 0.15, endWrist: 1.24 },
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
