// Framework-free engine for the 3D avatar guide (mirrors the faceHero.ts
// pattern: a React shell mounts a canvas, this module owns everything inside).
//
// Loads a VRM humanoid and drives it from AvatarMode:
//   idle      → head holds the viewer, with a slow drift (bone rotation, never
//               translation); looking away is the `glance` idle act's job
//   listening → head tilts up/down
//   speaking  → mouth animates + albedo tint toward mars orange, lerped back
//               once the stream ends
//
// Layered on top of the modes (2026-08-14 表演力升級 Batch 1):
//   - lip sync: a playing voice clip drives frame-accurate visemes from its
//     pre-generated VOICEVOX mora timeline, sampled at the audio element's
//     currentTime (no runtime audio analysis, no Web Audio); without a clip,
//     speaking falls back to the original uneven random viseme loop
//   - emotion layer: VRM expression presets per cue, smooth in/hold/out
//   - gestures: procedural bow/nod, additive over the mode pose
//   - life: breathing, slow weight shift, eye saccades, 12% double blinks
//
// Perception & idle life (Batch 3):
//   - head-pat: AvatarGuide detects strokes across her head and triggers a
//     happy wiggle — silent by design, and it never intercepts the click
//   - idle acts: 16 varieties, picked at random roughly every 5s of undisturbed
//     idle. Eight are named poses added 2026-08-14 (double and single peace
//     signs, poking her own cheeks, a salute, pointing at the viewer, hands
//     behind her head, a hand on her hip, and that hand-on-hip plus a wave),
//     each parked at its full pose for 3.5s so a viewer can read it; the rest
//     are the smaller beats (head tilt, glance, palm check, weight shift,
//     bounce, hair touch, hip twist, floor peek). The bar every one of them has
//     to clear: a viewer can say what it is. `stretch`, `armSwing` and
//     `deepBreath` were all cut for failing it, the last two because their peak
//     is under 0.12rad and reads as the resting pose.
//
// Rendering & entrance (Batch 2):
//   - ACESFilmic tone mapping (exposure-compensated) at DPR ≤2; low cyan fill
//     light; fake radial contact shadow at her feet (no shadow-map pass)
//   - MToon parametric rim in mars orange, swelling while she answers — the
//     body multiply-tint is halved so the rim carries the answering look
//   - materialize entrance, once, from the first rendered frame: cyan flash
//     (>1 channels overdrive under ACES — glow without bloom/EffectComposer,
//     which stays a Non-goal), back-out scale pop, rising particle column
//
// Learned in the PoC (scratchpad/poc.html, 2026-08-13) and load-bearing here:
//   - three-vrm normalises VRM0 blendshape names to VRM1: a/i/u/e/o become
//     aa/ih/ou/ee/oh. `blink` keeps its name, which makes half-working
//     expressions look like a mouth bug instead of a naming bug.
//   - VRM0 rest pose is a T-pose; upper-arm Z rotation brings the arms down.
//   - spring bones (hair, skirt) only advance inside vrm.update(dt).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import {
  ARM_GESTURE_PEAKS,
  ARM_REST_FORE_Z,
  ARM_REST_UPPER_Z,
  armAt,
  EMOTION_RECIPES,
  emotionChannelValues,
  FACE_PALE_TINT,
  gestureEnvelope,
  AVATAR_CAMERA_TILT,
  AVATAR_FOV,
  AVATAR_FRAMING_DEFAULT,
  headAim,
  stepHeadAim,
  type ArmGestureName,
  type AvatarMode,
  type EmotionName,
} from './avatarMode'
import { sampleViseme } from './visemeTrack'
import { VISEME_NAMES, type VisemeTrack } from './voiceVisemes.gen'

// The emotion vocabulary and its channel recipes live in avatarMode (pure data,
// unit-tested); this re-export keeps the engine the import point for callers.
export type { EmotionName } from './avatarMode'
// bow/nod are cue-driven (ChatWidget's CUE_PERFORMANCE); wiggle is the
// head-pat response; the rest is the idle-act pool that fires on its own during
// undisturbed idle (see IDLE_ACTS).
//
// The arm half of the union comes from avatarMode's ARM_GESTURE_PEAKS, so every
// gesture that moves an arm necessarily has a peak pose the canvas-width test
// can see. Adding one here without adding it there is a type error.
export type GestureName =
  | ArmGestureName
  | 'bow'
  | 'nod'
  | 'wiggle'
  | 'tilt'
  | 'glance'
  | 'swayStep'
  | 'bounce'
  | 'hipTwist'
  | 'toeLook'

export type AvatarGuideHandle = {
  setMode: (mode: AvatarMode) => void
  // Rendering gate for "mounted but not visible" (e.g. fullscreen chat covers
  // the avatar). Keeps the engine warm so no VRM reload on the way back.
  setActive: (active: boolean) => void
  // Frame-accurate lip sync: while `audio` is playing, visemes are sampled
  // from `track` at audio.currentTime (the element's own clock — no Web Audio,
  // so the hard-won iOS rules are untouched). Pass nulls to detach; a paused
  // or ended element detaches itself.
  setSpeech: (audio: HTMLAudioElement | null, track: VisemeTrack | null) => void
  setEmotion: (name: EmotionName, weight?: number, holdSec?: number) => void
  playGesture: (name: GestureName) => void
  // Camera dolly for a placement that gets a taller canvas. Pass the distance
  // and the height the camera looks at; the tilt is preserved. Keeping
  // `distance / canvas height` constant keeps her on-screen size constant, so
  // a taller canvas shows more of her instead of scaling her up.
  setFraming: (distance: number, lookAtY: number) => void
  dispose: () => void
}

// Multiply-tint target while answering; reads as #E8652B over the sample's
// mostly-light albedo without crushing dark materials to black.
const ANSWER_TINT = new THREE.Color(1.0, 0.62, 0.38)


type BoneName = Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0]
// VRM0 rest pose is a T-pose; these Z rotations bring the arms down. Every arm
// gesture borrows these bones and must restore these EXACT values — they are
// the single source of truth for the rest pose.
const ARM_PINS: ReadonlyArray<readonly [BoneName, number]> = [
  ['leftUpperArm', ARM_REST_UPPER_Z],
  ['rightUpperArm', -ARM_REST_UPPER_Z],
  ['leftLowerArm', ARM_REST_FORE_Z],
  ['rightLowerArm', -ARM_REST_FORE_Z],
  ['leftHand', 0],
  ['rightHand', 0],
]

// Finger bones, all 30 of them (this model carries the full VRM0 set). They
// rest at identity and the hand poses below rotate them, so the restore has to
// cover them too: pinArms is the ONLY thing that undoes a gesture, and a bone
// it does not list stays wherever the gesture left it for the rest of the page.
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const
const FINGER_SEGMENTS = ['Proximal', 'Intermediate', 'Distal'] as const
type FingerName = (typeof FINGERS)[number]

function fingerBones(side: 'left' | 'right', finger: FingerName): BoneName[] {
  return FINGER_SEGMENTS.map((seg) => `${side}${finger}${seg}` as BoneName)
}

function pinArms(v: VRM) {
  for (const [name, z] of ARM_PINS) {
    const b = v.humanoid?.getNormalizedBoneNode(name)
    if (b) b.rotation.set(0, 0, z)
  }
  for (const side of ['left', 'right'] as const) {
    for (const finger of FINGERS) {
      for (const name of fingerBones(side, finger)) {
        const b = v.humanoid?.getNormalizedBoneNode(name)
        if (b) b.rotation.set(0, 0, 0)
      }
    }
  }
}

