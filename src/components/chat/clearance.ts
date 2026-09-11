// What one family of bodies has been measured to do under the ten clips.
//
// Until 2026-09-06 these numbers were scattered: `crown` and `waiver` sat on
// the clip definitions (avatarMotions.ts), the face box and the finger skin
// were constants in rigProbe.ts, and the spring readings lived in a test's
// pinned table. Each was true of one body under one clip, none said which
// body, and the one that mattered most, the crown, was a browser reading with
// no producer at all. A clearance file is those numbers with their provenance:
// which rig (a sha of rigOf), which body each producer read, which commit
// wrote them.
//
// Three modules make one file:
//
//   <family>.measured.gen.ts   scripts/measure-motions.ts --write
//                              forward kinematics on the humanoid rig: reach,
//                              hands, hips, face, the ends of the clip
//   <family>.simulated.gen.ts  scripts/avatar/springsim.ts --clearance
//                              three-vrm's spring solver: the crown every
//                              clip throws the hair to, the coat, the body,
//                              the skirt, the tail joints
//   <family>.ts                by hand: the browser's fringe, the worst crown
//                              a browser sweep has drawn, the waivers, the
//                              excluded clips, and the combine() call that
//                              refuses producers run on different rigs
//
// Generated modules are rewritten whole by their producer and never edited;
// a decision is a decision and lives in the hand module. The split is what
// keeps "a waiver has to earn its place" meaningful: nothing a script writes
// can widen a guard.
import { avatarViewSpan } from './avatarMode'
import type { AvatarFraming } from './avatarMode'
import type { MotionFrame, MotionPan, MotionWaiver } from './avatarMotions'

export interface ClearanceBox {
  min: [number, number, number]
  max: [number, number, number]
}

/** measure-motions.ts: the humanoid rig under one clip, worst frame. */
export interface ClipMeasured {
  /**
   * Widest silhouette reach toward each screen side, metres from centre, each
   * joint carrying its own skin (rigProbe.silhouetteReach). Skin included since
   * 2026-09-07: before that this was the bare bone, and the frame it is checked
   * against has to clear the drawn limb.
   */
  reach: { left: number; right: number }
  /** Top of her SKIN over any hand joint. */
  skinTop: number
  /** Lowest the hips go. */
  hipsLow: number
  /** Deepest any hand joint enters the face ellipsoid (below 1 is inside), and when. */
  faceRatio: number
  faceRatioAt: number
  /** How far below her rest height the hips sit at the clip's ends. */
  endSink: number
  /** Hips sideways offset at the clip's ends. */
  hipsDrift: number
  /** Highest wrist at the clip's ends. */
  endWrist: number
}

/** springsim.ts: the spring solver under one clip, worst frame. */
export interface ClipSimulated {
  /** Topmost vertex of anything she draws, springs included, in world metres, and when. */
  crownY: number
  crownT: number
  /**
   * The same crown as the frame sees it: every vertex projected through the
   * frame's own camera (ClearanceSimulated.framings, with this clip's pan),
   * and the highest one expressed as a height on the frame's subject plane,
   * so it compares directly with avatarViewSpan().top. Higher than crownY
   * whenever the crown comes toward the camera: perspective lifts a point
   * 0.15m nearer by ~40mm at the column's distance, which is most of the
   * difference between the vertex and what the browser draws.
   */
  crownScreen: Record<MotionFrame, number>
  coatDepthMm: number
  bodyDepthMm: number
  jumpDeg: number
  skirtDepthMm: number
}

export interface ClearanceMeasured {
  family: string
  /** sha256 of vrmHumanoid.rigOf on the body measured. */
  rigSha: string
  /** Served path of the body measured. */
  measuredOn: string
  /** Commit the producer ran at. */
  producedBy: string
  faceBox: ClearanceBox
  /** How far the finger skin reaches past the synthetic fingertip joint. */
  handSkinPastTip: number
  /** Topmost vertex of anything the body draws, in bind pose. */
  restCrownY: number
  clips: Record<string, ClipMeasured>
}

