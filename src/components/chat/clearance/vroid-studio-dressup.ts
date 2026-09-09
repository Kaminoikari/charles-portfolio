// The clearance of the VRoid Studio dress-up family: the 2026-09-09 R3-B
// export, Mika's own project taken back through Studio's dress-up path and
// re-exported as VRM 1.0. Provenance, the tear it arrived with and the repair:
// docs/reports/mika-r3-studio-2026-09-09.md, scripts/avatar/evidence/refit-0909.md.
//
// NOT REGISTERED, and the file says so rather than leaving the reader to
// notice. avatarVariants.ts does not import it, so nothing reads these numbers
// today. Two things stand in the way, and only the first is a decision:
//
//   1. The body cannot be published as it stands. rigProbe.test.ts resolves a
//      family's body from `measuredOn` under public/avatar, which is served,
//      and this repository is public; the export's own VRM meta declares
//      allowRedistribution false, modification prohibited and avatarPermission
//      onlyAuthor. Every other body here declares the opposite -- the three
//      VRoid ones say allowedUserName Everyone, the VRM1 sample says
//      allowRedistribution true -- so this would be the first file the site
//      serves against its own licence. The author of the export can change what
//      it declares; nobody else can.
//   2. `dance` in the column has no pan the derivation agrees with. See `pans`.
//
// Everything else is decided, and one field is carried rather than measured:
// see `crownFringe` below, which holds the VRoid family's reading because
// nothing renders this body. With the body placed at
// public/avatar/vroid-studio-dressup.vrm and the family added to
// AVATAR_FAMILIES, rigProbe.test.ts's per-family block runs 265 of its 266
// checks green on this rig; the one failure is the pan above. Receipt:
// scripts/avatar/evidence/family3-0909-pans.log.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-studio-dressup.measured.gen'
import { SIMULATED } from './vroid-studio-dressup.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // CARRIED, not measured, the same deviation the VRM1 sample makes and for the
  // same reason: reading the fringe means rendering the body and looking at the
  // topmost drawn pixel, and nothing renders this one. So it holds the VRoid
  // family's 1.5mm, measured 2026-09-06 on the Milfy body in the same engine at
  // the same framing.
  //
  // What that assumes here is narrower than it looks. The fringe is outline
  // width, alpha feathering and the mesh's own thickness at the crown, and this
  // body's crown is Hair_Back, a rigid VRoid hair mesh with VRoid's MToon
  // materials -- the same kind of surface the 1.5mm was read off. The error it
  // can carry is a millimetre or two on a body no visitor sees.
  //
  // STRIP THIS the moment the body is offered: measure it the way the recipe
  // says (live-preview.html?mikadebug=1, column, topmost pixel above alpha 8
  // against the simulator's projected resting crown) and replace both fields.
  crownFringe: 0.0015,
  crownFringeMeasured:
    'CARRIED from vroid-sample-b (2026-09-06, 1.5mm), not measured on this body: nothing renders it. Re-measure before offering it.',
  // No browser has drawn this body, so there is nothing a sweep could have seen
  // that the simulator did not. On this family the field is doubly quiet: the
  // simulated half is marked `rigidHair`, because none of the export's 16 spring
  // groups has weight on a vertex above the bust, so the crown is geometry the
  // humanoid poses and no spring can throw it anywhere the simulator missed.
  crownSeen: {},
  // Derived by clearance.panFor and held to that derivation by rigProbe.test.ts.
  // EIGHT of the ten need one, and the reason is the body: its hips rest at
  // 0.9081 against the VRoid family's 0.8782, 29.8mm taller, and the column is
  // composed over that first family's resting hair. (0.9081 is also where the
  // VRM1 sample's hips rest, to four decimals, which is why these eight look so
  // much like that family's nine.)
  //
  // FOUR passes, because a pan changes the projection it was derived from:
  // declare, re-run springsim, derive again, repeat. Pass 2 moved spin's column
  // 0.05 -> 0.03, stretch's waist-up 0.08 -> 0.07 and dance's column
  // 0.14 -> 0.12; pass 3 moved spin's back to 0.04 and dance's to 0.13; pass 4
  // agreed everywhere except dance.
  //
  // DANCE HAS NO FIXED POINT, and this is the second thing keeping the family
  // out of the registry. panFor takes `least`, the millimetres the frame must
  // rise, and rounds it UP to the centimetre. On this body the pan feeds back
  // into the projection only weakly -- 1.3mm of crown per centimetre of pan --
  // and `least` lands within a millimetre of the 120mm boundary: 120.6mm when
  // the file is simulated under 0.12, which rounds to 0.13, and 119.3mm under
  // 0.13, which rounds to 0.12. The round trip therefore alternates between the
  // two and settles on neither. Both shipped families sit far from a boundary
  // and converge; nothing here says the derivation is wrong, only that this body
  // lands on the knife edge.
  //
  // 0.13 is declared because it is the safe side: `least` never exceeded 120.6mm
  // under any projection measured, so 130mm keeps the crown in either way, while
  // 120mm is 0.6mm short of what its own projection asks for. rigProbe.test.ts
  // fails on it, and that failure is the honest state of this clip on this body.
  pans: {
    spin: { column: 0.04 },
    squat: { column: 0.01 },
    akimbo: { column: 0.01 },
    playFingers: { column: 0.01 },
    scratchHead: { column: 0.06 },
    idleLoop: { column: 0.01 },
    stretch: { waistUp: 0.07 },
    dance: { column: 0.13 },
  },
  // Four waivers on two clips, and all four are properties of the CLIP measured
  // on this rig rather than an owner's acceptance of something ugly. No
  // crownTop waiver: that is the framing kind, it needs a person to have watched
  // the body, and nobody has. Where a pan can clear a clip the pan clears it.
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
  // pan is applied, dance included -- its trouble is which centimetre the pan
  // rounds to, not whether one exists.
  excluded: {},
}

export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)