// How far each finger curls toward the palm, as a fraction of a full fist.
// Curling is -Z on the left hand and +Z on the right — the OPPOSITE mirror to
// the arm pins. The first draft reused the arm sign and every "curled" finger
// hyperextended backward out of the hand; nobody saw it until a phone-scale
// closeup, because from the front a finger bent back hides almost as well as
// one folded in.
interface HandPose {
  curl: Record<FingerName, number>
  // Sideways splay on the proximal joint. Two straight fingers side by side
  // render as one thick finger at the size she is actually seen at, so a V that
  // does not splay reads as a point — checked on the 807px fullscreen canvas.
  spread?: Partial<Record<FingerName, number>>
  // Twist of the wrist about the forearm axis, radians, mirrored like the rest.
  // A raised forearm leaves the palm facing her own head, which turns a V's
  // splay into pure depth — from the front the two fingers eclipse each other
  // and the sign reads as ONE finger. The twist turns the palm to the camera.
  wrist?: number
}
const HAND_OPEN: HandPose = { curl: { Thumb: 0, Index: 0, Middle: 0, Ring: 0, Little: 0 } }
// Two fingers up, the rest folded away. The thumb only half-curls: folded flat
// it disappears into the palm and the silhouette stops reading as a V.
const HAND_PEACE: HandPose = {
  curl: { Thumb: 0.6, Index: 0, Middle: 0, Ring: 1, Little: 1 },
  spread: { Index: 0.55, Middle: -0.55 },
  wrist: -1.0,
}
// One finger out, for pointing and for poking her own cheeks.
const HAND_POINT: HandPose = { curl: { Thumb: 0.5, Index: 0, Middle: 1, Ring: 1, Little: 1 } }

// A loose hand, for poses where the fingers are not the point.
const HAND_RELAXED: HandPose = {
  curl: { Thumb: 0.2, Index: 0.25, Middle: 0.3, Ring: 0.35, Little: 0.4 },
}
// Fingers spread over the hip bone, closer to flat than to a fist.
const HAND_HIP: HandPose = {
  curl: { Thumb: 0.3, Index: 0.2, Middle: 0.2, Ring: 0.25, Little: 0.3 },
}

// A full fist is about 1.6rad per joint; the poses above are fractions of it.
const FINGER_FULL_CURL = 1.6

function setHand(v: VRM, side: 'left' | 'right', pose: HandPose, amount: number) {
  const mirror = side === 'left' ? 1 : -1
  for (const finger of FINGERS) {
    // The thumb sits rotated ~90° from the fingers in the rest pose, so folding
    // it across the palm is a rotation about y where the fingers fold on z; on
    // z it hyperextends sideways out of the hand, the "chicken foot" of the
    // first draft. It also folds on a shallower arc, or it clips the fingers.
    const scale = finger === 'Thumb' ? 0.55 : 1
    // The thumb's y fold takes the OPPOSITE mirror to the fingers' z curl:
    // +mirror against their -mirror. Settled per hand on closeups — each wrong
    // sign rotates that thumb out of the fist to hang sideways off the hand,
    // which is exactly what the owner flagged on the peace signs.
    const angle =
      (finger === 'Thumb' ? mirror : -mirror) * pose.curl[finger] * amount * FINGER_FULL_CURL * scale
    const bones = fingerBones(side, finger)
    for (const name of bones) {
      const b = v.humanoid?.getNormalizedBoneNode(name)
      if (!b) continue
      if (finger === 'Thumb') b.rotation.y = angle
      else b.rotation.z = angle
    }
    // Splay lives on the proximal joint only — the knuckle is where a finger
    // actually spreads; putting it on every segment bows the finger sideways.
    const spread = pose.spread?.[finger]
    if (spread !== undefined) {
      const b = v.humanoid?.getNormalizedBoneNode(bones[0])
      if (b) b.rotation.y = mirror * spread * amount
    }
  }
  if (pose.wrist !== undefined) {
    const b = v.humanoid?.getNormalizedBoneNode(`${side}Hand` as BoneName)
    if (b) b.rotation.x = mirror * pose.wrist * amount
  }
}

// ---- gesture / idle-act library --------------------------------------------
// Every gesture is a pure per-frame function: p ∈ [0,1] is progress, env is
// the sin(pπ) ease envelope, v ∈ {-1, 1} picks a random side per trigger, and
// offsets accumulate into `o` (ADDED to the mode-driven pose downstream).
// Arm-touching gestures write the arm bones directly — absolute values based
// on ARM_PINS — and are flagged `arms` so completion AND interruption restore
// the pins exactly. Table-driven because a 15-branch if-chain stopped reading.
type GestureOffsets = {
  hp: number // head pitch (+ looks down)
  hy: number // head yaw (+ turns to her left)
  hr: number // head roll
  sx: number // spine pitch
  sy: number // spine yaw
  sz: number // spine roll
  cx: number // chest pitch (adds to breathing)
  ex: number // eye-target x offset
  ey: number // eye-target y offset
}

type GestureDef = {
  // Seconds of MOVEMENT: the rise and the fall, half of `dur` each.
  dur: number
  // Seconds spent parked at full envelope between the two. A named pose is a
  // pose, and `sin(p·π)` alone touches its peak for a single frame, which reads
  // as the gesture bouncing off something. The ambient beats leave this at 0
  // and keep the pure sine they were tuned with.
  hold?: number
  arms?: boolean
  // Which ARM_GESTURE_PEAKS entry this gesture poses to. Present on every arm
  // gesture, because that table is what the canvas-width test reads: a gesture
  // that reached the peak by writing its own literals would be invisible to it
  // and would clip at the canvas edge with the suite green.
  peak?: ArmGestureName
  apply: (vrm: VRM, p: number, env: number, v: number, o: GestureOffsets) => void
}

const bone = (v: VRM, n: BoneName) => v.humanoid?.getNormalizedBoneNode(n)

// Drive one arm from its rest pin toward a named peak pose. The attitude comes
// from avatarMode's armAt(), which the canvas-width check samples across the
// whole travel, so the arm cannot pass through a shape the check never sees.
// Magnitudes there; the sign is the left/right mirror the pins use.
function armTo(v: VRM, side: 'left' | 'right', peak: ArmGestureName, env: number) {
  const pose = ARM_GESTURE_PEAKS[peak][side]
  if (!pose) return
  const mirror = side === 'left' ? 1 : -1
  const frame = armAt(pose, env)
  const upper = bone(v, `${side}UpperArm` as BoneName)
  const fore = bone(v, `${side}LowerArm` as BoneName)
  if (upper) upper.rotation.z = mirror * frame.upper
  if (fore) fore.rotation.z = mirror * frame.fore
}

