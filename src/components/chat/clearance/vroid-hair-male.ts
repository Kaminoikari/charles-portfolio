// The clearance of the VRoid hair sample, male family: one body, declared in avatarVariants.ts
// as `hair-male` and not offered to visitors.
//
// One of five VRoid official sample avatars registered together on 2026-09-11,
// out of eleven that were measured. What they are, why they are registered and
// not offered, and why the other six are held back:
// docs/plans/avatar-families-vroid-samples.md.
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
  // Derived by clearance.panFor from this family's own crown and hips, re-run
  // against a re-simulated body until a pass changed nothing. Receipt and the
  // pass count for every body measured: evidence/vroid-samples-0911.log.
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
  // Nothing excluded: every clip clears this body's frames once its pan and its
  // waivers are applied. `dance` did NOT, before the waivers: it needed to rise
  // 110mm in waistUp where the hips allowed 96mm, and it was excluded for a
  // while on that measurement. Raising the frame's ceiling by the crownTop the
  // clip actually needs brought it back inside, and re-deriving confirms it
  // (0 pans differ, no clip reported unfittable). A clip that still could not
  // fit would belong here with the measurement that put it there, and
  // `motionsFor` would stop offering it.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