/** The camera crownScreen was projected through: the engine's, at production time. */
export interface ClearanceFramings {
  fov: number
  tilt: number
  frames: Record<MotionFrame, AvatarFraming>
  /** Each clip's pan per frame, as declared when the file was produced. */
  pans: Record<string, MotionPan>
}

export interface ClearanceSimulated {
  family: string
  rigSha: string
  /** Served path of the body simulated. Need not be the body measured: same rig, own hair. */
  simulatedOn: string
  producedBy: string
  /**
   * No spring joint moves a `Hair_*` part of the body simulated, so every
   * clip's `jumpDeg` is 0 because there was no tail bone to turn, rather than
   * because none turned. Absent means the body's hair does spring. The crown
   * is unaffected either way: it is the topmost vertex of everything the
   * manifest lists and the solver runs every spring in the file regardless
   * (scripts/avatar/evidence/parts-0909.md).
   */
  rigidHair?: true
  /** Topmost vertex of anything the simulated body draws, in bind pose. */
  restCrownY: number
  /** The same, projected through each frame's camera with no pan. */
  restCrownScreen: Record<MotionFrame, number>
  /**
   * Recorded so a consumer can tell a file produced under another
   * composition from a current one: rigProbe.test.ts holds these to the
   * live constants, and a mismatch means "re-run springsim --clearance".
   */
  framings: ClearanceFramings
  clips: Record<string, ClipSimulated>
}

export interface ClearanceDecisions {
  /**
   * The one number no script produces. In the browser the topmost drawn pixel
   * (alpha > 8/255, which counts the translucent tips of hair and ornaments)
   * sits some millimetres past the topmost VERTEX: outline width, alpha
   * feathering, the mesh's own thickness. This is that gap, read at rest on
   * the simulated body in the column as (topmost pixel's height on the
   * subject plane) - restCrownScreen.column, so crownOn adds it to every
   * derived crown. Re-read when the simulated body, its materials, or the
   * renderer's outline changes.
   */
  crownFringe: number
  /** When and how crownFringe was read. */
  crownFringeMeasured: string
  /**
   * The highest a browser sweep has drawn a clip's crown at, by clip and
   * frame, on any body of the family. Recorded by hand and only ever raised
   * (a higher reading is a result, never noise to round away); rigProbe.test.ts
   * holds it at or above the derived crown.
   */
  crownSeen: Record<string, Partial<Record<MotionFrame, number>>>
  /** Guard violations shipped on purpose, by clip; each one has to be needed. */
  waivers: Record<string, MotionWaiver>
  /**
   * How far the frame slides while each clip plays, by clip and frame.
   *
   * A pan is a property of the BODY, not of the clip: it is the arithmetic in
   * panRange on this family's own crown and hips against the frame's span, so two
   * families wearing the same clip need not move the camera the same way. It
   * lived on AvatarMotionDef until 2026-09-07, which was true only while there
   * was one family; the second one lifts the column on eight clips, by 0.01 to
   * 0.14, and five of those eight are clips the first family holds still for.
   *
   * Declared as well as derived, and rigProbe.test.ts holds one to the other
   * through panHolds. The declaration has to exist first because springsim
   * projects each crown through the frame's camera WITH this clip's pan
   * applied, so the number the derivation is made of was itself made under a
   * pan. A new family starts with none, so scripts/derive-pans.ts is run over
   * the result and the body re-simulated until a pass changes nothing: the
   * VRoid family settled on its first pass, the VRM1 sample on its third, and
   * the slowest of the eleven VRoid samples on its fourth.
   *
   * What holds one to the other is NOT equality, and panHolds carries the
   * measurements that say why: `least` is a function of the pan, so the pan
   * that equals its own re-derivation need not exist on the centimetre grid.
   */
  pans: Record<string, MotionPan>
  /** Clips of the pack kept out of the pool, and the measurement that keeps them out. */
  excluded: Record<string, string>
}

