// Framework-free engine for the 3D avatar guide (mirrors the faceHero.ts
// pattern: a React shell mounts a canvas, this module owns everything inside).
//
// Loads a VRM humanoid and drives it from AvatarMode:
//   idle      → head sweeps left/right (bone rotation, never translation)
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
//   - gestures: procedural wave/bow/nod, additive over the mode pose
//   - life: breathing, slow weight shift, eye saccades, 12% double blinks
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
import type { AvatarMode } from './avatarMode'
import { sampleViseme } from './visemeTrack'
import { VISEME_NAMES, type VisemeTrack } from './voiceVisemes.gen'

// VRM0 models expose joy/angry/sorrow/fun, which three-vrm normalises to
// happy/angry/sad/relaxed. surprised only exists on VRM1 models — setEmotion
// checks availability at runtime and silently skips unknown presets, so a
// future custom model upgrades expressiveness without touching callers.
export type EmotionName = 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised'
export type GestureName = 'wave' | 'bow' | 'nod'

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
  dispose: () => void
}

// Multiply-tint target while answering; reads as #E8652B over the sample's
// mostly-light albedo without crushing dark materials to black.
const ANSWER_TINT = new THREE.Color(1.0, 0.62, 0.38)

type BoneName = Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0]
// VRM0 rest pose is a T-pose; these Z rotations bring the arms down. The wave
// gesture borrows the right arm and must restore these EXACT values — they are
// the single source of truth for the rest pose.
const ARM_PINS: ReadonlyArray<readonly [BoneName, number]> = [
  ['leftUpperArm', 1.15],
  ['rightUpperArm', -1.15],
  ['leftLowerArm', 0.25],
  ['rightLowerArm', -0.25],
  ['rightHand', 0],
]

