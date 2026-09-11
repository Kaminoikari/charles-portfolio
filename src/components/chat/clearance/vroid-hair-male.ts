// The clearance of the VRoid hair sample, male family: one body, declared in avatarVariants.ts
// as `hair-male` and not offered to visitors.
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
import { MEASURED } from './vroid-hair-male.measured.gen'
import { SIMULATED } from './vroid-hair-male.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body. The fringe is the gap between the topmost DRAWN
  // pixel and the topmost vertex, and reading it means rendering the body and
  // looking at it; nothing renders this one. It carries the VRoid family's
  // 1.5mm, measured 2026-09-06 on the Milfy body in the same engine at the same
  // framing, on the same grounds the `twist` family carries it. STRIP THIS
  // before offering `hair-male`: measure it the way the recipe says and replace
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
  // This body's resting hair sits at 1.8067.
  pans: {
    peaceSign: { column: 0.19 },
    modelPose: { column: 0.21 },
    spin: { column: 0.25 },
    squat: { column: 0.22 },
    akimbo: { column: 0.23 },
    playFingers: { column: 0.23 },
    scratchHead: { column: 0.24 },
    idleLoop: { column: 0.23 },
    stretch: { waistUp: 0.23 },
    dance: { waistUp: 0.08, column: 0.34 },
  },
  // Properties of the CLIP as this rig wears it, not an owner accepting
  // something ugly: no one has watched this body, so it declares no crownTop
  // framing waiver. Each budget is the measurement with a hair of room, and
  // rigProbe.test.ts reddens on any the clip stops needing.
  waivers: {
    scratchHead: { handInHead: 0.95 },
    dance: { handInHead: 0.18, reach: 0.838, hipsDrift: 0.17, endWrist: 1.39 },
    spin: { reach: 0.799 },
    idleLoop: { hipsDrift: 0.18 },
  },
  // Nothing excluded: every clip clears this body's frames as they now stand.
  // `dance` did not, at one point, and it was excluded for a while on a real
  // measurement: it needed to rise 110mm in waistUp where its hips allowed 96mm.
  //
  // What brought it back inside was NOT a waiver. Only `crownTop` reaches
  // panRange at all (clearance.ts, `ceiling`), this body declares none, and the
  // four `dance` carries above are read by other guards entirely. The hips
  // figure did not move either: `most` is `hipsLow - span.bottom`, 0.8639 -
  // 0.7678 = 96mm, and nothing here can change it.
  //
  // `least` is what moved, from 110mm to 66.7mm, when this clip's COLUMN pan
  // settled at 0.34. `crownWorst` takes the worst crown across every placement
  // a clip declares, and springsim projects each crown through a camera already
  // raised by that clip's pan, so raising the column pan lowered the number the
  // waist-up frame is judged against. That is the double-count written up as
  // finding 1 in docs/plans/avatar-families-vroid-samples.md, and this
  // exclusion disappearing is an instance of it rather than a repair. If that
  // finding is ever fixed, re-derive this family before trusting this line.
  //
  // A clip that still could not fit would belong here with the measurement that
  // put it there, and `motionsFor` would stop offering it.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
