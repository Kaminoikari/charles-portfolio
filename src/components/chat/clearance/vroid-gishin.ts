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
// On 2026-09-29 her head joint moved 10 mm down her neck
// (scripts/avatar/neckfit.py) and the body was scaled x1.0064 back to crown
// 1.582, so the rig hashes differently again and every number was measured
// anew: evidence/gishin-0929-neck.log.
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
  // a pass changed nothing: evidence/gishin-0926.log, and again on the
  // shorter-necked body, evidence/gishin-0929-neck.log.
  pans: {
    spin: { column: 0.03 },
    scratchHead: { column: 0.04 },
    dance: { column: 0.12 },
  },
  // Properties of the CLIP as this rig wears it; each budget is the
  // measurement with a hair of room, and rigProbe.test.ts reddens on any the
  // clip stops needing.
  // Measured 2026-09-29 on the shorter-necked body (evidence/gishin-0929-neck.log):
  // dance fingertip 0.4350 of the head volume, dance hips drift 0.1438, dance
  // end wrist 1.2225, idleLoop hips drift 0.1561. The wrist is the 2026-09-26
  // 1.2147 times the x1.0064 the body was scaled by to keep its crown at 1.582.
  waivers: {
    dance: { handInHead: 0.4, hipsDrift: 0.15, endWrist: 1.23 },
    idleLoop: { hipsDrift: 0.16 },
  },
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