export type ClipClearance = ClipMeasured & ClipSimulated & { waiver?: MotionWaiver }

export interface ClearanceFile {
  family: string
  rigSha: string
  measuredOn: string
  simulatedOn: string
  producedBy: { measureMotions: string; springsim: string }
  faceBox: ClearanceBox
  handSkinPastTip: number
  /** The simulated body's bind-pose crown: the base every clip's throw is measured from. */
  restCrownY: number
  restCrownScreen: Record<MotionFrame, number>
  framings: ClearanceFramings
  crownFringe: number
  crownFringeMeasured: string
  crownSeen: Record<string, Partial<Record<MotionFrame, number>>>
  /**
   * This family's declared pans. Not framings.pans, which is what the producer
   * USED: that one is a record of the composition a reading was taken under, so
   * a stale file can be told from a current one, and rigProbe.test.ts compares
   * the two.
   */
  pans: Record<string, MotionPan>
  clips: Record<string, ClipClearance>
  excluded: Record<string, string>
  /**
   * Other bodies of this family simulated in their own right.
   *
   * A crown is a property of the BODY, not of the rig: bodies sharing a rig
   * have their own hair. Until 2026-09-07 only one body of a family could be
   * simulated at all (springsim refused a body with no `.parts.json`), so the
   * others got a crown transferred onto them by crownOn and crownSeen carried
   * hand-swept corrections where that under-read. springsim.deriveManifest
   * lifted the restriction, and the transfer turns out to be wrong in both
   * directions -- on this family it over-reads idleLoop's column by 39.4mm and
   * under-reads playFingers' waist-up by 30.7mm (measured on the body the
   * guards use, whose resting crown is 1.5820, not on the file's own 1.5757).
   *
   * The under-reads are what matter, because the pan is shared: nothing passes
   * a body to motionPan. So the family's crown is the WORST any of its bodies
   * draws, which is what crownSeen was doing by hand for four clips.
   */
  alsoSimulated: readonly ClearanceSimulated[]
}

/**
 * One file out of the two producers and the hand decisions, or a thrown
 * error: measurements taken on two rigs, or on two families, are two bodies'
 * numbers and must not be read as one body's.
 */
