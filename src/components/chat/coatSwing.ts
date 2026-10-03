import * as THREE from 'three'
import { motionsWornBy, type AvatarMotionName } from './avatarMotions'
import { COAT_SWING_CURVES } from './coatSwing.gen'

/**
 * A coat that bells out over her hips swallows her hands whenever a clip puts
 * them there: milfy's hoodie hangs up to 19cm outside where catwalk rests her
 * hands on her hips, so through three stretches of the clip her hands vanish
 * into it (owner, 2026-10-03: "the hands go through the coat"), and every
 * other clip she wears does the same somewhere. The clip is
 * the same file on every body; only this body's coat is in the way.
 *
 * While such a clip plays on such a body, both upper arms turn out from her
 * sides by the least angle that brings the hands out over the coat, and only
 * when they need it: the angle is measured offline per key
 * (scripts/derive-coat-swing.ts, rigProbe.handInGarment) and baked into
 * coatSwing.gen.ts, keyed by the body's file, so a re-exported body has no
 * curve until it is measured again.
 */
export interface CoatSwing {
  /** The body's file, as avatarVariants lists it. */
  url: string
  /** The coat's material: its triangles skinned to her trunk are the coat. */
  material: string
  clips: readonly AvatarMotionName[]
}

// Every clip she wears: measured 2026-10-03, each one puts a hand more than
// COAT_HAND_DEPTH into milfy's coat somewhere (squat least, 32mm; dance most,
// 275mm), and the owner asked for all of them.
export const COAT_SWINGS: readonly CoatSwing[] = [
  { url: '/avatar/mika-milfy-13.vrm', material: 'Mellow_Outer', clips: motionsWornBy('vroid-sample-b') },
]

/**
 * How deep a hand may stay inside the coat, in metres (rigProbe.handInGarment).
 * Not 0: with her arms well out, the coat's front edge still crosses a
 * fingertip or the heel of a hand by up to 16mm as it swings past.
 */
export const COAT_HAND_DEPTH = 0.02

/** Seconds of clip between two keys of a curve. */
export const COAT_SWING_STEP = 0.25

/** Degrees per key, from the clip's first frame, for this body and clip; null when the coat is not in the way. */
export function coatSwingCurve(url: string | null, clip: AvatarMotionName | null): readonly number[] | null {
  if (!url || !clip) return null
  return COAT_SWING_CURVES[url]?.[clip] ?? null
}

/** The curve at `t` seconds into its clip, in degrees, straight between keys and held past the last. */
export function coatSwingAt(curve: readonly number[], t: number): number {
  if (curve.length === 0) return 0
  const x = Math.max(0, t / COAT_SWING_STEP)
  const i = Math.floor(x)
  if (i >= curve.length - 1) return curve[curve.length - 1]
  return curve[i] + (curve[i + 1] - curve[i]) * (x - i)
}

const swing = new THREE.Quaternion()
const forward = new THREE.Vector3()

/**
 * Turn both upper arms out from her sides by `degrees`, about the axis she
 * faces along, on top of whatever the clip wrote. A VRM 0.x body faces the
 * other way in its normalized space, so the axis flips with it.
 */
export function swingArmsOut(bone: (name: string) => THREE.Object3D | null | undefined, version: string, degrees: number): void {
  if (degrees === 0) return
  forward.set(0, 0, version === '0' ? -1 : 1)
  const rad = THREE.MathUtils.degToRad(degrees)
  for (const [name, side] of [['leftUpperArm', 1], ['rightUpperArm', -1]] as const) {
    bone(name)?.quaternion.premultiply(swing.setFromAxisAngle(forward, rad * side))
  }
}

/**
 * swingArmsOut for a bone that is turned every frame. three's mixer writes a
 * bone only when its blended value changed since the last frame
 * (PropertyMixer.apply): a frame with no time step, or a clip holding a key,
 * leaves the bone as this left it, turn included, and turning it again would
 * pile one turn on another. So the turn put on last frame comes back off
 * first wherever the bone still holds exactly what it was left at.
 */
export function armSwing(): (bone: (name: string) => THREE.Object3D | null | undefined, version: string, degrees: number) => void {
  const left = new Map<THREE.Object3D, { before: THREE.Quaternion; after: THREE.Quaternion }>()
  return (bone, version, degrees) => {
    for (const [b, q] of left) if (b.quaternion.equals(q.after)) b.quaternion.copy(q.before)
    left.clear()
    if (degrees === 0) return
    const before = new Map<THREE.Object3D, THREE.Quaternion>()
    for (const name of ['leftUpperArm', 'rightUpperArm']) {
      const b = bone(name)
      if (b) before.set(b, b.quaternion.clone())
    }
    swingArmsOut(bone, version, degrees)
    for (const [b, q] of before) left.set(b, { before: q, after: b.quaternion.clone() })
  }
}
