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
// Perception & idle life (Batch 3, rebuilt 2026-08-19):
//   - head-pat: AvatarGuide detects a tap on her head, or a mouse stroke
//     across it, and triggers a happy wiggle. It never intercepts the click.
//     The sound is ChatWidget's: a giggle, or a complaint on the third pat in
//     a row, which also swaps the wiggle for an annoyed face.
//   - idle acts fire roughly every 5s of undisturbed idle and come from two
//     pools. Two thirds are motion-capture clips (avatarMotions.ts); the rest
//     are six procedural beats that lean the head and torso a few degrees
//     (tilt, glance, weight shift, bounce, hip twist, floor peek).
//   - the ten hand-authored ARM gestures that used to sit in that pool were
//     removed on 2026-08-19. Measured against the real skeleton, seven of them
//     put a hand somewhere no person would: fingers inside her own face, a
//     "hair touch" that stopped at her hip, a peace sign with one palm facing
//     backwards. Joint angles were being authored without any way to see where
//     they landed. See docs/plans/avatar-motion-capture.md and rigProbe.ts.
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
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation'
import {
  IDLE_MOTIONS,
  IDLE_ROTATION_START,
  nextIdleMotion,
  MOTION_URL,
  motionFrame,
  motionPan,
  motionsFor,
  settleSeconds,
  settleWeight,
  type AvatarMotionName,
} from './avatarMotions'
import {
  ARM_REST_FORE_Z,
  ARM_REST_UPPER_Z,
  EMOTION_RECIPES,
  emotionChannelValues,
  FACE_PALE_TINT,
  gestureEnvelope,
  AVATAR_CAMERA_TILT,
  AVATAR_FOV,
  AVATAR_FRAMING_DEFAULT,
  headAim,
  stepFramePan,
  stepHeadAim,
  type AvatarMode,
  type AvatarPlacement,
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
// Nothing here touches an arm any more. Arms are motion capture (avatarMotions)
// because a hand has to ARRIVE somewhere — beside her temple, on her hip — and
// hand-authored joint angles were never checked against where they actually
// landed. These survivors only lean the head and torso a few degrees, which is
// a shape a formula can hold honestly.
export type GestureName =
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
  // Play a motion-capture clip. Returns false when the clip has not finished
  // downloading, which is not an error: the caller falls back to a procedural
  // beat and the clip is there for the next one.
  playMotion: (name: AvatarMotionName) => boolean
  // Which clips can be played RIGHT NOW: eligible for the current placement and
  // already downloaded. The motion strip in the composer needs this because a
  // visitor tapping a name expects movement, and playMotion answers false for a
  // clip still in flight. Dimming those until they land shows the truth instead
  // of handing someone a control that silently does nothing.
  readyMotions: () => readonly AvatarMotionName[]
  // Camera dolly for a placement that gets a taller canvas. Pass the distance
  // and the height the camera looks at; the tilt is preserved. Keeping
  // `distance / canvas height` constant keeps her on-screen size constant, so
  // a taller canvas shows more of her instead of scaling her up.
  setFraming: (distance: number, lookAtY: number) => void
  // Which composition she is rendered in. Gates which motion-capture clips are
  // eligible: a clip is only played in a frame it has been measured to fit.
  setPlacement: (placement: AvatarPlacement) => void
  dispose: () => void
}

// Multiply-tint target while answering; reads as #E8652B over the sample's
// mostly-light albedo without crushing dark materials to black.
const ANSWER_TINT = new THREE.Color(1.0, 0.62, 0.38)


type BoneName = Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0]
// VRM0 rest pose is a T-pose; these Z rotations bring the arms down. Nothing
// procedural touches the arms any more, but every motion-capture clip animates
// them, so stopMotion has to put back these EXACT values — they are the single
// source of truth for the rest pose.
const ARM_PINS: ReadonlyArray<readonly [BoneName, number]> = [
  ['leftUpperArm', ARM_REST_UPPER_Z],
  ['rightUpperArm', -ARM_REST_UPPER_Z],
  ['leftLowerArm', ARM_REST_FORE_Z],
  ['rightLowerArm', -ARM_REST_FORE_Z],
  ['leftHand', 0],
  ['rightHand', 0],
]