export function combineClearance(
  measured: ClearanceMeasured,
  simulated: ClearanceSimulated,
  decisions: ClearanceDecisions,
  alsoSimulated: readonly ClearanceSimulated[] = [],
): ClearanceFile {
  if (measured.family !== simulated.family) {
    throw new Error(`clearance family mismatch: measured ${measured.family}, simulated ${simulated.family}`)
  }
  if (measured.rigSha !== simulated.rigSha) {
    throw new Error(
      `clearance rig mismatch: ${measured.measuredOn} (${measured.rigSha.slice(0, 12)}) and ${simulated.simulatedOn} (${simulated.rigSha.slice(0, 12)}) are not the same rig`,
    )
  }
  if (!Number.isFinite(decisions.crownFringe)) {
    throw new Error(`clearance ${measured.family}: crownFringe is not a number; read it in the browser (see ClearanceDecisions)`)
  }
  for (const other of alsoSimulated) {
    if (other.rigSha !== simulated.rigSha) {
      throw new Error(
        `clearance ${measured.family}: ${other.simulatedOn} (${other.rigSha.slice(0, 12)}) is not the rig ${simulated.simulatedOn} (${simulated.rigSha.slice(0, 12)}) was simulated on`,
      )
    }
    // crownScreen is a projection through the frame's camera WITH the clip's
    // pan applied -- changing a pan by a centimetre moved every affected
    // crownScreen here by up to 2.2mm. rigProbe.test.ts holds the primary
    // simulation to today's composition, but it reads ClearanceFile.framings,
    // which is the primary's. A second body simulated under an older framing
    // would feed stale projections straight into crownBound with nothing
    // looking at it, so the composition has to match here.
    // The pans belong in this comparison, not only the frames and the lens:
    // a pan is the last thing applied before the projection, and it is the
    // thing that actually moved on 2026-09-07.
    if (JSON.stringify(other.framings) !== JSON.stringify(simulated.framings)) {
      throw new Error(
        `clearance ${measured.family}: ${other.simulatedOn} was simulated under a different composition than ${simulated.simulatedOn}; re-run springsim --clearance on it`,
      )
    }
    for (const name of Object.keys(simulated.clips)) {
      if (!other.clips[name]) {
        throw new Error(`clearance ${measured.family}: ${other.simulatedOn} was not simulated on ${name}, so it cannot raise its crown`)
      }
    }
  }
  const clips: Record<string, ClipClearance> = {}
  for (const [name, m] of Object.entries(measured.clips)) {
    const s = simulated.clips[name]
    if (!s) throw new Error(`clearance ${measured.family}: ${name} was measured but not simulated`)
    const waiver = decisions.waivers[name]
    clips[name] = waiver ? { ...m, ...s, waiver } : { ...m, ...s }
  }
  for (const name of Object.keys(simulated.clips)) {
    if (!(name in measured.clips)) throw new Error(`clearance ${measured.family}: ${name} was simulated but not measured`)
  }
  // Every field that names clips belongs in this list. `pans` joined them on
  // 2026-09-07 and was left out until a review noticed: a pan is read by clip
  // name, so one naming a clip outside the pool is never read and nothing else
  // would say so.
  for (const name of [...Object.keys(decisions.waivers), ...Object.keys(decisions.crownSeen), ...Object.keys(decisions.pans)]) {
    if (!(name in clips)) throw new Error(`clearance ${measured.family}: a decision names ${name}, which no producer measured`)
  }
  return {
    family: measured.family,
    rigSha: measured.rigSha,
    measuredOn: measured.measuredOn,
    simulatedOn: simulated.simulatedOn,
    producedBy: { measureMotions: measured.producedBy, springsim: simulated.producedBy },
    faceBox: measured.faceBox,
    handSkinPastTip: measured.handSkinPastTip,
    restCrownY: simulated.restCrownY,
    restCrownScreen: simulated.restCrownScreen,
    framings: simulated.framings,
    crownFringe: decisions.crownFringe,
    crownFringeMeasured: decisions.crownFringeMeasured,
    crownSeen: decisions.crownSeen,
    pans: decisions.pans,
    clips,
    excluded: decisions.excluded,
    alsoSimulated,
  }
}

/**
 * How far this family slides the frame while a clip plays.
 *
 * The same answer avatarMotions.motionPan gives, for callers holding a file
 * rather than a family id: the producers, which run against a family that may
 * not be declared in the registry yet, and a first run for a new family, which
 * has no file at all and therefore no pans. Zero is the resting composition,
 * which is the right place to start a family whose crown nobody has measured.
 */
export function panOf(file: ClearanceFile | null, clip: string, frame: MotionFrame): number {
  return file?.pans[clip]?.[frame] ?? 0
}

/**
 * The highest point a clip draws on a body of this family, as a height on
 * the frame's subject plane (what avatarViewSpan().top is measured in).
 *
 * The simulator reads the crown on ONE body (the one with springs it can
 * run), and what transfers to a sibling is the throw: how far above its own
 * resting crown the clip lifts the hair, as the frame's camera sees it. Add
 * the sibling's resting crown and the browser's fringe. For the simulated
 * body itself this is exactly crownScreen[frame] + crownFringe.
 *
 * The transfer is conservative on a body whose hair springs sag at rest:
 * its bind-pose crown is above where it hangs (29mm on the VRoid body,
 * docs/plans/avatar-motion-capture.md), so the derived crown is high by that
 * much, which is the side a guard should err on.
 *
 * One approximation, measured rather than assumed: the throw is a projected
 * height while the two resting crowns are world heights, so the offset
 * between bodies is added without being projected. Over this family's actual
 * spread (6.3mm) the two ways of carrying it differ by at most 0.32mm, and by
 * 0.10mm for a crown on the axis (evidence/clearance-0906-probe-transfer.log,
 * both frames, hair tips swept ±80mm in z). That is inside the 1.5mm fringe.
 * A family whose bodies differ in height by centimetres rather than
 * millimetres would need the sibling's resting crown projected too.
 */