const GESTURES: Record<GestureName, GestureDef> = {
  // -- cue-driven ------------------------------------------------------------
  bow: {
    dur: 1.5,
    apply: (_vrm, _p, env, _v, o) => {
      o.sx += env * 0.32
      o.hp += env * 0.18
    },
  },
  nod: {
    dur: 0.9,
    // two down-beats inside one smooth envelope
    apply: (_vrm, p, env, _v, o) => {
      o.hp += Math.sin(p * Math.PI * 2) * 0.14 * env
    },
  },
  // -- head-pat response -------------------------------------------------------
  wiggle: {
    dur: 0.9,
    apply: (_vrm, p, env, _v, o) => {
      o.hr += Math.sin(p * Math.PI * 4) * 0.09 * env
    },
  },
  // -- idle-act pool (~10s cadence while undisturbed; picked at random) -------
  //
  // The eight poses below replaced `stretch` on 2026-08-14. A stretch that only
  // flared the arms 20° out of a hanging pose read as nothing in particular,
  // which is exactly how the owner reported it. Each of these is a pose a
  // viewer can name.
  doublePeace: {
    dur: 2.2,
    hold: 3.5,
    arms: true,
    peak: 'doublePeace',
    // both hands up beside her face, fingers in a V, head tipped into it
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'left', 'doublePeace', env)
      armTo(vrm, 'right', 'doublePeace', env)
      setHand(vrm, 'left', HAND_PEACE, env)
      setHand(vrm, 'right', HAND_PEACE, env)
      o.hr += env * 0.1
      o.hp += -env * 0.05
    },
  },
  singlePeace: {
    dur: 2.0,
    hold: 3.5,
    arms: true,
    peak: 'singlePeace',
    // one V held by her temple, head leaning toward the hand
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'right', 'singlePeace', env)
      setHand(vrm, 'right', HAND_PEACE, env)
      o.hr += -env * 0.12
      o.hy += -env * 0.06
    },
  },
  cheekPoke: {
    dur: 2.4,
    hold: 3.5,
    arms: true,
    peak: 'cheekPoke',
    // index fingers to her own cheeks, chin tucked, a small side-to-side press
    apply: (vrm, p, env, _v, o) => {
      armTo(vrm, 'left', 'cheekPoke', env)
      armTo(vrm, 'right', 'cheekPoke', env)
      setHand(vrm, 'left', HAND_POINT, env)
      setHand(vrm, 'right', HAND_POINT, env)
      o.hp += env * 0.1
      o.hr += Math.sin(p * Math.PI * 4) * 0.05 * env
    },
  },
  salute: {
    dur: 2.0,
    hold: 3.5,
    arms: true,
    peak: 'salute',
    // right hand to the brow, left hand on her hip, chin up
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'right', 'salute', env)
      armTo(vrm, 'left', 'salute', env)
      setHand(vrm, 'right', HAND_OPEN, env)
      setHand(vrm, 'left', HAND_HIP, env)
      o.hp += -env * 0.1
      o.sz += env * 0.03
    },
  },
  pointAtYou: {
    dur: 2.0,
    hold: 3.5,
    arms: true,
    peak: 'pointAtYou',
    // The whole gesture is a forward swing out of the frontal plane (x, not z),
    // which is why the reach table leaves this arm's z angles at rest. Positive
    // x swings toward the viewer: the first draft had it negative and pointed
    // her arm out sideways and slightly behind her.
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'right', 'pointAtYou', env)
      const rua = bone(vrm, 'rightUpperArm')
      const rla = bone(vrm, 'rightLowerArm')
      if (rua) rua.rotation.x = env * 1.25
      if (rla) rla.rotation.x = env * 0.2
      setHand(vrm, 'right', HAND_POINT, env)
      o.hy += -env * 0.05
      o.hp += -env * 0.04
    },
  },
  handsBehindHead: {
    dur: 2.6,
    hold: 3.5,
    arms: true,
    peak: 'handsBehindHead',
    // elbows wide, hands laced behind her head, leaning back into them
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'left', 'handsBehindHead', env)
      armTo(vrm, 'right', 'handsBehindHead', env)
      // The forearms also rotate back in depth, or the hands end up in front of
      // her face instead of behind her head.
      const lla = bone(vrm, 'leftLowerArm')
      const rla = bone(vrm, 'rightLowerArm')
      if (lla) lla.rotation.x = env * 0.55
      if (rla) rla.rotation.x = env * 0.55
      setHand(vrm, 'left', HAND_RELAXED, env)
      setHand(vrm, 'right', HAND_RELAXED, env)
      o.hp += -env * 0.09
      o.sx += -env * 0.05
    },
  },
  handOnHip: {
    dur: 2.2,
    hold: 3.5,
    arms: true,
    peak: 'handOnHip',
    // one hand planted on her hip, weight shifted onto that leg
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'left', 'handOnHip', env)
      // Forward in depth so the hand lands on the hip rather than inside it.
      const lla = bone(vrm, 'leftLowerArm')
      if (lla) lla.rotation.x = -env * 0.45
      setHand(vrm, 'left', HAND_HIP, env)
      o.sz += env * 0.05
      o.hr += -env * 0.05
    },
  },
  hipWave: {
    dur: 2.4,
    hold: 3.5,
    arms: true,
    peak: 'hipWave',
    // hand on hip and the other one up waving — the greeting from the refs
    apply: (vrm, p, env, _v, o) => {
      armTo(vrm, 'left', 'hipWave', env)
      armTo(vrm, 'right', 'hipWave', env)
      const lla = bone(vrm, 'leftLowerArm')
      if (lla) lla.rotation.x = -env * 0.45
      const rh = bone(vrm, 'rightHand')
      if (rh) rh.rotation.z = Math.sin(p * 18) * 0.4 * env
      setHand(vrm, 'left', HAND_HIP, env)
      setHand(vrm, 'right', HAND_OPEN, env)
      o.sz += env * 0.05
      o.hr += env * 0.06
    },
  },
  tilt: {
    dur: 1.6,
    // curious head tilt to a random side
    apply: (_vrm, _p, env, v, o) => {
      o.hr += v * 0.16 * env
      o.hy += v * 0.05 * env
    },
  },
  glance: {
    dur: 2.2,
    // quick look one way then the other, eyes leading the head
    apply: (_vrm, p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.hy += v * w * 0.35
      o.ex += v * w * 1.4
    },
  },
  lookHand: {
    dur: 2.4,
    arms: true,
    // raises her right palm and studies it
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'right', 'lookHand', env)
      o.hp += env * 0.22
      o.hy += -env * 0.18
      o.ey += -env * 1.6
    },
  },
  swayStep: {
    dur: 2.0,
    // one exaggerated weight shift, head countering to stay level
    apply: (_vrm, p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.sz += v * w * 0.05
      o.hr += -v * w * 0.03
    },
  },
  bounce: {
    dur: 1.2,
    // three quick little body dips — a hop feel without any translation
    apply: (_vrm, p, env, _v, o) => {
      const w = Math.abs(Math.sin(p * Math.PI * 3)) * env
      o.sx += w * 0.05
      o.hp += w * 0.05
    },
  },
  hairTouch: {
    dur: 2.4,
    arms: true,
    // left hand up toward her hair, head leaning into it
    apply: (vrm, _p, env, _v, o) => {
      armTo(vrm, 'left', 'hairTouch', env)
      o.hr += -env * 0.08
      o.hy += env * 0.08
    },
  },
  hipTwist: {
    dur: 1.8,
    // small torso twist left-right, head countering
    apply: (_vrm, p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.sy += v * w * 0.12
      o.hy += -v * w * 0.06
    },
  },
  toeLook: {
    dur: 2.0,
    // peers down at the floor by her feet
    apply: (_vrm, _p, env, v, o) => {
      o.hp += env * 0.3
      o.hy += v * 0.1 * env
      o.ey += -env * 2
    },
  },
}

