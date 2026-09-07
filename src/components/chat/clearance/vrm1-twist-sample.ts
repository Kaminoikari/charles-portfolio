// The clearance of the VRM1_Constraint_Twist_Sample family: one body, declared
// in avatarVariants.ts as `twist` and not offered to visitors.
//
// Provenance, licence and why this body rather than Seed-san:
// docs/plans/avatar-family-vrm1-twist-sample.md.
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. What is worth
// reading here is how little judgement is left in it. The first family
// accumulated its decisions over three weeks of browser sweeps; every number
// below came out of a producer instead -- `panFor` over the simulated crowns
// for the pans, measure-motions for the waivers -- and the one thing nobody
// measured on this body is the fringe.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vrm1-twist-sample.measured.gen'
import { SIMULATED } from './vrm1-twist-sample.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body, and that is a deviation from the recipe worth
  // stating rather than burying. The fringe is the gap between the topmost
  // DRAWN pixel and the topmost vertex -- outline width, alpha feathering, the
  // mesh's own thickness -- and reading it means rendering the body and looking
  // at it. Nothing renders this one: it is declared so the per-family paths have
  // a second rig to run against, and the look strip never offers it.
  //
  // So it carries the VRoid family's 1.5mm, measured 2026-09-06 on the Milfy
  // body in the same engine at the same framing. What that assumes is that the
  // renderer's outline and alpha behave the same on this body's MToon 1.0
  // materials as on the other family's VRM0 ones, which nobody has checked. The
  // error it can carry is a millimetre or two, and it lands on a body no
  // visitor sees.
  //
  // STRIP THIS the moment `twist` is offered: measure it the way the recipe
  // says (live-preview.html?mikadebug=1, column, topmost pixel above alpha 8
  // against the simulator's projected resting crown) and replace both fields.
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body: nothing renders it. Re-measure before offering it.',
  // No browser has drawn this body, so there is nothing a sweep could have seen
  // that the simulator did not. The field exists to let a rendering beat a
  // derivation; here there is no rendering.
  crownSeen: {},
  // Derived by clearance.panFor from this family's own crown and hips, then
  // declared here and held to that derivation by rigProbe.test.ts. NINE of the
  // ten need one -- every clip but peaceSign -- where the first family needs
  // three, and the reason is the body: its hair rests at 1.6154 against the
  // other family's 1.5820 (deriveRestCrown on AvatarSample_B, which is the body
  // the guards evaluate on), and the column is composed 20mm over that FIRST
  // family's resting hair, so this body starts 33.4mm into a 20mm allowance.
  //
  // THREE passes. A pan changes the projection it was derived from, so the
  // derivation is re-run until a pass changes nothing; the second pass here
  // moved spin's column two centimetres (0.07 -> 0.05) and stretch's waist-up
  // one (0.08 -> 0.07), and the third agreed everywhere. The first family
  // settled on its first pass.
  //
  // Receipt: evidence/family2-0907-pans.log is the SETTLED table, which is what
  // rigProbe.test.ts holds these to; the two intermediates above are the second
  // pass and were not kept, since re-running the probe against the declarations
  // below reproduces only the third.
  pans: {
    modelPose: { column: 0.01 },
    spin: { column: 0.05 },
    squat: { column: 0.03 },
    akimbo: { column: 0.03 },
    playFingers: { column: 0.03 },
    scratchHead: { column: 0.06 },
    idleLoop: { column: 0.03 },
    stretch: { waistUp: 0.07 },
    dance: { column: 0.14 },
  },
  // Four waivers, and none of them is an owner's acceptance of something ugly.
  // The two kinds are worth telling apart, because only one of them needs a
  // person to have looked:
  //
  //   crownTop  is a FRAMING waiver: the clip leaves the frame and the owner
  //             has decided to live with the crop. Nobody has watched this
  //             body, so it declares none, and where a pan can clear a clip the
  //             pan clears it (see `pans` above).
  //   the rest  are properties of the CLIP, measured on whatever rig it is
  //             retargeted onto. They say a clip's ends drift, or its hand
  //             passes near a face, at all — which it does on every body.
  //
  // These four are the second kind, and the first family waives the same four
  // on the same two clips. Side by side (measure-motions.ts, receipts
  // evidence/family2-0907-ends-*.log):
  //
  //                          this body   the VRoid body (waived to)
  //   dance   handInHead        0.212      0.197  (0.19)
  //   dance   hipsDrift       144.9mm    140.2mm  (150mm)
  //   dance   endWrist         1.2358     1.1877  (1.19)
  //   idleLoop hipsDrift      157.3mm    152.1mm  (160mm)
  //
  // Both drift numbers are 1.034x the first family's, and that is the ratio of
  // the two bodies' resting hips: 0.9081 here against 0.8782 there.
  // `applyMotion` scales a clip's hips track by rest height, so the same clip
  // walks 3.4% further to the side on the taller body. The deepest face frame
  // lands one 60Hz sample apart (t=8.23s here, t=8.22s there, which at
  // rigProbe.SAMPLE_HZ are neighbours). None of this is the body failing to
  // wear the clip; it is the clip, seen twice.
  //
  // Budgets are the measurement with a hair of room, the way the first family's
  // are, and rigProbe.test.ts reddens on any of them the clip stops needing.
  waivers: {
    dance: { handInHead: 0.21, hipsDrift: 0.15, endWrist: 1.24 },
    idleLoop: { hipsDrift: 0.16 },
  },
  // Nothing excluded: every clip in the pool clears this body's frames once its
  // pan is applied. A clip that could not would belong here with the
  // measurement that put it there, and `motionsFor` would stop offering it.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