export function crownOn(file: ClearanceFile, clip: string, frame: MotionFrame, restCrownY: number): number {
  const c = file.clips[clip]
  if (!c) throw new Error(`clearance ${file.family} has no clip ${clip}`)
  return c.crownScreen[frame] - file.restCrownY + restCrownY + file.crownFringe
}

/**
 * The crown a frame has to clear: the worst of three readings.
 *
 * The transfer (crownOn) carries the primary simulation onto this body; each
 * `alsoSimulated` body reports its own hair directly; and `crownSeen` is the
 * highest a browser has been watched drawing it. A sibling with longer hair
 * can throw a clip higher than the simulated body does, which is what the last
 * two are for -- crownSeen by hand until 2026-09-07, and by simulation since.
 */
export function crownBound(file: ClearanceFile, clip: string, frame: MotionFrame, restCrownY: number): number {
  // crownOn first, so an unknown clip is named rather than dereferenced: every
  // alsoSimulated body is checked to cover every clip at combine time, so a
  // clip missing from one of them is a clip missing from the file.
  const transfer = crownOn(file, clip, frame, restCrownY)
  // A body simulated in its own right needs no transfer: its crownScreen is
  // already this frame's projection of its own hair. The transfer stays for a
  // body nobody has simulated, which is what `restCrownY` describes.
  const own = file.alsoSimulated.map((s) => s.clips[clip].crownScreen[frame] + file.crownFringe)
  return Math.max(transfer, file.crownSeen[clip]?.[frame] ?? -Infinity, ...own)
}

/**
 * The highest this clip draws on this family, over the frames it plays in.
 *
 * Not the frame being panned: a frame has to clear the clip, and the clip's
 * crown is a property of the clip. The two frames' projections of it differ by
 * about 14mm on the dance (perspective; they sit at different distances), and
 * taking the higher is the conservative half of that. It is also where the
 * dance's own -0.07 came from: the column's reading, 1.7389 since the VRoid
 * body was simulated in its own right, is what composes the waist-up frame.
 */
export function crownWorst(
  file: ClearanceFile,
  clip: string,
  restCrownY: number,
  frames: readonly MotionFrame[],
): number {
  return Math.max(...frames.map((f) => crownBound(file, clip, f, restCrownY)))
}

/**
 * Every pan that would fit a clip in a frame, as [least, most].
 *
 * `least` is the smallest slide that brings the clip's crown inside the top
 * edge; `most` is the largest that keeps its lowest hips inside the bottom
 * edge. Both are arithmetic on numbers the producers measured, so a second
 * family gets its pans by running this rather than by re-deriving them in a
 * comment — which is what the dance's two numbers were until 2026-09-07.
 *
 * `least > most` means no pan fits: the clip is taller than the frame, and the
 * caller has to drop it or re-cut the composition, which is what happened to
 * the dance on 2026-08-20.
 */
