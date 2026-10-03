// The clearance of the Gishin family: one body, declared in avatarVariants.ts
// as `gishin` and offered to visitors since 2026-09-27 in the place `rosa` held.
//
// Rosa's VRoid project re-dressed in Blender on 2026-09-26 to the owner's
// reference picture and named Gishin by the owner. Three meta fields changed so
// the site may serve it (see the variant's comment), repacked with
// scripts/compress_vrm_webp.py, and scaled from crown 1.6199 to Mika's 1.582
// with scripts/avatar/scalebody.py (x0.97660). The re-dress rebuilt the
// skeleton's export, so rigOf hashes differently from every other family, and
// every number below was measured on the scaled file: evidence/gishin-0926.log.
// Since 2026-09-29 she wears Sendagaya Shino's face (scripts/avatar/
// facetransplant.py on the 0928 body, before the shorter neck of
// evidence/gishin-0929-neck.log, which the new face does not need). Her eye
// bones moved with it, so the rig hashes differently again and every number
// was measured anew: evidence/gishin-0929-face.log.
//
// Same three modules as every family (see clearance.ts): two generated halves
// that are measurements, and this one, which is decisions. Only the fringe
// below is a judgement, and it is a carried one.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-gishin.measured.gen'
import { SIMULATED } from './vroid-gishin.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // NOT measured on this body: carried from vroid-sample-b (2026-09-06,
  // 1.5mm) on the same grounds as the eleven VRoid samples. Offered on a
  // browser check of the standing look instead (see the variant's comment).
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body.',
  crownSeen: {},
  // Derived by scripts/derive-pans.ts, re-run against a re-simulated body until
  // a pass changed nothing: evidence/gishin-0926.log, and again on each body
  // since, last evidence/gishin-0929-face.log.
  pans: {
    spin: { column: 0.03 },
    scratchHead: { column: 0.04 },
    dance: { waistUp: -0.08, column: 0.12 },
    groove: { waistUp: -0.16, column: 0.02 },
    macarena: { waistUp: -0.22, column: 0.01 },
    jumpAround: { waistUp: 0.06, column: 0.32 },
    cheer: { column: 0.22 },
  },
  // Properties of the CLIP as this rig wears it; each budget is the
  // measurement with a hair of room, and rigProbe.test.ts reddens on any the
  // clip stops needing.
  // Measured 2026-09-29 with Shino's face (evidence/gishin-0929-face.log):
  // dance fingertip 0.4252 of the head volume, dance hips drift 0.1429, dance
  // end wrist 1.2147, idleLoop hips drift 0.1551.
  waivers: {
    dance: { handInHead: 0.4, hipsDrift: 0.15, endWrist: 1.22 },
    idleLoop: { hipsDrift: 0.16 },
    cheer: { hipsBelow: 0.079 },
    jumpAround: { hipsBelow: 0.018 },
    macarena: { handInHead: 0.59 },
  },
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