function pinArms(v: VRM) {
  for (const [name, z] of ARM_PINS) {
    const b = v.humanoid?.getNormalizedBoneNode(name)
    if (b) b.rotation.set(0, 0, z)
  }
}

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

  const W = canvas.clientWidth || 180
  const H = canvas.clientHeight || 280
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(W, H, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(27, W / H, 0.1, 30)
  camera.position.set(0, 0.95, 3.9)
  camera.lookAt(0, 0.82, 0)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(0.6, 1.6, 2.2)
  scene.add(key)

  let vrm: VRM | null = null
  const eyeTarget = new THREE.Object3D()
  eyeTarget.position.set(0, 1.35, 4)
  scene.add(eyeTarget)
  // MToon albedo per material, captured once so the answering tint can lerp
  // from the true base instead of compounding on itself frame over frame. The
  // tinted endpoint is a pure function of the base, so it's precomputed here
  // rather than allocated per material per frame inside the render loop.
  let mats: { m: THREE.Material & { color: THREE.Color }; base: THREE.Color; tinted: THREE.Color }[] = []

  const loader = new GLTFLoader()
  loader.register((p) => new VRMLoaderPlugin(p))
  loader.load(
    vrmUrl,
    (gltf) => {
      if (disposed) {
        // Disposed while the 15MB VRM was still parsing: nobody else will ever
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
          if (withColor.color)
            mats.push({
              m: withColor as never,
              base: withColor.color.clone(),
              tinted: ANSWER_TINT.clone().multiply(withColor.color),
            })
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
  let saccadeTimer = 0.9
  let saccadeX = 0
  let saccadeY = 0
  let gesture: { name: GestureName; t: number; dur: number } | null = null
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
      // Head direction per mode — rotation on head/neck/spine, eyes tracking a
      // real target so the gaze leads the turn the way people actually look.
      let yaw = 0
      let pitch = 0
      if (mode === 'idle') {
        yaw = Math.sin(t * ((2 * Math.PI) / 5.2)) * 0.42
        pitch = Math.sin(t * ((2 * Math.PI) / 9.1)) * 0.05
      } else if (mode === 'listening') {
        pitch = Math.sin(t * ((2 * Math.PI) / 1.6)) * 0.16 - 0.04
        yaw = Math.sin(t * ((2 * Math.PI) / 7.0)) * 0.06
      } else {
        yaw = Math.sin(t * ((2 * Math.PI) / 6.5)) * 0.07
        pitch = Math.sin(t * ((2 * Math.PI) / 4.3)) * 0.03
      }
      // Gesture offsets ADD to the mode-driven head/spine pose (a nod during
      // listening still tracks the visitor); the right arm is the exception —
      // it's pinned, not mode-driven, so the wave owns it and restores the pin.
      let gestureHeadPitch = 0
      let gestureSpineX = 0
      if (gesture) {
        gesture.t += dt
        const p = Math.min(gesture.t / gesture.dur, 1)
        const env = Math.sin(p * Math.PI)
        if (gesture.name === 'wave') {
          const rua = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
          const rla = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
          const rh = vrm.humanoid?.getNormalizedBoneNode('rightHand')
          if (rua) rua.rotation.z = -1.15 + env * 0.85
          if (rla) rla.rotation.z = -0.25 - env * 0.75
          if (rh) rh.rotation.z = Math.sin(gesture.t * 14) * 0.45 * env
        } else if (gesture.name === 'bow') {
          gestureSpineX = env * 0.32
          gestureHeadPitch = env * 0.18
        } else {
          // nod: two down-beats inside one smooth envelope
          gestureHeadPitch = Math.sin(p * Math.PI * 2) * 0.14 * env
        }
        if (p >= 1) {
          if (gesture.name === 'wave') pinArms(vrm)
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
      if (chest) chest.rotation.x = Math.sin(t * ((2 * Math.PI) / 4.2)) * 0.012
      if (hips) hips.rotation.z = sway * 0.02
      if (head) {
        head.rotation.y = yaw * 0.65
        head.rotation.x = pitch * 0.7 + gestureHeadPitch
      }
      if (neck) {
        neck.rotation.y = yaw * 0.35
        neck.rotation.x = pitch * 0.3
      }
      if (spine) {
        spine.rotation.y = yaw * 0.1
        spine.rotation.x = gestureSpineX
        spine.rotation.z = sway * -0.012
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
        Math.sin(yaw) * 6 + saccadeX,
        1.35 + Math.sin(pitch) * -4 + saccadeY,
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
        visemeTargetW = 0.85
      } else if (mode === 'speaking') {
        visemeTimer -= dt
        if (visemeTimer <= 0) {
          // ~18% of beats close the mouth so it breathes
          randViseme = Math.random() < 0.18 ? -1 : (Math.random() * VISEME_NAMES.length) | 0
          visemeHold = 0.07 + Math.random() * 0.13
          visemeTimer = visemeHold
        }
        visemeTarget = randViseme
        visemeTargetW = 0.65
      }
      for (let i = 0; i < visemeW.length; i++) {
        visemeW[i] += ((i === visemeTarget ? visemeTargetW : 0) - visemeW[i]) * Math.min(1, dt * 22)
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
          vrm.expressionManager?.setValue(emoFade.name, 0)
          emoFade = null
        } else {
          vrm.expressionManager?.setValue(emoFade.name, emoFade.w)
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
          vrm.expressionManager?.setValue(emoName, 0)
          emoName = null
          emoW = 0
          emoShown = 0
        } else {
          vrm.expressionManager?.setValue(emoName, emoShown)
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
          speechT: speechActive && sEl ? sEl.currentTime : -1,
          // Read back from the scene graph, not echoed from the math — proves
          // the bones actually moved, for the automated probe.
          chestX: chest ? chest.rotation.x : 0,
          hipsZ: hips ? hips.rotation.z : 0,
          headX: head ? head.rotation.x : 0,
          spineX: spine ? spine.rotation.x : 0,
        }
      }

      // Answering tint, lerped both directions so the colour never snaps.
      const target = mode === 'speaking' ? 1 : 0
      tint += (target - tint) * Math.min(1, dt * 4)
      if (tint > 0.001) {
        for (const { m, base, tinted } of mats) m.color.copy(base).lerp(tinted, tint)
      } else if (tint !== 0) {
        for (const { m, base } of mats) m.color.copy(base)
        tint = 0
      }

      vrm.expressionManager?.update()
      vrm.update(dt) // spring bones (hair, skirt) advance here
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

  return {
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
    setEmotion: (name, weight = 1, holdSec = 2.4) => {
      if (!availableEmotions.has(name)) return // this model doesn't ship the preset (VRM0 has no surprised)
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
          if (emoFade) vrm?.expressionManager?.setValue(emoFade.name, 0)
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
    },
    playGesture: (name) => {
      // Replacing a mid-flight wave must not strand a half-raised arm.
      if (gesture?.name === 'wave' && vrm) pinArms(vrm)
      gesture = { name, t: 0, dur: name === 'wave' ? 1.6 : name === 'bow' ? 1.5 : 0.9 }
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
      // Without forceContextLoss the browser keeps the GL context alive until
      // it feels like collecting it — same hard-won note as faceHero's dispose.
      // Skip it when the context is already gone: three warnOnce()s about the
      // missing WEBGL_lose_context extension on a dead context.
      if (!contextLost) renderer.forceContextLoss()
      renderer.dispose()
    },
  }
}