// What the idle timer may pick from. Cue gestures and the pat response stay
// out — they belong to their own triggers.
const IDLE_ACTS: readonly GestureName[] = [
  'doublePeace',
  'singlePeace',
  'cheekPoke',
  'salute',
  'pointAtYou',
  'handsBehindHead',
  'handOnHip',
  'hipWave',
  'tilt',
  'glance',
  'lookHand',
  'swayStep',
  'bounce',
  'hairTouch',
  'hipTwist',
  'toeLook',
]

export function initAvatarGuide(
  canvas: HTMLCanvasElement,
  vrmUrl: string,
  // Fires once the VRM's FIRST frame has actually rendered — not at parse
  // time. The widget uses it to swap the capsule launcher for the character;
  // on a weak GPU the texture upload/shader compile after parsing takes
  // hundreds of ms, and swapping at parse time leaves the corner with neither
  // capsule nor character for that window. Never fires on a failed load, so
  // the capsule stays and the corner never holds an empty, invisible button.
  onLoaded?: () => void,
  // Fires when the browser reclaims the WebGL context (backgrounded mobile
  // tab). The canvas is permanently blank after that (context restore is a
  // non-goal), so the widget must bring the capsule launcher back — otherwise
  // the corner is an invisible button and pointer users lose the only visible
  // way into the assistant.
  onContextLost?: () => void,
  // Fires when the VRM fetch/parse fails. The widget holds the capsule back
  // during a healthy load, so silence here would leave the corner empty
  // forever on a failed one.
  onLoadFailed?: () => void,
): AvatarGuideHandle {
  let disposed = false
  let mode: AvatarMode = 'idle'

  // Fallbacks only matter for a zero-size canvas (never in practice: the
  // per-frame reconcile below fixes both before the first visible frame).
  // Deliberately not the real box numbers — those live in AVATAR_CANVAS_*.
  const W = canvas.clientWidth || 1
  const H = canvas.clientHeight || 1
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(W, H, false)
  // DPR 2 (was 1.5): at this size the character costs little at full res,
  // and the line work (toon shading, hair) is exactly where 1.5 aliased.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // ACES gives the toon shading a filmic rolloff; exposure compensates the
  // curve's darkening so the pre-ACES look stays the baseline (screenshot-
  // compared, not guessed). EffectComposer/bloom is a plan Non-goal: it
  // breaks the alpha channel over the transparent canvas.
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25

  const scene = new THREE.Scene()
  // Waist-up framing. The full-body shot this replaced put her face at ~27px
  // on the launcher canvas (~19px once its 72% narrow-screen scale applied),
  // which is below what the expressions, the outfit detail and the gestures
  // need to read at all. Pulling the camera in from 3.9m to 2.3m is free
  // magnification: the canvas height, her footprint on the page and the visual
  // order of the hero are all untouched, and only the framing changes.
  // Her feet and the contact shadow fall outside this frame by design — the
  // canvas carries a bottom mask (AvatarGuide.tsx) so the crop fades out.
  //
  // The gestures were originally checked against the VERTICAL extent only, and
  // stretch and wave turned out to be clipped left and right (stretch lost
  // 13.7px per side in the launcher box and 16.7px in the two chat boxes; wave
  // 9.6px and 11.6px). Reported by the owner 2026-08-14. What contains them is
  // the canvas WIDTH, which is separate from everything above because fov is
  // vertical — see AVATAR_WIDEST_GESTURE_REACH and the AVATAR_CANVAS_* boxes.
  const camera = new THREE.PerspectiveCamera(AVATAR_FOV, W / H, 0.1, 30)
  camera.position.set(
    0,
    AVATAR_FRAMING_DEFAULT.lookAtY + AVATAR_CAMERA_TILT,
    AVATAR_FRAMING_DEFAULT.distance,
  )
  camera.lookAt(0, AVATAR_FRAMING_DEFAULT.lookAtY, 0)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(0.6, 1.6, 2.2)
  scene.add(key)
  // Low cyan fill from below-front (position under the target aims it up):
  // the site's interactive accent, and it separates her dark outfit from the
  // dark page ground where the white key alone went muddy.
  const fill = new THREE.DirectionalLight(0x00d9ff, 0.3)
  fill.position.set(-0.4, -1.0, 1.8)
  scene.add(fill)

  // Contact shadow: a radial-gradient disc at her feet. Fake and cheap on
  // purpose — real shadow maps cost a render pass and read as noise at this
  // size; grounding is all this needs to do.
  // The waist-up camera leaves it out of frame, so it is invisible today. It
  // stays because it costs one draw call and is what any framing that shows
  // her feet again would need; the materialize entrance still fades it in.
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  const sctx = shadowCanvas.getContext('2d')
  if (sctx) {
    const g = sctx.createRadialGradient(64, 64, 6, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,0.42)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.18)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = g
    sctx.fillRect(0, 0, 128, 128)
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.005
  shadow.visible = false // appears with the materialize entrance
  scene.add(shadow)

  // Manga anger vein (青筋) for the angry emotion, matched to the drawn mark on
  // the owner's expression sheet: four bowed V strokes in a pinwheel, apex
  // pointing INWARD so the eight limb ends splay outward, WHITE cored with a
  // red outline. Three earlier shapes were rejected before this one — circle
  // arcs, then the corners of a rounded square, then the solid-red crescents of
  // the U+1F4A2 emoji glyph, which is a different mark from the hand-drawn one
  // the sheet uses. Coordinates are in a 128-unit space (centre 64,64) drawn at
  // 2× into a 256px canvas so the outline stays crisp on her hair.
  const markCanvas = document.createElement('canvas')
  markCanvas.width = markCanvas.height = 256
  const mctx = markCanvas.getContext('2d')
  if (mctx) {
    const APEX = 15 // how far the inward point stops short of the centre
    const TIP = 52 // limb length from the centre
    const HALF = 0.55 // half the V's opening, radians
    const BOW = 0.5 // control point along the limb: 0 = straight V, 1 = round
    const SKEW = 0.35 // the whole mark sits off-axis, as a drawn one would
    mctx.scale(2, 2)
    mctx.lineCap = 'round'
    mctx.lineJoin = 'round'
    for (let q = 0; q < 4; q++) {
      mctx.save()
      mctx.translate(64, 64)
      mctx.rotate((q * Math.PI) / 2 + SKEW)
      const lx = -Math.sin(HALF) * TIP
      const rx = Math.sin(HALF) * TIP
      const ty = -Math.cos(HALF) * TIP
      const p = new Path2D()
      p.moveTo(lx, ty)
      p.quadraticCurveTo(lx * BOW, ty * BOW, 0, -APEX)
      p.quadraticCurveTo(rx * BOW, ty * BOW, rx, ty)
      // Outline first, then the core over it: one stroke drawn twice, so the
      // white can never drift out of its own border.
      mctx.strokeStyle = '#d94a3d'
      mctx.lineWidth = 17
      mctx.stroke(p)
      mctx.strokeStyle = '#ffffff'
      mctx.lineWidth = 6
      mctx.stroke(p)
      mctx.restore()
    }
  }
  const markTex = new THREE.CanvasTexture(markCanvas)
  // Canvas pixels are authored in sRGB; without the tag three treats them as
  // linear and the sRGB output pass washes the red out.
  markTex.colorSpace = THREE.SRGBColorSpace
  const markMat = new THREE.SpriteMaterial({
    map: markTex,
    transparent: true,
    opacity: 0,
    depthTest: false,
    toneMapped: false, // keep the authored red; ACES would dull it
  })
  const angerMark = new THREE.Sprite(markMat)
  angerMark.renderOrder = 10
  angerMark.visible = false
  scene.add(angerMark)
  const markPos = new THREE.Vector3()

  // Rising cyan particle column for the materialize entrance; spawned on the
  // first rendered frame, disposed as soon as the entrance ends.
  function spawnParticles() {
    const N = 70
    const posArr = new Float32Array(N * 3)
    particleVel = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const r = 0.08 + Math.random() * 0.24
      const a = Math.random() * Math.PI * 2
      posArr[i * 3] = Math.cos(a) * r
      posArr[i * 3 + 1] = Math.random() * 1.5
      posArr[i * 3 + 2] = Math.sin(a) * r
      particleVel[i] = 0.5 + Math.random() * 1.1
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    const pm = new THREE.PointsMaterial({
      color: 0x00d9ff,
      size: 0.028,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    particles = new THREE.Points(geo, pm)
    scene.add(particles)
  }

  function disposeParticles() {
    if (!particles) return
    scene.remove(particles)
    particles.geometry.dispose()
    ;(particles.material as THREE.Material).dispose()
    particles = null
    particleVel = null
  }

  let vrm: VRM | null = null
  const eyeTarget = new THREE.Object3D()
  eyeTarget.position.set(0, 1.35, 4)
  scene.add(eyeTarget)
  // MToon albedo per material, captured once so the answering tint can lerp
  // from the true base instead of compounding on itself frame over frame. The
  // tinted endpoint is a pure function of the base, so it's precomputed here
  // rather than allocated per material per frame inside the render loop.
  let mats: { m: THREE.Material & { color: THREE.Color }; base: THREE.Color; tinted: THREE.Color }[] = []
  // MToon materials additionally get a parametric rim (mars orange) whose
  // intensity rides the speaking tint — the rim carries the "answering" look
  // now, which is why the body tint below is halved.
  type MToonLike = THREE.Material & {
    parametricRimColorFactor: THREE.Color
    parametricRimFresnelPowerFactor: number
  }
  let mtoons: MToonLike[] = []
  // The face/skin materials only, for `pale`: a whole-body blue reads as a
  // lighting change, a bluish face reads as 青ざめ.
  let faceMats: Array<{ m: THREE.Material & { color: THREE.Color }; base: THREE.Color; pale: THREE.Color }> = []
  const PALE = new THREE.Color(...FACE_PALE_TINT)
  const RIM_COLOR = new THREE.Color(0xe8652b)
  const rimScratch = new THREE.Color()

  const loader = new GLTFLoader()
  loader.register((p) => new VRMLoaderPlugin(p))
  loader.load(
    vrmUrl,
    (gltf) => {
      if (disposed) {
        // Disposed while the 5.5MB VRM was still parsing: nobody else will ever
        // see this scene, so release its geometry/textures here or leak them.
        VRMUtils.deepDispose(gltf.scene)
        return
      }
      const loaded = gltf.userData.vrm as VRM
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene) // removeUnnecessaryJoints is deprecated in three-vrm 3.x
      VRMUtils.rotateVRM0(loaded) // VRM0 faces +Z; turn it toward the camera
      scene.add(loaded.scene)
      if (loaded.lookAt) loaded.lookAt.target = eyeTarget
      pinArms(loaded)
      const seen = new Set<THREE.Material>()
      loaded.scene.traverse((o) => {
        const material = (o as THREE.Mesh).material
        if (!material) return
        for (const m of Array.isArray(material) ? material : [material]) {
          if (seen.has(m)) continue // shared materials must be tinted once, not once per mesh
          seen.add(m)
          const withColor = m as THREE.Material & { color?: THREE.Color }
          if (withColor.color) {
            mats.push({
              m: withColor as never,
              base: withColor.color.clone(),
              tinted: ANSWER_TINT.clone().multiply(withColor.color),
            })
            if (/face|skin/i.test(m.name))
              faceMats.push({
                m: withColor as never,
                base: withColor.color.clone(),
                pale: PALE.clone().multiply(withColor.color),
              })
          }
          const mtoon = m as Partial<MToonLike> & THREE.Material
          if (mtoon.parametricRimColorFactor) {
            mtoon.parametricRimFresnelPowerFactor = 6 // tight edge highlight
            mtoons.push(mtoon as MToonLike)
          }
        }
      })
      // Which emotion presets this model actually ships (VRM0 naming trap:
      // check the manager, never assume — see module header).
      availableEmotions = new Set(
        (loaded.expressionManager?.expressions ?? []).map((e) => e.expressionName),
      )
      vrm = loaded
      // onLoaded intentionally NOT fired here — see the frame loop, which
      // reports after the first real render instead.
    },
    undefined,
    // Loading is best-effort chrome — no visitor-facing error, but the widget
    // must know so it can release the held-back capsule launcher.
    () => {
      if (!disposed) onLoadFailed?.()
    },
  )

  // ---- per-frame state ----
  // Manual timing (faceHero convention): THREE.Clock is deprecated in three
  // 0.183. `t` derives from absolute performance.now() so the idle/listening
  // sinusoids stay wall-clock-phased across pauses; `dt` is clamped so a long
  // background stint can't fast-forward blink/viseme timers on resume.
  let prevMs = performance.now()
  let tint = 0
  let colorDirty = false
  // Materialize entrance: -1 = waiting for the first rendered frame,
  // [0,1] = running, 2 = done (never replays).
  let matzT = -1
  let particles: THREE.Points | null = null
  let particleVel: Float32Array | null = null
  // Channels >1 overdrive toward white under ACES — a glow without bloom.
  const CYAN_FLASH = new THREE.Color(0.35, 1.2, 1.6)
  let randViseme = -1
  let visemeTimer = 0
  let visemeHold = 0.11
  const visemeW = [0, 0, 0, 0, 0]
  let blinkTimer = 1.6
  let blinkPhase = -1
  let speechEl: HTMLAudioElement | null = null
  let speechTrack: VisemeTrack | null = null
  let availableEmotions = new Set<string>()
  let emoName: EmotionName | null = null
  let emoW = 0 // intent weight: attack → hold → decay
  let emoShown = 0 // displayed weight: one smoothing pass over intent × speech cap
  let emoPeak = 0
  let emoHold = 0
  // A replaced emotion fades its channel out here while the new one attacks
  // from zero — hard-zeroing the old channel read as a facial snap (R1 #1).
  let emoFade: { name: EmotionName; w: number } | null = null
  // Write one emotion's weight into every channel its recipe names.
  const writeEmotion = (name: EmotionName, w: number) => {
    // The weight→channel rule lives in avatarMode so the tests drive the same
    // code this does; snapToFull morphs get their whole share or nothing.
    for (const [ch, v] of emotionChannelValues(name, w))
      vrm?.expressionManager?.setValue(ch, v)
  }
  const applyEmotion = (name: EmotionName, weight = 1, holdSec = 2.4) => {
    // Gate on the recipe's channels, not the emotion's own name: composites
    // (nagomi, pale) never appear in the model's expression list themselves.
    if (!EMOTION_RECIPES[name].channels.every(([ch]) => availableEmotions.has(ch))) return
    if (emoName !== name) {
      // Order matters (R2 review): consume a fade of the INCOMING emotion
      // first — switching back mid-fade resumes from its faded weight, so
      // the channel never snaps to zero and re-attacks. Only then park the
      // outgoing emotion in the fade slot. A third distinct emotion inside
      // one fade window snaps the oldest channel off (documented cut).
      let resumeW = 0
      if (emoFade && emoFade.name === name) {
        resumeW = emoFade.w
        emoFade = null
      }
      if (emoName) {
        if (emoFade) writeEmotion(emoFade.name, 0)
        emoFade = { name: emoName, w: emoShown }
      }
      // Fresh emotions attack from zero (inheriting the old weight skipped
      // the attack curve, R1 #1); a resumed one continues where it faded to.
      emoW = resumeW
      emoShown = resumeW
    }
    emoName = name
    emoPeak = Math.min(Math.max(weight, 0), 1)
    emoHold = holdSec
  }
  // Roughly every 20s of undisturbed idle she closes her eyes for a beat — the
  // なごみ目 from the owner's expression sheet, as a moment rather than a cue.
  let idleEmoTimer = 12 + Math.random() * 10
  let saccadeTimer = 0.9
  let saccadeX = 0
  let saccadeY = 0
  // Smoothed head aim; the raw per-mode value steps on every mode change.
  let aimYaw = 0
  let aimPitch = 0
  // Idle self-actions fire only during undisturbed idle, roughly every 5s
  // start-to-start (timer 2.5–4s + the act itself, pool mean ~2s);
  // interaction pushes the next one back. One re-roll guards against the
  // same act twice in a row.
  let idleActTimer = 2.5 + Math.random() * 1.5
  let lastIdleAct: GestureName | null = null
  let gesture: { name: GestureName; t: number; v: number } | null = null
  // Per-frame gesture offset accumulator (reset each frame, never allocated
  // inside the loop) — see GESTURES.
  const OFF: GestureOffsets = { hp: 0, hy: 0, hr: 0, sx: 0, sy: 0, sz: 0, cx: 0, ex: 0, ey: 0 }
  // Probe channel for automated verification (?mikadebug=1) — same pattern as
  // the retired ?audiodebug overlay, kept because avatar work re-needs it.
  const debugTap =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('mikadebug')
  let rafId = 0
  let pageVisible = true
  let userActive = true
  let running = false
  let loadedFired = false
  let contextLost = false

  // The loop genuinely stops when hidden or deactivated (fullscreen chat) —
  // an early-return inside a still-scheduled rAF would keep waking the browser
  // at 60Hz for a no-op. Mirrors faceHero's setActive contract.
  const shouldRun = () => !disposed && !contextLost && pageVisible && userActive
  function ensureRunning() {
    if (running || !shouldRun()) return
    running = true
    prevMs = performance.now() // flush the paused interval so the first dt isn't a spike
    rafId = window.requestAnimationFrame(frame)
  }

  function frame() {
    if (!shouldRun()) {
      running = false
      return
    }
    rafId = window.requestAnimationFrame(frame)
    const nowMs = performance.now()
    const dt = Math.min((nowMs - prevMs) / 1000, 0.05)
    prevMs = nowMs
    const t = nowMs / 1000

    if (vrm) {
      // Materialize entrance: cyan flash + scale pop + rising particles, once,
      // starting on the very first frame the character is visible. Applies
      // the p=0 state before this frame renders so the swap-in never shows a
      // single full-scale frame first.
      if (matzT === -1) {
        matzT = 0
        shadow.visible = true
        shadowMat.opacity = 0
        spawnParticles()
      }
      if (matzT >= 0 && matzT <= 1) {
        const p = matzT
        const back = 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2)
        vrm.scene.scale.setScalar(0.94 + 0.06 * back)
        shadowMat.opacity = Math.min(1, p * 2)
        if (particles && particleVel) {
          const pos = particles.geometry.getAttribute('position') as THREE.BufferAttribute
          for (let i = 0; i < particleVel.length; i++) {
            pos.setY(i, pos.getY(i) + particleVel[i] * dt)
          }
          pos.needsUpdate = true
          ;(particles.material as THREE.PointsMaterial).opacity = 0.9 * (1 - p)
        }
        matzT += dt / 1.1
        if (matzT > 1) {
          vrm.scene.scale.setScalar(1)
          shadowMat.opacity = 1
          disposeParticles()
          matzT = 2
        }
      }

      // Head direction per mode — rotation on head/neck/spine, eyes tracking a
      // real target so the gaze leads the turn the way people actually look.
      // headAim() is a step function across mode changes (see its comment), so
      // it feeds a one-pole filter instead of the bones directly: without this
      // the frame an answer ends snaps her head 18° and throws the eye target
      // 2.85 units sideways, which reads as a glitch rather than a look-away.
      const aimTarget = headAim(mode, t)
      aimYaw = stepHeadAim(aimYaw, aimTarget.yaw, dt)
      aimPitch = stepHeadAim(aimPitch, aimTarget.pitch, dt)
      const yaw = aimYaw
      const pitch = aimPitch

      // Idle self-actions: an unprompted little performance roughly every 5s
      // of undisturbed idle (post-entrance, nothing else performing), picked
      // at random from IDLE_ACTS. Purely visual — no sound, per the plan's F
      // item. A single re-roll makes an immediate repeat unlikely (~1/121, not
      // impossible) without ever risking a loop.
      const speechIdle = !speechEl || speechEl.paused || speechEl.ended
      if (
        matzT === 2 &&
        mode === 'idle' &&
        !gesture &&
        speechIdle &&
        emoW < 0.05
      ) {
        idleEmoTimer -= dt
        if (idleEmoTimer <= 0) {
          applyEmotion('nagomi', 1, 2.2)
          idleEmoTimer = 16 + Math.random() * 12
        }
        idleActTimer -= dt
        if (idleActTimer <= 0) {
          let pick = IDLE_ACTS[(Math.random() * IDLE_ACTS.length) | 0]
          if (pick === lastIdleAct) pick = IDLE_ACTS[(Math.random() * IDLE_ACTS.length) | 0]
          lastIdleAct = pick
          gesture = { name: pick, t: 0, v: Math.random() < 0.5 ? -1 : 1 }
          idleActTimer = 2.5 + Math.random() * 1.5
        }
      } else if (mode !== 'idle') {
        idleActTimer = Math.max(idleActTimer, 4)
      }

      // Gesture offsets ADD to the mode-driven head/spine pose (a nod during
      // listening still tracks the visitor); the arms are the exception —
      // they're pinned, not mode-driven, so arm gestures own them and restore
      // the pins when done. All motion curves live in the GESTURES table.
      OFF.hp = OFF.hy = OFF.hr = OFF.sx = OFF.sy = OFF.sz = OFF.cx = OFF.ex = OFF.ey = 0
      if (gesture) {
        gesture.t += dt
        const def = GESTURES[gesture.name]
        const total = def.dur + (def.hold ?? 0)
        const p = Math.min(gesture.t / total, 1)
        const env = gestureEnvelope(gesture.t, def.dur, def.hold ?? 0)
        def.apply(vrm, p, env, gesture.v, OFF)
        if (p >= 1) {
          if (def.arms) pinArms(vrm)
          gesture = null
        }
      }

      const head = vrm.humanoid?.getNormalizedBoneNode('head')
      const neck = vrm.humanoid?.getNormalizedBoneNode('neck')
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine')
      // Breathing on the chest and a slow weight shift on the hips, with the
      // spine countering so the head stays centred — the body never freezes.
      const sway = Math.sin(t * ((2 * Math.PI) / 13))
      const chest = vrm.humanoid?.getNormalizedBoneNode('chest')
      const hips = vrm.humanoid?.getNormalizedBoneNode('hips')
      if (chest) chest.rotation.x = Math.sin(t * ((2 * Math.PI) / 4.2)) * 0.012 + OFF.cx
      if (hips) hips.rotation.z = sway * 0.02
      if (head) {
        head.rotation.y = yaw * 0.65 + OFF.hy
        head.rotation.x = pitch * 0.7 + OFF.hp
        head.rotation.z = OFF.hr
      }
      if (neck) {
        neck.rotation.y = yaw * 0.35
        neck.rotation.x = pitch * 0.3
      }
      if (spine) {
        spine.rotation.y = yaw * 0.1 + OFF.sy
        spine.rotation.x = OFF.sx
        spine.rotation.z = sway * -0.012 + OFF.sz
      }

      // Saccades: real gaze is a series of small jumps, not a smooth glide.
      // The offsets ride on the mode-driven target so the big look direction
      // is unchanged; only the fixation point twitches.
      saccadeTimer -= dt
      if (saccadeTimer <= 0) {
        saccadeX = (Math.random() * 2 - 1) * 0.65
        saccadeY = (Math.random() * 2 - 1) * 0.25
        saccadeTimer = 0.7 + Math.random() * 1.8
      }
      eyeTarget.position.set(
        Math.sin(yaw) * 6 + saccadeX + OFF.ex,
        1.35 + Math.sin(pitch) * -4 + saccadeY + OFF.ey,
        4,
      )

      // Blink in every mode; 12% of blinks double up (single metronome blinks
      // read as robotic). New blinks hold while a strong emotion is posing the
      // lids — a blink on top of happy's closed-eye smile reads as a glitch.
      // Gate on the DISPLAYED weight: during speech the cap keeps the lids
      // only partly posed, so blinking may continue (R1 review #2).
      blinkTimer -= dt
      if (blinkTimer <= 0 && blinkPhase < 0 && emoShown <= 0.5) blinkPhase = 0
      if (blinkPhase >= 0) {
        blinkPhase += dt
        const w = blinkPhase < 0.06 ? blinkPhase / 0.06 : Math.max(0, 1 - (blinkPhase - 0.06) / 0.08)
        vrm.expressionManager?.setValue('blink', w)
        if (blinkPhase > 0.15) {
          blinkPhase = -1
          blinkTimer = Math.random() < 0.12 ? 0.18 : 1.5 + Math.random() * 4.5
        }
      }

      // Mouth, two sources with strict priority: a playing voice clip drives
      // frame-accurate visemes sampled from its VOICEVOX mora timeline at the
      // audio element's own clock (survives tab jank — it re-syncs every
      // frame); otherwise streaming mode falls back to the uneven random loop,
      // because text answers have no audio to sync to. Five weight channels
      // lerp independently so shapes cross-fade instead of snapping.
      let visemeTarget = -1
      let visemeTargetW = 0
      let speechActive = false
      const sEl = speechEl
      if (sEl && speechTrack && !sEl.paused && !sEl.ended) {
        speechActive = true
        visemeTarget = sampleViseme(speechTrack, sEl.currentTime)
        // Full weight, not 0.85: her face is ~55px tall on screen, so the
        // mouth only has a few pixels of travel to say anything with. A mora
        // often lasts 3-5 frames, and the lerp below only closes ~70% of the
        // gap in that time, so the visible opening is smaller than the target
        // anyway — starting from a reduced target made it unreadable.
        visemeTargetW = 1
      } else if (mode === 'speaking') {
        visemeTimer -= dt
        if (visemeTimer <= 0) {
          // ~18% of beats close the mouth so it breathes
          randViseme = Math.random() < 0.18 ? -1 : (Math.random() * VISEME_NAMES.length) | 0
          visemeHold = 0.07 + Math.random() * 0.13
          visemeTimer = visemeHold
        }
        visemeTarget = randViseme
        visemeTargetW = 0.8
      }
      for (let i = 0; i < visemeW.length; i++) {
        // 28/s (was 22): a 60ms mora is 3-4 frames, where 22 reached ~70% of
        // the target and 28 reaches ~85%. Higher than this and consecutive
        // vowels start to read as a chatter rather than speech.
        visemeW[i] += ((i === visemeTarget ? visemeTargetW : 0) - visemeW[i]) * Math.min(1, dt * 28)
        if (visemeW[i] < 0.001) visemeW[i] = 0
        vrm.expressionManager?.setValue(VISEME_NAMES[i], visemeW[i])
      }

      // Emotion layer: fast attack, timed hold, slow release. The speech cap
      // (0.45, so a preset's mouth shape can't fight the visemes) limits the
      // TARGET of a shared smoothing pass, never the displayed value directly:
      // most clips end mid-hold, and an uncushioned cap release snapped the
      // face from 0.45 to full weight in one frame (R1 review #1).
      if (emoFade) {
        emoFade.w += (0 - emoFade.w) * Math.min(1, dt * 7)
        if (emoFade.w < 0.001) {
          writeEmotion(emoFade.name, 0)
          emoFade = null
        } else {
          writeEmotion(emoFade.name, emoFade.w)
        }
      }
      if (emoName) {
        if (emoHold > 0) {
          emoHold -= dt
          emoW += (emoPeak - emoW) * Math.min(1, dt * 7)
        } else {
          emoW += (0 - emoW) * Math.min(1, dt * 3.5)
        }
        const emoTarget = speechActive ? Math.min(emoW, 0.45) : emoW
        emoShown += (emoTarget - emoShown) * Math.min(1, dt * 7)
        if (emoHold <= 0 && emoW < 0.001 && emoShown < 0.001) {
          writeEmotion(emoName, 0)
          emoName = null
          emoW = 0
          emoShown = 0
        } else {
          writeEmotion(emoName, emoShown)
        }
      }

      if (debugTap) {
        ;(window as unknown as { __mikaState?: object }).__mikaState = {
          viseme: visemeTarget,
          visemeW: [...visemeW],
          emo: emoName,
          emoW,
          emoShown,
          gesture: gesture ? gesture.name : null,
          ruaZ: bone(vrm, 'rightUpperArm')?.rotation.z ?? 0,
          ruaX: bone(vrm, 'rightUpperArm')?.rotation.x ?? 0,
          luaZ: bone(vrm, 'leftUpperArm')?.rotation.z ?? 0,
          llaZ: bone(vrm, 'leftLowerArm')?.rotation.z ?? 0,
          rlaZ: bone(vrm, 'rightLowerArm')?.rotation.z ?? 0,
          rhZ: bone(vrm, 'rightHand')?.rotation.z ?? 0,
          speechT: speechActive && sEl ? sEl.currentTime : -1,
          // Read back from the scene graph, not echoed from the math — proves
          // the bones actually moved, for the automated probe.
          chestX: chest ? chest.rotation.x : 0,
          hipsZ: hips ? hips.rotation.z : 0,
          headX: head ? head.rotation.x : 0,
          spineX: spine ? spine.rotation.x : 0,
          matz: matzT,
          headY: head ? head.rotation.y : 0,
          headZ: head ? head.rotation.z : 0,
          scale: vrm.scene.scale.x,
          rimR: mtoons.length > 0 ? mtoons[0].parametricRimColorFactor.r : -1,
          shadowOp: shadow.visible ? shadowMat.opacity : -1,
        }
      }

      // Answering look, lerped both directions so nothing snaps. The body
      // tint is halved from Batch 1-era so the mars parametric rim (below)
      // reads as the "answering" signal; the materialize cyan flash rides the
      // same consolidated colour write so the two never fight over m.color.
      const target = mode === 'speaking' ? 1 : 0
      tint += (target - tint) * Math.min(1, dt * 4)
      if (tint < 0.001) tint = 0
      const flashW = matzT >= 0 && matzT <= 1 ? (1 - Math.min(matzT, 1)) * 0.75 : 0
      // `pale` rides the same consolidated colour write as the answering tint
      // and the entrance flash, so no two of them ever fight over m.color.
      const paleW =
        (emoName && EMOTION_RECIPES[emoName].paleTint ? emoShown : 0) +
        (emoFade && EMOTION_RECIPES[emoFade.name].paleTint ? emoFade.w : 0)
      // The anger vein presses onto her hair at the viewer's upper-right of
      // her head (owner's placement call, 2026-08-15), riding the same weights
      // as the tint so it can never outlive or lag the face it annotates.
      const markW =
        (emoName && EMOTION_RECIPES[emoName].angerMark ? emoShown : 0) +
        (emoFade && EMOTION_RECIPES[emoFade.name].angerMark ? emoFade.w : 0)
      angerMark.visible = markW > 0.02 && matzT === 2
      if (angerMark.visible && head) {
        head.getWorldPosition(markPos)
        angerMark.position.set(markPos.x + 0.08, markPos.y + 0.11, markPos.z + 0.04)
        markMat.opacity = Math.min(1, markW)
        // A touch of pop as it lands, without a full pulse animation.
        const s = 0.15 * (0.85 + 0.15 * markW)
        angerMark.scale.set(s, s, 1)
      }
      if (tint > 0 || flashW > 0 || paleW > 0.003) {
        for (const { m, base, tinted } of mats) {
          m.color.copy(base).lerp(tinted, tint * 0.5)
          if (flashW > 0) m.color.lerp(CYAN_FLASH, flashW)
        }
        if (paleW > 0.003) for (const { m, pale } of faceMats) m.color.lerp(pale, Math.min(1, paleW))
        colorDirty = true
      } else if (colorDirty) {
        for (const { m, base } of mats) m.color.copy(base)
        colorDirty = false
      }
      // Mars rim: always faintly present (separates her from the dark page),
      // swelling while she answers.
      rimScratch.copy(RIM_COLOR).multiplyScalar(0.22 + tint * 0.5)
      for (const m of mtoons) m.parametricRimColorFactor.copy(rimScratch)

      vrm.expressionManager?.update()
      vrm.update(dt) // spring bones (hair, skirt) advance here
    }
    // The canvas grows when the chat opens (ChatWidget hands the docked and
    // fullscreen placements a bigger box). Matching the drawing buffer to the
    // CSS box keeps her at native resolution there instead of upscaling the
    // a launcher-sized buffer — a CSS transform would have been one line and visibly
    // softer. Cheap to check per frame; setSize only runs on an actual change.
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const dpr = renderer.getPixelRatio()
    // Math.floor, matching what setSize itself writes into canvas.width — with
    // Math.round a fractional devicePixelRatio (Windows 125%/175%, browser
    // zoom) lands the two on either side of a .5 and this "did it change"
    // check is true forever, reallocating the drawing buffer every frame.
    if (cw > 0 && ch > 0 && (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr))) {
      renderer.setSize(cw, ch, false)
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
    }
    renderer.render(scene, camera)
    if (vrm && !loadedFired) {
      loadedFired = true
      onLoaded?.()
    }
  }
  running = true
  rafId = window.requestAnimationFrame(frame)

  // The browser can reclaim the GL context (mobile tab backgrounded). Restore
  // is a non-goal; report it so the widget swaps the capsule launcher back.
  // contextLost also stops the loop (three's render() is a silent no-op on a
  // dead context, so the loop would burn spring-bone physics at 60fps forever)
  // and pins loadedFired: a VRM that finishes parsing AFTER the loss must
  // never report loaded — the widget would drop the capsule for a character
  // that can no longer be drawn.
  const onCtxLost = () => {
    if (disposed) return
    contextLost = true
    loadedFired = true
    onContextLost?.()
  }
  canvas.addEventListener('webglcontextlost', onCtxLost)

  // Stop the loop while the tab is hidden; `t` is wall-clock so motion
  // resumes in phase instead of jumping.
  const onVisibility = () => {
    pageVisible = document.visibilityState === 'visible'
    ensureRunning()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const handle: AvatarGuideHandle = {
    setMode: (m) => {
      mode = m
    },
    setActive: (a) => {
      userActive = a
      ensureRunning()
    },
    setSpeech: (audio, track) => {
      speechEl = audio
      speechTrack = track
    },
    setEmotion: applyEmotion,
    playGesture: (name) => {
      // Replacing a mid-flight arm gesture must not strand a half-raised arm.
      if (gesture && GESTURES[gesture.name].arms && vrm) pinArms(vrm)
      gesture = { name, t: 0, v: Math.random() < 0.5 ? -1 : 1 }
    },
    setFraming: (distance, lookAtY) => {
      camera.position.set(0, lookAtY + AVATAR_CAMERA_TILT, distance)
      camera.lookAt(0, lookAtY, 0)
    },
    dispose: () => {
      disposed = true
      speechEl = null
      speechTrack = null
      window.cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      // Before forceContextLoss below, which would otherwise fire onCtxLost
      // for a teardown the widget must not react to (disposed also guards it).
      canvas.removeEventListener('webglcontextlost', onCtxLost)
      if (vrm) {
        scene.remove(vrm.scene)
        VRMUtils.deepDispose(vrm.scene)
      }
      mats = []
      mtoons = []
      disposeParticles()
      shadow.geometry.dispose()
      shadowMat.dispose()
      shadowTex.dispose()
      markMat.dispose()
      markTex.dispose()
      // Without forceContextLoss the browser keeps the GL context alive until
      // it feels like collecting it — same hard-won note as faceHero's dispose.
      // Skip it when the context is already gone: three warnOnce()s about the
      // missing WEBGL_lose_context extension on a dead context.
      if (!contextLost) renderer.forceContextLoss()
      renderer.dispose()
      // Every handle method closes over renderer/scene/camera/vrm, so leaving
      // the debug global set would pin the whole parsed VRM scene graph for the
      // life of the page — exactly the teardown a context-loss unmount runs to
      // avoid. (__mikaState needs no such cleanup: it holds only numbers.)
      delete (window as unknown as { __mikaHandle?: AvatarGuideHandle }).__mikaHandle
    },
  }

  // Same ?mikadebug=1 gate as __mikaState: an automated check needs to trigger
  // a specific gesture (a fingertip's distance from the frame edge is only
  // meaningful at a gesture's peak) rather than waiting out the idle-act timer.
  if (debugTap) {
    ;(window as unknown as { __mikaHandle?: AvatarGuideHandle }).__mikaHandle = handle
  }

  return handle
}
