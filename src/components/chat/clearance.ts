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
  /** Widest silhouette reach toward each screen side, metres from centre. */
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
  clips: Record<string, ClipClearance>
  excluded: Record<string, string>
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
  for (const name of [...Object.keys(decisions.waivers), ...Object.keys(decisions.crownSeen)]) {
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
    clips,
    excluded: decisions.excluded,
  }
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
 * The crown a frame has to clear: the derived one, or the highest a browser
 * sweep has drawn it at, whichever is higher. The simulator runs on one body
 * of the family; a sibling with longer hair can throw it higher, and the
 * sweep of that sibling is what crownSeen records.
 */
export function crownBound(file: ClearanceFile, clip: string, frame: MotionFrame, restCrownY: number): number {
  return Math.max(crownOn(file, clip, frame, restCrownY), file.crownSeen[clip]?.[frame] ?? -Infinity)
}

/**
 * The highest this clip draws on this family, over the frames it plays in.
 *
 * Not the frame being panned: a frame has to clear the clip, and the clip's
 * crown is a property of the clip. The two frames' projections of it differ by
 * about 14mm on the dance (perspective; they sit at different distances), and
 * taking the higher is the conservative half of that. It is also where the
 * dance's own -0.08 came from: the number its comment centres on, 1.7276, is
 * the column's reading used to compose the waist-up frame.
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
  // The frame as the FILE recorded it, not as avatarMode declares it today:
  // the measurements were taken through that camera, and a composition that has
  // moved since makes them somebody else's numbers.
  const view = avatarViewSpan(file.framings.frames[frame])
  // A crownTop waiver is the owner having looked at this clip going past the
  // top edge and accepted it, so it is the ceiling the clip has to clear -- five
  // of the ten carry one, and deriving a pan against the unwaived edge would
  // give every one of them a camera move nobody asked for.
  const ceiling = c.waiver?.crownTop ?? view.top
  return {
    least: crownWorst(file, clip, restCrownY, frames) - ceiling,
    most: c.hipsLow - view.bottom,
  }
}

/**
 * The pan a clip should be given in a frame, to the centimetre the
 * compositions are dialled in.
 *
 * Zero whenever zero fits, which is every clip but one: a frame that does not
 * have to move should not move, and the eased slide in and out is a thing the
 * visitor sees. When zero does not fit, the frame's policy picks a point in
 * the range that does.
 *
 * Rounded because a pan is a camera position a person reads off a screenshot,
 * not a measurement: `least` rounds UP so the crown stays in, `centre` rounds
 * to nearest, which is where the dance's -0.08 and +0.13 come from.
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
  if (least <= 0 && 0 <= most) return 0
  const wanted = policy === 'least' ? least : (least + most) / 2
  const step = policy === 'least' ? Math.ceil : Math.round
  return step(wanted * 100) / 100
}
