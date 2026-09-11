// The clearance of the Sakurada Fumiriya family: one body, declared in avatarVariants.ts
// as `sakurada-fumiriya` and not offered to visitors.
//
// One of eleven VRoid official sample avatars registered together on
// 2026-09-11. What they are, why they are registered and not offered, what the
// eleven share and what each had to be measured for on its own:
// docs/plans/avatar-families-vroid-samples.md.
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. Only the fringe
// below is a judgement, and it is a carried one.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-sakurada-fumiriya.measured.gen'
import { SIMULATED } from './vroid-sakurada-fumiriya.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body. The fringe is the gap between the topmost DRAWN
  // pixel and the topmost vertex, and reading it means rendering the body and
  // looking at it; nothing renders this one. It carries the VRoid family's
  // 1.5mm, measured 2026-09-06 on the Milfy body in the same engine at the same
  // framing, on the same grounds the `twist` family carries it. STRIP THIS
  // before offering `sakurada-fumiriya`: measure it the way the recipe says and replace
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
  // This body's resting hair sits at 1.9216.
  pans: {
      peaceSign: { waistUp: 0.16, column: 0.3 },
      modelPose: { waistUp: 0.2, column: 0.32 },
      spin: { waistUp: 0.21, column: 0.38 },
      squat: { column: 0.34 },
      akimbo: { waistUp: 0.22, column: 0.34 },
      playFingers: { waistUp: 0.23, column: 0.34 },
      scratchHead: { waistUp: 0.24, column: 0.38 },
      idleLoop: { waistUp: 0.22, column: 0.34 },
      stretch: { waistUp: 0.37 },
      dance: { column: 0.51 },
    },
  // Properties of the CLIP as this rig wears it, not an owner accepting
  // something ugly: no one has watched this body, so it declares no crownTop
  // framing waiver. Each budget is the measurement with a hair of room, and
  // rigProbe.test.ts reddens on any the clip stops needing.
  waivers: {
      dance: { handInHead: 0.18, reach: 0.868, hipsDrift: 0.19, endWrist: 1.53, handTop: 1.874 },
      spin: { reach: 0.81, endWrist: 1.1 },
      squat: { reach: 0.743, endWrist: 1.09 },
      modelPose: { endWrist: 1.09 },
      akimbo: { endWrist: 1.11 },
      playFingers: { endWrist: 1.11 },
      scratchHead: { endWrist: 1.11 },
      idleLoop: { hipsDrift: 0.2, endWrist: 1.09 },
      stretch: { endWrist: 1.11 },
    },
  // A clip here is one this body cannot wear: its crown cannot be brought into
  // the frame before its hips leave it, at any pan. `motionsFor` stops offering
  // it. The reason carries the measurement that put it there.
  //
  // Note that `excluded` is per CLIP, not per clip and frame, so excluding one
  // drops it from every placement including any it does fit. That coarseness
  // costs nothing while no unoffered family is ever played, and it is the
  // declared behaviour of motionsFor rather than something decided here.
  excluded: {
      dance:
        "waistUp cannot hold it: needs to rise 231mm for its crown, may rise 215mm before its hips leave. Measured 2026-09-11 by scripts/derive-pans.ts. The column does hold it, at a 510mm pan, which is what this body costs to keep in one frame: she stands 1.9216 at the crown.",
    },
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