export function panRange(
  file: ClearanceFile,
  clip: string,
  frame: MotionFrame,
  restCrownY: number,
  frames: readonly MotionFrame[],
): { least: number; most: number } {
  const c = file.clips[clip]
  if (!c) throw new Error(`clearance ${file.family} has no clip ${clip}`)
  // The frame as the FILE recorded it, fov included, and not as avatarMode
  // declares it today: the measurements were taken through that camera, and a
  // composition that has moved since makes them somebody else's numbers.
  const view = avatarViewSpan(file.framings.frames[frame], file.framings.fov)
  // A crownTop waiver is the owner having looked at this clip going past the
  // top edge and accepted it, so it RAISES the ceiling -- three of the VRoid
  // family's ten carry one (the second family carries none), and deriving a pan
  // against the unwaived edge would give every one of them a camera move nobody
  // asked for.
  //
  // It raises and never lowers. Until 2026-09-07 it replaced the edge outright,
  // and every one of these waivers was decided on the COLUMN framing, against
  // its 1.6020 edge. Applied to the waist-up frame, whose edge is 1.8722, that
  // turned spin's 1.6200 concession into a ceiling 252mm BELOW the frame the
  // clip is filmed in. No shipped clip's waist-up crown sat in that band, so
  // nothing was ever mis-panned by it; a body 15% taller does sit in it, which
  // is how measure-motions.test.ts pins the same read in the report.
  const ceiling = Math.max(view.top, c.waiver?.crownTop ?? -Infinity)
  return {
    least: crownWorst(file, clip, restCrownY, frames) - ceiling,
    most: c.hipsLow - view.bottom,
  }
}

/**
 * How close to a range boundary counts as on it.
 *
 * Every number `panRange` reads is written by a producer that rounds to four
 * decimal places (measure-motions.ts, `round(w.hipsLow, 4)`), so a boundary
 * derived from one carries half of that last digit whatever the arithmetic
 * does afterwards. `vroid-sample-a` has a dance whose lowest hips sit on the
 * waist-up frame's bottom edge: recorded 0.7678 against an edge of 0.7678,
 * which put `most` at -0.00002. Twenty micrometres of recording noise, read as
 * "zero does not fit", centred the range and asked for a 100mm camera move on
 * a clip that rigProbe.test.ts measures as already inside the frame.
 *
 * Half the last recorded digit, so it admits exactly the rounding and nothing
 * else. It is four orders of magnitude below the centimetre these pans are
 * dialled in, so no pan a person would notice turns on it.
 */
const RECORDED = 5e-5

/**
 * The point of the range the frame's policy stands at, on the centimetre.
 *
 * Split out of `panFor` so that `panHolds` can ask for the same point without
 * inheriting the throws: `panFor` answers "what should this be", `panHolds`
 * answers "is what is written here justified", and the two have to agree on
 * where the policy points or a family could satisfy one and fail the other.
 */
function panTarget(least: number, most: number, policy: 'centre' | 'least'): number {
  if (least <= RECORDED && -RECORDED <= most) return 0
  const wanted = policy === 'least' ? least : (least + most) / 2
  const step = policy === 'least' ? Math.ceil : Math.round
  return step(wanted * 100) / 100
}

/**
 * The pan a clip should be given in a frame, to the centimetre the
 * compositions are dialled in.
 *
 * Zero whenever zero fits, which is seven of the VRoid family's ten and one of
 * the VRM1 sample's: a frame that does not
 * have to move should not move, and the eased slide in and out is a thing the
 * visitor sees. When zero does not fit, the frame's policy picks a point in
 * the range that does.
 *
 * Rounded because a pan is a camera position a person reads off a screenshot,
 * not a measurement: `least` rounds UP so the crown stays in, `centre` rounds
 * to nearest, which is where the dance's -0.07 and +0.14 come from.
 */
