// The clearance of the Mika-in-glasses family: one body, declared in
// avatarVariants.ts as `studio` and offered to visitors since 2026-09-26.
//
// Mika's own VRoid project (R3-clean-base) restyled in VRoid Studio 2.14.0 on
// 2026-09-26 at the owner's direction: copper high ponytail, glasses, a black
// double-breasted jacket over a shirt and flared skirt, chest 0.6. Exported as
// VRM 0.0, two meta fields relaxed so the site may serve it (see the variant's
// comment), and repacked with scripts/compress_vrm_webp.py. The Studio restyle
// moved bones, so rigOf hashes differently from every other family and every
// number was measured again on this file.
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. Only the fringe
// below is a judgement, and it is a carried one.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-mika-glasses.measured.gen'
import { SIMULATED } from './vroid-mika-glasses.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body: carried from vroid-sample-b (2026-09-06,
  // 1.5mm) on the same grounds as the eleven VRoid samples. Offered on a
  // browser check of the standing look instead (see the variant's comment).
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body.',
  crownSeen: {},
  // Derived by scripts/derive-pans.ts, re-run against a re-simulated body until
  // a pass changed nothing: evidence/mika-glasses-0926.log.
  pans: {
    modelPose: { column: 0.02 },
    spin: { column: 0.06 },
    squat: { column: 0.03 },
    akimbo: { column: 0.03 },
    playFingers: { column: 0.03 },
    scratchHead: { column: 0.07 },
    idleLoop: { column: 0.03 },
    stretch: { waistUp: 0.08 },
    dance: { column: 0.16 },
  },
  // Properties of the CLIP as this rig wears it; each budget is the
  // measurement with a hair of room, and rigProbe.test.ts reddens on any the
  // clip stops needing.
  // Measured 2026-09-26: dance fingertip 0.4058 of the head volume, dance
  // hips drift 0.1463, dance end wrist 1.2440, idleLoop hips drift 0.1588.
  waivers: {
    dance: { handInHead: 0.4, hipsDrift: 0.15, endWrist: 1.25 },
    idleLoop: { hipsDrift: 0.16 },
  },
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
