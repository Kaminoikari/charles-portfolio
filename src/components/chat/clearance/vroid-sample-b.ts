// The clearance of the VRoid AvatarSample_B family: the three bodies in
// avatarVariants.ts (pink, milfy, base), which share one rig
// (avatarVariants.test.ts holds every declared body to this file's rigSha).
//
// The two generated halves are measurements (see clearance.ts for who writes
// them). Everything typed here is a decision, and each one is held to a
// measurement by rigProbe.test.ts: a waiver has to be needed, a browser crown
// has to sit at or above the derived one, the fringe has to be a number.
import { combineClearance, type ClearanceDecisions } from '../clearance'
import { MEASURED } from './vroid-sample-b.measured.gen'
import { SIMULATED } from './vroid-sample-b.simulated.gen'
import { SIMULATED as PINK } from './vroid-sample-b.pink.simulated.gen'

const DECISIONS: ClearanceDecisions = {
  // Read 2026-09-06 on the Milfy body in the live-preview page (the real
  // engine, Chromium with a GPU at 60 fps, canvas 1040x900, 1.30mm per row),
  // column framing at rest: the topmost pixel with alpha > 8/255 over 16
  // frames sat at 1.5853-1.5878 on the subject plane against the simulator's
  // projected resting crown of 1.5881, so the fringe at rest is -0.3mm. The
  // same page playing `dance` (1654 frames) peaked at 1.7112 at t=11.96s
  // against the simulator's projected 1.7099 at t=11.97s: +1.3mm. The larger
  // residual, rounded up to 1.5mm (just over the 1.302mm a row is worth at
  // this framing, avatarMetresPerPixel), is what every derived crown carries.
  // Before the projection existed the same comparison read +46mm at the peak
  // and +12mm at rest: that was perspective, not fringe.
  crownFringe: 0.0015,
  crownFringeMeasured:
    '2026-09-06 live-preview.html?mikadebug=1, column, alpha > 8: rest -0.3mm, dance peak +1.3mm vs the projected crown',
  // The VRoid bodies' hair is longer than Milfy's, so where a 2026-08-20 browser
  // sweep of the VRoid body drew a crown ABOVE what the simulator derives from
  // the Milfy body, the sweep is the bound.
  //
  // Until 2026-09-07 these rows were the only crown of THEIR OWN those bodies
  // could have (they always had one transferred from the Milfy simulation by
  // crownOn), because the simulator refused a body with no `.parts.json`
  // beside it and no build wrote one for them. springsim.deriveManifest lifted
  // that, and on 2026-09-07 it WAS done: vroid-sample-b.pink.simulated.gen.ts
  // is the VRoid body's own ten clips, and it goes in as alsoSimulated so the
  // family's crown is the worst of its bodies rather than one body's plus four
  // hand corrections.
  //
  // These browser rows stay. They are what a browser actually drew, they are
  // only ever raised, and they are the only reading here that is not the
  // simulator's -- which is exactly what makes them worth keeping as a second
  // opinion on it. Three of the four now sit BELOW the VRoid body's own
  // simulated crown, which is the transfer having under-read them.
  // Every clip that sweep put above its derived crown is here; the ones it
  // drew lower are left out, because rigProbe.test refuses a hand number below
  // the derived one (a sweep that missed the peak is fixed by sweeping again,
  // not by recording a lower floor). Only ever raised by hand from a sweep.
  //
  //   dance        column +0.14 pan, worst of eighteen full sweeps 1.7276,
  //                against a derived 1.7165; the waist-up frame at -0.07 pan
  //                1.7133 against 1.7078, 88.9mm under its 1.8022 top edge.
  //                (Both browser numbers are now under the VRoid body's own
  //                simulation, 1.7389 and 1.7244, which is what the frames
  //                actually have to clear.)
  //   scratchHead  1.6068 against a derived 1.6002 (+6.6mm).
  //   playFingers  1.6053 against a derived 1.6006 (+4.7mm).
  //                (Both derived values are 0.9mm and 0.8mm lower than they
  //                read before 2026-09-07: those two clips took a +0.02 column
  //                pan, and a pan is applied before the projection.)
  //   peaceSign    1.5748 against a derived 1.5656 (+9.2mm). Still 27mm under
  //                the column's edge, so it needs no waiver; it is here
  //                because the rule is what the browser drew, not what fails.
  //
  // All from the ten-clip column sweep in docs/plans/avatar-motion-capture.md
  // ("順手量到、但沒有動的事"). The five that sweep drew LOWER than the
  // simulator derives are deliberately absent: spin 1.6053 (derived 1.6185),
  // idleLoop 1.6024 (1.6043), squat 1.5835 (1.6022), modelPose 1.5806
  // (1.5848), akimbo 1.5632 (1.6008). `stretch` plays waist-up only and its
  // high point is a hand, covered by handTop.
  crownSeen: {
    dance: { column: 1.7276, waistUp: 1.7133 },
    scratchHead: { column: 1.6068 },
    playFingers: { column: 1.6053 },
    peaceSign: { column: 1.5748 },
  },
  waivers: {
    // Measured 2026-08-19/20 on the VRoid body and re-measured 2026-09-06 on
    // pink (the measured half): a hand 0.1975 into the face ellipsoid at
    // t=8.22s, hips 0.1402 off centre at the ends, the right wrist still up at
    // 1.1877 at the end. Each is the clip's own worst case with a hair of
    // room, and rigProbe.test.ts fails any of them the clip stops needing.
    //
    // handInHead was 0.29 until 2026-09-06, from a guard that sampled the
    // clip's keyframes only. Half the pack is keyed at 30fps and the engine
    // draws the frames between, and one of those, 16ms before the key the old
    // number came from, is a third deeper. The waiver did not get looser: the
    // measurement stopped stepping over the worst frame (rigProbe.ts
    // SAMPLE_HZ, evidence/clearance-0906-probe-face.ts).
    dance: { handInHead: 0.19, hipsDrift: 0.15, endWrist: 1.19 },
    // Stands 0.1521 to one side of centre, at both ends and so throughout.
    // Its breathing lifts the crown 2.3mm past the column's top edge on the
    // base body (derived; the column is composed 20mm over resting hair).
    idleLoop: { hipsDrift: 0.16, crownTop: 1.605 },
    // The column's top edge against the two standing clips left here, against
    // a 1.6020 edge. This is the decision the 2026-08-20 sweep took by eye
    // ("超出 0.4mm 到 5mm ... 這是既有狀態 ... 沒有處理") with numbers on it:
    // spin 1.6185 and squat 1.6022 are the simulator's, where a turn brings a
    // tail toward the camera and a rise lifts it. It used to cover the other
    // route into crownBound as well -- scratchHead 1.6068 and playFingers
    // 1.6053, that sweep's own browser readings, which sit above what the
    // simulator derives for those two (1.6002 and 1.6006) because the VRoid
    // body's hair is longer -- until those two took a pan instead (below).
    //
    // What passes the edge is translucent tips (alpha > 8): the same sweep put
    // the topmost pixel above alpha 128 32mm lower in the column.
    spin: { crownTop: 1.62 },
    squat: { crownTop: 1.603 },
    // scratchHead (1.607) and playFingers (1.606) were here until 2026-09-07.
    // Both were the 2026-08-20 sweep's browser readings on the VRoid body,
    // accepted because they were a few millimetres of translucent tip. The
    // VRoid body's own simulation puts those two clips 7-9mm higher again, and
    // rather than widen a concession, they now take the +0.02 column pan
    // clearance.panFor derives. With the camera up, neither clip passes the
    // top edge at all, and rigProbe.test.ts refuses a waiver a clip does not
    // need -- which is how these two came out.
  },
  // How far the camera slides while each clip plays on THIS family. Three of
  // the ten need it; the other family needs nine, which is why these moved off
  // AvatarMotionDef on 2026-09-07. Held to clearance.panFor by rigProbe.test.ts.
  //
  // playFingers and scratchHead gained a +0.02 column pan on 2026-09-07. Neither
  // needed one while the crown came from the Milfy body. The number the guard
  // reads for playFingers in the column goes 1.6053 (the 2026-08-20 browser
  // sweep) to 1.6143, and waist-up 1.5913 (the transfer) to 1.6220, so panFor's
  // "smallest lift that clears" answers 2cm; scratchHead is the same story one
  // millimetre lower. The alternative was to widen their crownTop waivers, from
  // 1.606 to 1.6138 and from 1.607 to 1.6139, and keep the camera still -- an
  // owner's call rather than a derivation, so the derived pan is what ships
  // until that call is made.
  //
  // A static re-centre of the waist-up frame was available and was not taken.
  // With this clip in the pool the window for lookAtY is 1.2569 (`stretch`'s
  // hand at the top) to 1.3047 (these hips at the bottom): 48mm wide, so its
  // centre leaves 24mm at both edges where the pool has 63mm and 55mm today.
  // That spends eight clips' margin on this one — and 24mm is inside the range
  // the unmodelled hair swings through.
  //
  // So the frame moves for the clip instead, and the two numbers are derived,
  // not dialled. What has to fit is this clip's OWN rendered extremes: hips
  // 0.7525 at the bottom, crown 1.7276 at the top, 0.975m apart. Since
  // 2026-09-07 that derivation is clearance.panFor rather than this paragraph;
  // what follows is why each was what it was when it was written by hand, and
  // the note at the end of this comment is why panFor now answers a centimetre
  // higher in both.
  //
  //   waistUp  -0.08  centres those in the 1.104m span (midpoint 1.240, rounded
  //                   to 1.24 like every lookAtY here): 65mm under her hips,
  //                   65mm over her hair. The span had the room; it was sitting
  //                   in the wrong place.
  //   column   +0.13  the smallest pan that does not clip her hair, and so the
  //                   most leg this clip can keep: the column's spare room is
  //                   all at the BOTTOM, so every mm the frame rises is a mm of
  //                   her legs. Eighteen full-clip sweeps at this value never
  //                   reached row 0; the worst was row 3, putting crown 1.7276
  //                   4.4mm inside the 1.732 top edge. +0.12 was not swept —
  //                   that same measured crown is 5.6mm outside ITS edge, which
  //                   is why the guard reddens there. The 4.4mm is the
  //                   translucent fringe the crown threshold counts; the topmost
  //                   pixel a visitor can see stayed 36mm inside. So a
  //                   re-measure risks a red guard, not a visible cut. +0.16 is
  //                   this clip with a 34mm fringe margin and 30mm less leg;
  //                   neither setting reaches her knee, which avatarMode puts
  //                   at 0.40 in one comment and 0.43 in another — below this
  //                   frame's 0.560 bottom edge either way.
  //
  // Nothing else in the pool is touched by either number.
  //
  // The crown was MEASURED ON THE VRoid BODIES in the browser. Since 2026-09-06
  // the family's clearance file also carries what three-vrm's spring solver
  // reads on the Milfy body (scripts/avatar/springsim.ts), and rigProbe.test.ts
  // holds every clip's crown, browser or derived, whichever is higher, to
  // its frames: the swing of Milfy's twin tails, a different spring chain,
  // is simulated rather than argued about.
  //
  // 2026-09-07: both numbers moved a centimetre, and the reason is that the
  // crown they are solved against went up. The VRoid bodies (pink and the base
  // sample, one geometry between them) were simulated in their own right for
  // the first time -- springsim could not run on them until deriveManifest --
  // and they throw this clip's hair higher than anything the guard had for it
  // before: the column crown goes 1.7276 -> 1.7389 (+11.3mm) and the waist-up
  // 1.7133 -> 1.7244 (+11.1mm), both of those previous numbers being the
  // browser sweep rather than the Milfy transfer, which read lower still.
  // clearance.panFor re-derives -0.07 and +0.14 from that, and rigProbe.test.ts
  // holds these declarations to what it derives.
  pans: {
    playFingers: { column: 0.02 },
    scratchHead: { column: 0.02 },
    dance: { waistUp: -0.07, column: 0.14 },
  },
  // Measured 2026-08-19 by retargeting all the clips of the pack onto
  // AvatarSample_B_webp.vrm; kept here so nobody re-adds one on the assumption
  // that an official clip must be safe.
  excluded: {
    greeting:
      'opens with her hips at y=0.310, 0.568m below her rest height, and she rises off the floor over the first 2.4s; a fingertip is also 17.0mm inside her head across 67 frames between t=2.27s and t=7.23s. Two independent failures.',
    showFullBody:
      "reaches 0.713 toward the viewer's left against a 0.675 canvas budget, for 54 frames between t=1.42s and t=2.30s. That edge is the one over the transcript, so the cut happens in the middle of the screen: about 32px of hand disappearing for nearly a second on a 1920x1080 column.",
    shoot:
      'VRMA_04, and it SHIPPED until the probe was widened from the index fingertip to all sixteen hand joints: its right thumb crosses into her cheek for 16 frames from t=3.35s to t=3.60s, 4.9mm past the face ellipsoid. Index-only it measures 1.19 and looks clean. Do not re-add it without fixing the clip.',
  },
}

// The VRoid body (mika-pink and AvatarSample_B are the same geometry: hashing
// every attribute of every primitive gives b5f5a9c87fd2fca7 for both, one being
// a recolour of the other, so one simulation covers both -- clearance.test.ts
// holds them to that).
export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS, [PINK])