// Finger bones, all 30 of them (this model carries the full VRM0 set). They
// rest at identity, and the motion-capture clips animate every one of them (a
// peace sign is nothing without fingers), so the restore has to cover them:
// `stopMotion` calls pinArms, and a bone it does not list keeps whatever the
// clip left on it for the rest of the page.
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

// ---- gesture / idle-act library --------------------------------------------
// Every gesture is a pure per-frame function: p ∈ [0,1] is progress, env is
// the sin(pπ) ease envelope, v ∈ {-1, 1} picks a random side per trigger, and
// offsets accumulate into `o` (ADDED to the mode-driven pose downstream).
// No gesture writes a bone directly any more, which is why none of them needs
// an interruption path: the offsets simply stop being accumulated.
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
  // Seconds spent parked at full envelope between the two. Every survivor
  // leaves this at 0 and keeps the pure sine it was tuned with; the plateau
  // existed for named arm poses, which motion capture owns now.
  hold?: number
  apply: (p: number, env: number, v: number, o: GestureOffsets) => void
}

const bone = (v: VRM, n: BoneName) => v.humanoid?.getNormalizedBoneNode(n)

const GESTURES: Record<GestureName, GestureDef> = {
  // -- cue-driven ------------------------------------------------------------
  bow: {
    dur: 1.5,
    apply: (_p, env, _v, o) => {
      o.sx += env * 0.32
      o.hp += env * 0.18
    },
  },
  nod: {
    dur: 0.9,
    // two down-beats inside one smooth envelope
    apply: (p, env, _v, o) => {
      o.hp += Math.sin(p * Math.PI * 2) * 0.14 * env
    },
  },
  // -- head-pat response -----------------------------------------------------
  wiggle: {
    dur: 0.9,
    apply: (p, env, _v, o) => {
      o.hr += Math.sin(p * Math.PI * 4) * 0.09 * env
    },
  },
  // -- ambient beats ---------------------------------------------------------
  // What is left of the hand-authored library. Every one of these moves only
  // the head and the torso by a few degrees, which is why they survived the
  // 2026-08-19 audit intact while all ten arm gestures were replaced by motion
  // capture: an arm has to arrive somewhere specific, and a three-degree lean
  // does not.
  tilt: {
    dur: 1.6,
    // curious head tilt to a random side
    apply: (_p, env, v, o) => {
      o.hr += v * 0.16 * env
      o.hy += v * 0.05 * env
    },
  },
  glance: {
    dur: 2.2,
    // quick look one way then the other, eyes leading the head
    apply: (p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.hy += v * w * 0.35
      o.ex += v * w * 1.4
    },
  },
  swayStep: {
    dur: 2.0,
    // one exaggerated weight shift, head countering to stay level
    apply: (p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.sz += v * w * 0.05
      o.hr += -v * w * 0.03
    },
  },
  bounce: {
    dur: 1.2,
    // three quick little body dips — a hop feel without any translation
    apply: (p, env, _v, o) => {
      const w = Math.abs(Math.sin(p * Math.PI * 3)) * env
      o.sx += w * 0.05
      o.hp += w * 0.05
    },
  },
  hipTwist: {
    dur: 1.8,
    // small torso twist left-right, head countering
    apply: (p, env, v, o) => {
      const w = Math.sin(p * Math.PI * 2) * env
      o.sy += v * w * 0.12
      o.hy += -v * w * 0.06
    },
  },
  toeLook: {
    dur: 2.0,
    // peers down at the floor by her feet
    apply: (_p, env, v, o) => {
      o.hp += env * 0.3
      o.hy += v * 0.1 * env
      o.ey += -env * 2
    },
  },
}