export function panFor(
  file: ClearanceFile,
  clip: string,
  frame: MotionFrame,
  restCrownY: number,
  policy: 'centre' | 'least',
  frames: readonly MotionFrame[],
): number {
  const { least, most } = panRange(file, clip, frame, restCrownY, frames)
  if (least > most) {
    throw new Error(
      `clearance ${file.family}: ${clip} does not fit ${frame} at any pan ` +
      `(needs to rise ${(least * 1000).toFixed(0)}mm for its crown, may rise ${(most * 1000).toFixed(0)}mm before its hips leave)`,
    )
  }
  const pan = panTarget(least, most, policy)
  // The range can be narrower than the centimetre these are dialled in, and
  // then rounding leaves it. Today's narrowest is 70mm against a 10mm step, so
  // this is a guard rather than a case: a pan outside its own range is one that
  // takes her hips off the bottom edge, and returning it quietly would put the
  // number in a composition nobody measured.
  if (pan < least - RECORDED || pan > most + RECORDED) {
    throw new Error(
      `clearance ${file.family}: ${clip} in ${frame} has no pan on the centimetre ` +
      `(${(least * 1000).toFixed(1)}mm..${(most * 1000).toFixed(1)}mm rounds to ${(pan * 1000).toFixed(0)}mm)`,
    )
  }
  return pan
}

/**
 * Why the declared pan is not justified by the measurements, or null.
 *
 * `panFor` cannot be the guard on its own, and the reason is that a pan is not
 * an input to the measurement it is checked against. springsim builds each
 * clip's camera at `lookAtY + pan` and projects the crown through it, so
 * `crownScreen` -- and therefore `least` -- is a reading taken UNDER the very
 * pan being justified. `least` is a function of the pan, not a constant the pan
 * is solved for.
 *
 * That function is decreasing and shallow: raising the camera by a centimetre
 * lowers the projected crown by less than a centimetre, because the crown sits
 * near the subject plane where the projection barely moves. So `pan === ceil(least)`
 * is an equation whose two sides chase each other, and on the centimetre grid
 * three of the fourteen families have no pan that satisfies it. AvatarSample_C's
 * spin in the column is the clearest:
 *
 *     pan 0.26  ->  least 0.26230  ->  ceil -> 0.27
 *     pan 0.27  ->  least 0.25890  ->  ceil -> 0.26
 *
 * Neither centimetre equals its own derivation, and the pair points at each
 * other for ever. But look at what the composition actually needs: at pan 0.27
 * the crown needs 0.25890 of lift and has 0.27, so 0.27 FITS. The equation was
 * never the requirement; `least <= pan` is. This asks for that instead:
 *
 *   1. the pan fits, under the measurement taken at it -- `least <= pan <= most`;
 *   2. and it is the policy's point, give or take the grid step.
 *
 * The second condition is what keeps this a guard. Without it every pan large
 * enough to clear the hair would pass, including ones that throw away a
 * quarter of her legs. One centimetre of slack is the least that admits a
 * family with no fixed point, and it is enough precisely because the
 * projection moves less than 1:1 with the pan.
 *
 * A family that DOES have a fixed point is unaffected: `pan === ceil(least)`
 * implies `least <= pan`, and its distance from the policy point is zero. All
 * five families registered before 2026-09-11 pass this unchanged, which is why
 * the shipped compositions did not have to be re-derived to bring the rest in.
 */
export function panHolds(
  file: ClearanceFile,
  clip: string,
  frame: MotionFrame,
  restCrownY: number,
  policy: 'centre' | 'least',
  frames: readonly MotionFrame[],
  declared: number,
): string | null {
  const { least, most } = panRange(file, clip, frame, restCrownY, frames)
  const mm = (v: number): string => `${(v * 1000).toFixed(1)}mm`
  if (declared < least - RECORDED) {
    return `${clip} in ${frame} pans ${mm(declared)}, and its crown needs ${mm(least)} to clear the top edge`
  }
  if (declared > most + RECORDED) {
    return `${clip} in ${frame} pans ${mm(declared)}, and its hips leave the bottom edge past ${mm(most)}`
  }
  const target = panTarget(least, most, policy)
  if (Math.abs(declared - target) > 0.01 + RECORDED) {
    return (
      `${clip} in ${frame} pans ${mm(declared)}, and the ${policy} of ${mm(least)}..${mm(most)} ` +
      `is ${mm(target)}: more than the centimetre these are dialled in`
    )
  }
  return null
}
