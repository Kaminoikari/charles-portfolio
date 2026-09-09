// The clearance of the VRoid Studio dress-up family: the 2026-09-09 R3-B
// export, Mika's own project taken back through Studio's dress-up path and
// re-exported as VRM 1.0. Provenance, the tear it arrived with and the repair:
// docs/reports/mika-r3-studio-2026-09-09.md, scripts/avatar/evidence/refit-0909.md.
//
// REGISTERED and SERVED since 2026-09-09, and NOT OFFERED: avatarVariants.ts
// declares it `offered: false`, so rigProbe.test.ts resolves a body for it and
// the look strip never puts it in front of a visitor. The served copy at
// public/avatar/vroid-studio-dressup.vrm is the export with three VRM meta
// permissions rewritten by the author of the export -- allowRedistribution,
// modification and avatarPermission, which arrived false/prohibited/onlyAuthor
// and would have made this the first file the site serves against its own
// licence. Since 2026-09-10 it has also been through scripts/avatar/dressup.py
// `prepare`, which deleted the 11,940 body triangles of 31,009 that the clothes
// cover; that is why the hoodie no longer shows the camisole through it
// (scripts/avatar/evidence/cover-0910.md). Both steps and the hashes they
// changed from are recorded in public/avatar/vroid-studio-dressup.parts.json
// under `derived_from`.
//
// The cull rewrote index accessors and nothing else: every vertex attribute,
// morph target and node transform is byte-identical to the file measured below,
// so `rigSha` is unchanged. Verified twice: all 17 primitives compared
// attribute by attribute before the file was swapped, and the spring simulator
// re-run on both bodies, which wrote byte-identical clearance apart from the
// path it was told to write to.
//
// Every field below is measured on this body. The 71 checks of
// rigProbe.test.ts's per-family block all pass on this rig (the file's own
// total is 269 with three families registered -- 56 outside the block and 71
// each inside it). Receipts: scripts/avatar/evidence/family3-0909-pans.log for
// the pans, scripts/avatar/evidence/armrest-0909.md for the browser run that
// measured the crown fringe and found the rest pose bug it had to fix first.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-studio-dressup.measured.gen'
import { SIMULATED } from './vroid-studio-dressup.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // MEASURED on this body, 2026-09-09, and it is the smallest fringe any family
  // carries: half a millimetre.
  //
  // The recipe is the one clearance-0906.md wrote: live-preview.html with
  // ?model= and ?mikadebug=1, the column framing, the topmost canvas row whose
  // alpha clears 8, converted to a height through the frame's own edge
  // (camLookY + distance*tan(fov/2)) and compared with what the simulator
  // projected for the same instant. The reading that matters is the one taken
  // UNDER A CLIP: a clip owns the bones outright, so the browser and the
  // simulator are posing the same body, while at rest the engine's breathing
  // and weight shift lift her a couple of millimetres that no bind pose has.
  //
  //   dance peak   simulator 1.7198 @11.97s   browser row 25 of 2400 @11.97s
  //                                           = 1.71933..1.71982
  //
  // The 1.7198 is the projection the file carried AT THE TIME OF THE RUN, when
  // dance's column pan was still the 0.13 pass 4 had left declared. Declaring
  // 0.12 moved the camera down a centimetre and the same crown now projects to
  // 1.7211 in the generated half; the browser reading and the file are the same
  // measurement under two pans, 1.3mm apart, which is the feedback `pans`
  // describes below.
  //
  // The projection lands on that row's top edge, so the drawn crown is at most
  // 0.02mm above the topmost vertex at 0.49mm per row. Repeated at 1.17mm per
  // row (a 1000-row canvas) the same peak read row 10 = 1.71914..1.72031, whose
  // top edge is 0.51mm above. The residual did not grow with the row, which is
  // what says this body's crown carries no outline to speak of: what is left is
  // the row itself. 0.0005 is that larger bound, 0.51mm, to the tenth of a
  // millimetre. Rounding a tenth off an allowance would matter if the allowance
  // were tight; it is 25x the 0.02mm the finer run actually bounds it at, and
  // `least` is 119.6mm against a 120mm grid either way.
  //
  // The VRoid family DECLARES 1.5mm (its own larger residual, 1.3mm, rounded up
  // past a column row's worth) and this body's bound is a third of that, which
  // is a fact about the two crowns rather than a disagreement: Milfy's is a
  // spring-driven twintail with a VRoid outline on it, this one's is a short
  // rigid bob.
  //
  // Re-measure if the body, the column framing or the renderer's outline
  // changes; the number feeds `least` linearly (see `pans`).
  crownFringe: 0.0005,
  crownFringeMeasured:
    '2026-09-09 live-preview.html?mikadebug=1, column, alpha > 8: dance peak +0.02mm at 0.49mm/row and +0.51mm at 1.17mm/row vs the projected crown',
  crownSeen: {},
  // Derived by clearance.panFor and held to that derivation by rigProbe.test.ts.
  // EIGHT of the ten need one, and what decides that is the crown rather than
  // the hips. The column is composed for the VRoid family, whose resting crown
  // projects to 1.5881 against that frame's 1.6020 top edge: 13.9mm of room
  // before a clip has moved. This body's projects to 1.5994, which leaves 2.6mm,
  // so a clip that lifts the crown at all runs out of it. spin reaches 1.6321,
  // scratchHead 1.6536, dance 1.7216.
  //
  // The hips are a separate fact and belong to the waivers below, where they
  // explain why the drift measurements match the VRM1 sample's exactly.
  //
  // FIVE passes, because a pan changes the projection it was derived from:
  // declare, re-run springsim, derive again, repeat. Pass 2 moved spin's column
  // 0.05 -> 0.03, stretch's waist-up 0.08 -> 0.07 and dance's column
  // 0.14 -> 0.12; pass 3 moved spin's back to 0.04 and dance's to 0.13; pass 4
  // agreed everywhere except dance, which alternated.
  //
  // DANCE ALTERNATED UNTIL THE FRINGE WAS MEASURED. panFor takes `least`, the
  // millimetres the frame must rise, and rounds it UP to the centimetre. The
  // crown feeds back into its own projection only weakly here -- 1.3mm per
  // centimetre of pan -- so `least` sat within a millimetre of the 120mm
  // boundary and fell on either side of it depending on which pan the file had
  // been simulated under: 120.6mm under 0.12, which rounds to 0.13, and 119.3mm
  // under 0.13, which rounds back to 0.12. Neither was a fixed point.
  //
  // `crownFringe` enters `least` linearly, and it was the one field still
  // carried from another body (1.5mm). Measured on this body it is 0.5mm, a
  // millimetre less, and that is the millimetre the round trip was short of:
  // pass 5 derives 0.12 from a file simulated under 0.12, with `least` at
  // 119.6mm. Receipt: evidence/family3-0909-pans.log, the pass-5 table.
  pans: {
    spin: { column: 0.04 },
    squat: { column: 0.01 },
    akimbo: { column: 0.01 },
    playFingers: { column: 0.01 },
    scratchHead: { column: 0.06 },
    idleLoop: { column: 0.01 },
    stretch: { waistUp: 0.07 },
    dance: { column: 0.12 },
  },
  // Four waivers on two clips, and all four are properties of the CLIP measured
  // on this rig rather than an owner's acceptance of something ugly. No
  // crownTop waiver: that is the framing kind, and the 2026-09-09 browser run
  // that measured the fringe watched `dance` end to end through the column at
  // 0.49mm per row without the crown ever reaching the top edge
  // (evidence/armrest-0909.md). Where a pan can clear a clip the pan clears it.
  //
  // THREE of the four measurements are IDENTICAL to the VRM1 sample's, to four
  // decimals, which is not a coincidence and is worth stating because it looks
  // like one.
  // applyMotion scales a clip's hips track by rest height, and these two bodies
  // rest their hips at the same 0.9081, so the same clip walks the same distance
  // on both. Against the VRoid family (hips 0.8782, ratio 1.0340):
  //
  //                          this body   VRM1 sample   the VRoid body
  //   dance   hipsDrift       144.9mm       144.9mm       140.2mm
  //   dance   endWrist         1.2358        1.2358        1.1877
  //   idleLoop hipsDrift      157.3mm       157.3mm       152.1mm
  //
  // handInHead is the fourth and the exception: 0.406 here against the VRM1
  // sample's 0.212 and the VRoid body's 0.197. The hand reaches the same place;
  // the face it reaches into is a different shape, and this one's is a Studio
  // re-export. It is measured twice over, which is why both halves matter --
  // `faceRatio` in the generated half, where measure-motions compares it against
  // this waiver as a floor, and again live in rigProbe.test.ts off the rig.
  //
  // Budgets are the measurement with a hair of room, and rigProbe.test.ts
  // reddens on any of them the clip stops needing.
  waivers: {
    dance: { handInHead: 0.4, hipsDrift: 0.15, endWrist: 1.24 },
    idleLoop: { hipsDrift: 0.16 },
  },
  // Nothing excluded. Every clip in the pool clears this body's frames once its
  // pan is applied.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
