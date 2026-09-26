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
  // a pass changed nothing: evidence/gishin-0926.log.
  pans: {
    spin: { column: 0.03 },
    scratchHead: { column: 0.03 },
    dance: { waistUp: -0.08, column: 0.12 },
  },
  // Properties of the CLIP as this rig wears it; each budget is the
  // measurement with a hair of room, and rigProbe.test.ts reddens on any the
  // clip stops needing.
  // Measured 2026-09-26: dance fingertip 0.4058 of the head volume, dance
  // hips drift 0.1429, dance end wrist 1.2147, idleLoop hips drift 0.1551.
  waivers: {
    dance: { handInHead: 0.4, hipsDrift: 0.15, endWrist: 1.22 },
    idleLoop: { hipsDrift: 0.16 },
  },
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