// What the idle timer may pick from. Cue gestures and the pat response stay
// out — they belong to their own triggers.
const IDLE_ACTS: readonly GestureName[] = [
  'tilt',
  'glance',
  'swayStep',
  'bounce',
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
  // Hands are contained by the canvas WIDTH, which is separate from everything
  // above because the fov is vertical. What has to fit is no longer computed
  // from an arm model here: rigProbe.test.ts measures every bundled clip
  // against each placement's frame on the real skeleton.
  const camera = new THREE.PerspectiveCamera(AVATAR_FOV, W / H, 0.1, 30)
  // The framing the PLACEMENT asks for, which setFraming replaces. What the
  // camera is actually pointed at is this plus `framePan` — the clip-driven
  // slide below — so the two are kept apart: the pan must not overwrite the
  // placement, and a placement change must re-ask the clip rather than drag the
  // old frame's pan into the new composition (see setFraming).
  let framingDistance = AVATAR_FRAMING_DEFAULT.distance
  let framingLookAtY = AVATAR_FRAMING_DEFAULT.lookAtY
  // Where the current clip wants the frame, and where it is on the way there.
  let framePan = 0
  // What the running clip is asking for RIGHT NOW. Zero while nothing is playing
  // and from the moment a settle starts, so the camera comes home with her arms.
  // One definition, because three callers read it and they must not disagree:
  // the render loop eases toward it, and setPlacement and setFraming land on it
  // when the composition cuts.
  function panTargetNow(): number {
    if (!motionAction || settleDur > 0) return 0
    return motionPan(motionName, motionFrame(placement))
  }
  function aimCamera(): void {
    const y = framingLookAtY + framePan
    camera.position.set(0, y + AVATAR_CAMERA_TILT, framingDistance)
    camera.lookAt(0, y, 0)
  }
  aimCamera()
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
      const restHipsNode = loaded.humanoid?.getNormalizedBoneNode('hips')
      if (restHipsNode) restHips.copy(restHipsNode.position)
      // Where the pinned rest pose puts her wrists. Every settle measures how
      // far it has to travel against these, so it has to be read here, from the
      // pose pinArms just wrote, before any clip has touched a bone.
      loaded.scene.updateMatrixWorld(true)
      loaded.humanoid?.getNormalizedBoneNode('leftHand')?.getWorldPosition(restWristL)
      loaded.humanoid?.getNormalizedBoneNode('rightHand')?.getWorldPosition(restWristR)
      // createVRMAnimationClip() needs somewhere to bind a clip's look-at track
      // and builds this itself, with a console warning, if the scene has none.
      // None of the bundled clips carries such a track, so this exists purely
      // to keep the console clean; her gaze stays on eyeTarget throughout.
      if (loaded.lookAt) {
        const proxy = new VRMLookAtQuaternionProxy(loaded.lookAt)
        proxy.name = 'VRMLookAtQuaternionProxy'
        loaded.scene.add(proxy)
      }
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

  // ---- motion-capture playback ------------------------------------------
  //
  // The arm half of her performance is motion capture now (see avatarMotions.ts
  // for why, and rigProbe.ts for what keeps it honest). A clip drives the
  // humanoid bones through an AnimationMixer, so while one is running the
  // procedural writes to head/neck/spine/chest/hips have to stand down or they
  // fight the capture for the same bones. Expressions are a separate channel
  // and keep running throughout: she still blinks, lip-syncs and emotes mid-clip.
  let mixer: THREE.AnimationMixer | null = null
  let motionAction: THREE.AnimationAction | null = null
  let motionName: AvatarMotionName | null = null
  const motionClips = new Map<AvatarMotionName, THREE.AnimationClip>()
  let motionsRequested = false
  // Where the hips sit at rest. A clip animates hips POSITION, and the
  // procedural layer only ever writes hips rotation, so without restoring this
  // by hand she would keep whatever offset the clip ended on for the life of
  // the page.
  const restHips = new THREE.Vector3()
  // Where the pinned rest pose puts each wrist, filled in at load. A settle's
  // duration is the distance from here, so a clip that ends with an arm out
  // takes longer to put it down than one that ends already standing.
  const restWristL = new THREE.Vector3()
  const restWristR = new THREE.Vector3()
  // Scratch for the settle's distance measurement, allocated once.
  const settleProbe = new THREE.Vector3()
  // Scratch for the ?mikadebug hips readout below; the tap runs every frame.
  const debugHips = new THREE.Vector3()

  const motionLoader = new GLTFLoader()
  motionLoader.register((p) => new VRMAnimationLoaderPlugin(p))

  function loadMotion(name: AvatarMotionName): void {
    if (motionClips.has(name)) return
    motionLoader.load(
      MOTION_URL(name),
      (gltf) => {
        const animation = (gltf.userData.vrmAnimations as VRMAnimation[] | undefined)?.[0]
        // contextLost as well as disposed: a reclaimed context unmounts the
        // whole wrapper, and building clips for a dead VRM just holds ~2.5MB.
        if (!animation || !vrm || disposed || contextLost) return
        motionClips.set(name, createVRMAnimationClip(animation, vrm))
      },
      undefined,
      // A missing or corrupt clip costs her one idle beat, never the page: the
      // idle picker simply finds nothing cached and falls back to a procedural
      // act. Nothing here is allowed to throw into the rAF loop.
      () => {},
    )
  }

  // Deliberately NOT part of first paint. These are fetched once the entrance
  // has played, so the 2.5MB of clips lands behind the 5.5MB model rather than
  // racing it, and only for a visitor who actually sees her.
  function requestMotions(): void {
    if (motionsRequested || !vrm) return
    motionsRequested = true
    for (const name of IDLE_MOTIONS) loadMotion(name)
  }

  // How often the first beat re-checks for the opening clip, and how long it
  // keeps checking. 12s is comfortably past the point where a 2.5MB clip has
  // either arrived or failed on any connection that got the 5.5MB model here,
  // and giving up means falling into the ordinary rotation rather than standing
  // still: a dance that 404s must not cost her every other performance.
  const OPENING_RETRY = 0.4
  const OPENING_GRACE = 12

  // Seconds a clip takes to take the bones OVER, at entry. The exit is a settle
  // instead, timed by distance and eased — see beginSettle and settleSeconds.
  const MOTION_FADE = 0.25

  /**
   * Start handing the bones back to the pinned rest pose.
   *
   * Called at all three exits: the clip finishing, the visitor interrupting,
   * and a gesture outranking it. The duration comes from how far her wrists
   * currently are from where rest puts them, so it is the same settle SPEED
   * every time whatever the clip left behind.
   *
   * three's own fadeOut is not used: it warps the weight linearly, which is the
   * velocity step this replaced. Manual weight and the scheduled kind compound
   * (`_updateWeight` multiplies them), so any fade still running is cleared.
   */
  function beginSettle(): void {
    if (!motionAction || settleDur > 0 || !vrm) return
    motionAction.stopFading()
    const h = vrm.humanoid
    let far = 0
    const l = h?.getNormalizedBoneNode('leftHand')
    if (l) far = Math.max(far, l.getWorldPosition(settleProbe).distanceTo(restWristL))
    const r = h?.getNormalizedBoneNode('rightHand')
    if (r) far = Math.max(far, r.getWorldPosition(settleProbe).distanceTo(restWristR))
    settleDur = settleSeconds(far)
    settleT = 0
  }

  function stopMotion(): void {
    if (!motionAction) return
    motionAction.stop()
    motionAction = null
    motionName = null
    settleDur = 0
    settleT = 0
    if (vrm) {
      // The mixer leaves every bone it touched at the clip's last frame. The
      // procedural layer rewrites head/neck/spine every frame, but nothing
      // rewrites the arms or the hips offset, so those are restored here.
      pinArms(vrm)
      const hips = vrm.humanoid?.getNormalizedBoneNode('hips')
      if (hips) hips.position.copy(restHips)
    }
  }

  function playMotion(name: AvatarMotionName): boolean {
    const clip = motionClips.get(name)
    if (!clip || !vrm) return false
    if (!mixer) mixer = new THREE.AnimationMixer(vrm.scene)
    stopMotion()
    const action = mixer.clipAction(clip)
    action.reset()
    // clipAction hands back the SAME action object every time this clip plays,
    // and `weight` is not one of the fields reset() clears. The settle leaves it
    // at 0, and fadeIn MULTIPLIES its ramp by it, so without this the second
    // play of any clip runs to completion at weight 0: she stands still for
    // eleven seconds and then settles out of a pose she never struck.
    action.setEffectiveWeight(1)
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    // Both ends of every bundled clip are a standing rest pose (pinned by
    // rigProbe.test.ts), so this fade only has to cover the head turn the
    // procedural layer may be mid-way through.
    action.fadeIn(MOTION_FADE)
    action.play()
    motionAction = action
    motionName = name
    return true
  }

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
  // Where the fixed clip rotation has got to. Replaced a random pick with a
  // single re-roll on 2026-08-30: the re-roll only ever ruled out an IMMEDIATE
  // repeat, so the same clip three times in five beats stayed as likely as it
  // sounds, and the owner asked for a set order opening on the dance.
  let rotation = IDLE_ROTATION_START
  // How long the first beat has held out for the opening clip. The ten clips
  // are requested together once the entrance has played and land in whatever
  // order the network returns; the dance is the largest, so it is routinely not
  // the first to arrive, and without this wait the opening would be whichever
  // clip won that race.
  let openingWaited = 0
  // A clip that is settling still owns its bones, so it has to keep being
  // advanced until its weight reaches zero. `settleDur > 0` is what says one is
  // under way, which is also what stops it being restarted every frame.
  let settleDur = 0
  let settleT = 0
  // Which composition she is standing in. Only the clips measured against that
  // frame are eligible — see motionsFor().
  let placement: AvatarPlacement = 'launcher'
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
          requestMotions()
        }
      }

      // A running clip owns the humanoid bones. It is advanced before anything
      // procedural reads or writes them, and `motionActive` gates every write
      // below that would otherwise be applied on top of the capture.
      if (motionAction && mixer) {
        // Finishing was the one exit that was a hard cut. A clip's last frame
        // leaves her wrists 0.060m (`squat`) to 0.540m (`dance`) from ARM_PINS,
        // and stopMotion used to snap them back in a single frame.
        //
        // The settle runs AFTER the clip rather than over its last frames:
        // clampWhenFinished holds the final pose (three pauses the action and
        // leaves it enabled, so the mixer keeps accumulating it), so the whole
        // performance plays and then she puts her arms down. Overlapping would
        // eat the tail of a 4.5s clip for a settle that can last 0.75s.
        //
        // What actually returns the bones is three's PropertyMixer: it lerps
        // toward the value each bone held before the action bound, which is the
        // pinned rest pose, so weight 0 IS rest and stopMotion's pinArms below
        // only re-affirms it.
        //
        // Order matters: the weight is written BEFORE the mixer applies it, so
        // the last weight a settle computes is 0 and the pose the pin lands on
        // is already rest. Written after, every settle would end on a one-frame
        // cut of whatever weight was still standing.
        if (settleDur > 0) {
          settleT += dt
          motionAction.setEffectiveWeight(settleWeight(settleT, settleDur))
        }
        mixer.update(dt)
        if (settleDur === 0 && !motionAction.isRunning()) beginSettle()
        else if (settleDur > 0 && settleT >= settleDur) stopMotion()
      }
      const motionActive = motionAction !== null

      // The clip-driven camera slide. A clip that does not fit the composition
      // it is played in (only `dance`, which leaves the waist-up frame at the
      // bottom and the column at the top) declares how far the frame has to move
      // to hold it; the camera eases there while the clip runs and eases back the
      // moment it starts putting its arms down, so the shot resolves as she does.
      // Every other clip asks for 0 and the filter's epsilon parks the camera
      // exactly where the placement put it — no per-frame matrix writes when
      // nothing is panning.
      const panTarget = panTargetNow()
      if (framePan !== panTarget) {
        framePan = stepFramePan(framePan, panTarget, dt)
        aimCamera()
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

      // She stops performing the moment the visitor does something. A clip is
      // faded rather than cut: its own bones are mid-travel, so dropping it
      // would snap an arm back to her side in one frame.
      if (mode !== 'idle' && motionAction) beginSettle()

      // Idle self-actions: an unprompted little performance roughly every 5s
      // of undisturbed idle (post-entrance, nothing else performing). Two
      // thirds of those beats are a motion-capture clip and the rest are the
      // procedural head and torso beats, which are short enough to read as
      // punctuation between the clips. A single re-roll makes an immediate
      // repeat unlikely without ever risking a loop.
      const speechIdle = !speechEl || speechEl.paused || speechEl.ended
      if (
        matzT === 2 &&
        mode === 'idle' &&
        !gesture &&
        !motionActive &&
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
          const order = motionsFor(placement)
          // The opening beat is never a gesture. The procedural acts are
          // punctuation between clips, and letting one win the first roll would
          // make her first move a shrug on two visits out of three.
          const clipTurn = !rotation.opened || Math.random() < 0.66
          const { pick, next } = clipTurn
            ? nextIdleMotion(
                order,
                (name) => motionClips.has(name),
                rotation,
                openingWaited >= OPENING_GRACE,
              )
            : { pick: null, next: rotation }
          rotation = next
          if (pick) {
            openingWaited = 0
            playMotion(pick)
            idleActTimer = 2.5 + Math.random() * 1.5
          } else if (clipTurn && !rotation.opened) {
            // Still waiting on the dance. Come back sooner than a normal beat so
            // she opens promptly once it lands, and count the wait so a clip
            // that never arrives cannot hold the rotation shut for good. No
            // early exit here: everything below still has to run this frame.
            openingWaited += OPENING_RETRY
            idleActTimer = OPENING_RETRY
          } else {
            let act = IDLE_ACTS[(Math.random() * IDLE_ACTS.length) | 0]
            if (act === lastIdleAct) act = IDLE_ACTS[(Math.random() * IDLE_ACTS.length) | 0]
            lastIdleAct = act
            gesture = { name: act, t: 0, v: Math.random() < 0.5 ? -1 : 1 }
            idleActTimer = 2.5 + Math.random() * 1.5
          }
        }
      } else if (mode !== 'idle') {
        idleActTimer = Math.max(idleActTimer, 4)
      }

      // Gesture offsets ADD to the mode-driven head/spine pose (a nod during
      // listening still tracks the visitor). Nothing here touches an arm any
      // more: arms are either pinned or driven by a clip. All the curves live
      // in the GESTURES table.
      OFF.hp = OFF.hy = OFF.hr = OFF.sx = OFF.sy = OFF.sz = OFF.cx = OFF.ex = OFF.ey = 0
      if (gesture) {
        gesture.t += dt
        const def = GESTURES[gesture.name]
        const total = def.dur + (def.hold ?? 0)
        const p = Math.min(gesture.t / total, 1)
        const env = gestureEnvelope(gesture.t, def.dur, def.hold ?? 0)
        def.apply(p, env, gesture.v, OFF)
        if (p >= 1) gesture = null
      }

      // Breathing on the chest and a slow weight shift on the hips, with the
      // spine countering so the head stays centred — the body never freezes.
      // All of it stands down under a clip: the capture already carries its own
      // breathing and weight, and writing on top of it would both double the
      // motion and drag her head away from where the performance put it.
      const head = vrm.humanoid?.getNormalizedBoneNode('head')
      const neck = vrm.humanoid?.getNormalizedBoneNode('neck')
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine')
      const chest = vrm.humanoid?.getNormalizedBoneNode('chest')
      const hips = vrm.humanoid?.getNormalizedBoneNode('hips')
      // How much of these bones the procedural layer owns this frame. A clip at
      // full weight owns them outright; as it fades the procedural pose takes
      // them back in step, so a gesture that interrupted a clip is visible from
      // its first frame instead of after the fade. With no clip this is 1 and
      // every lerp below collapses to a plain assignment.
      const proceduralW = motionAction ? 1 - motionAction.getEffectiveWeight() : 1
      if (proceduralW > 0.001) {
        const blend = (current: number, target: number): number =>
          THREE.MathUtils.lerp(current, target, proceduralW)
        const sway = Math.sin(t * ((2 * Math.PI) / 13))
        if (chest) {
          chest.rotation.x = blend(
            chest.rotation.x,
            Math.sin(t * ((2 * Math.PI) / 4.2)) * 0.012 + OFF.cx,
          )
        }
        if (hips) hips.rotation.z = blend(hips.rotation.z, sway * 0.02)
        if (head) {
          head.rotation.y = blend(head.rotation.y, yaw * 0.65 + OFF.hy)
          head.rotation.x = blend(head.rotation.x, pitch * 0.7 + OFF.hp)
          head.rotation.z = blend(head.rotation.z, OFF.hr)
        }
        if (neck) {
          neck.rotation.y = blend(neck.rotation.y, yaw * 0.35)
          neck.rotation.x = blend(neck.rotation.x, pitch * 0.3)
        }
        if (spine) {
          spine.rotation.y = blend(spine.rotation.y, yaw * 0.1 + OFF.sy)
          spine.rotation.x = blend(spine.rotation.x, OFF.sx)
          spine.rotation.z = blend(spine.rotation.z, sway * -0.012 + OFF.sz)
        }
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
          motion: motionName,
          motionW: motionAction ? motionAction.getEffectiveWeight() : 0,
          motionClips: motionClips.size,
          placement,
          // Hips WORLD height: the one number that says whether a clip's hips
          // translation track reached the model at all. `squat` is meant to
          // take her from 0.878 down to 0.660.
          hipsY: bone(vrm, 'hips')?.getWorldPosition(debugHips).y ?? 0,
          // The camera, read off the camera rather than echoed from `framePan`:
          // the pan is only real once aimCamera() has run. Its own tilt is
          // subtracted so this is the height the frame is centred on, which is
          // what the frame's edges are computed from.
          camLookY: camera.position.y - AVATAR_CAMERA_TILT,
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
      // A head pat or a cue beat is a RESPONSE to the visitor, so it outranks
      // whatever idle clip happens to be running. Without this the clip keeps
      // the bones, the gesture burns its whole duration producing no movement,
      // and the pat's 8s cooldown starts on a pat nobody saw — and clips run
      // most of the idle wall-clock, so that was most pats.
      beginSettle()
      gesture = { name, t: 0, v: Math.random() < 0.5 ? -1 : 1 }
    },
    playMotion,
    readyMotions: () => motionsFor(placement).filter((name) => motionClips.has(name)),
    setPlacement: (next) => {
      const before = motionFrame(placement)
      placement = next
      // The same landing as setFraming, on the same condition: the COMPOSITION
      // changed. Landing it here too means neither call has to run first —
      // AvatarGuide drives them from two effects and nothing in the type system
      // fixes their order, so whichever arrives second re-asks the clip and both
      // agree on the answer.
      //
      // The frame check is not decoration. launcher and beside-panel share both
      // a framing and a frame, so a move between them calls THIS and not
      // setFraming (ChatWidget passes `framing` only in the column), and there
      // is no cut to ride. Landing unconditionally would snap a mid-ease pan up
      // to 80mm in one frame — 20px on the launcher canvas — for a transition
      // that was continuous before.
      if (motionFrame(next) !== before) {
        framePan = panTargetNow()
        aimCamera()
      }
    },
    setFraming: (distance, lookAtY) => {
      framingDistance = distance
      framingLookAtY = lookAtY
      // A framing change is a composition CUT: 1.32 to 1.016 in one frame, far
      // bigger than any pan. So the clip's pan lands on the new frame's number in
      // the same call, riding that cut. Easing to it instead leaves the camera
      // between two compositions for the best part of a second — measured at
      // lookAtY 0.957 for ~600ms when the visitor goes fullscreen mid-`dance`, a
      // 1.543 top edge against hair that reaches 1.7276.
      //
      // Which of this and setPlacement runs first does not matter: on the mount
      // path AvatarGuide calls this one first, on a placement change the other,
      // and both land the same number, so the second call is a no-op.
      framePan = panTargetNow()
      aimCamera()
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
