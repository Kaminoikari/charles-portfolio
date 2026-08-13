// Framework-free engine for the 3D avatar guide (mirrors the faceHero.ts
// pattern: a React shell mounts a canvas, this module owns everything inside).
//
// Loads a VRM humanoid and drives it from AvatarMode:
//   idle      → head sweeps left/right (bone rotation, never translation)
//   listening → head tilts up/down
//   speaking  → uneven viseme loop + albedo tint toward mars orange, lerped
//               back once the stream ends
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

export type AvatarGuideHandle = {
  setMode: (mode: AvatarMode) => void
  // Rendering gate for "mounted but not visible" (e.g. fullscreen chat covers
  // the avatar). Keeps the engine warm so no VRM reload on the way back.
  setActive: (active: boolean) => void
  dispose: () => void
}

const VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const
// Multiply-tint target while answering; reads as #E8652B over the sample's
// mostly-light albedo without crushing dark materials to black.
const ANSWER_TINT = new THREE.Color(1.0, 0.62, 0.38)

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
      const arm = (n: Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0], z: number) => {
        const b = loaded.humanoid?.getNormalizedBoneNode(n)
        if (b) b.rotation.z = z
      }
      arm('leftUpperArm', 1.15)
      arm('rightUpperArm', -1.15)
      arm('leftLowerArm', 0.25)
      arm('rightLowerArm', -0.25)
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
      vrm = loaded
      // onLoaded intentionally NOT fired here — see the frame loop, which
      // reports after the first real render instead.
    },
    undefined,
    // Loading is best-effort chrome: on failure the launcher's static fallback
    // stays, so there is nothing to surface to the visitor here.
    () => {},
  )

  // ---- per-frame state ----
  // Manual timing (faceHero convention): THREE.Clock is deprecated in three
  // 0.183. `t` derives from absolute performance.now() so the idle/listening
  // sinusoids stay wall-clock-phased across pauses; `dt` is clamped so a long
  // background stint can't fast-forward blink/viseme timers on resume.
  let prevMs = performance.now()
  let tint = 0
  let currentViseme: (typeof VISEMES)[number] | null = null
  let visemeTimer = 0
  let visemeHold = 0.11
  let blinkTimer = 1.6
  let blinkPhase = -1
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
      const head = vrm.humanoid?.getNormalizedBoneNode('head')
      const neck = vrm.humanoid?.getNormalizedBoneNode('neck')
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine')
      if (head) {
        head.rotation.y = yaw * 0.65
        head.rotation.x = pitch * 0.7
      }
      if (neck) {
        neck.rotation.y = yaw * 0.35
        neck.rotation.x = pitch * 0.3
      }
      if (spine) spine.rotation.y = yaw * 0.1
      eyeTarget.position.set(Math.sin(yaw) * 6, 1.35 + Math.sin(pitch) * -4, 4)

      // Blink in every mode.
      blinkTimer -= dt
      if (blinkTimer <= 0 && blinkPhase < 0) blinkPhase = 0
      if (blinkPhase >= 0) {
        blinkPhase += dt
        const w = blinkPhase < 0.06 ? blinkPhase / 0.06 : Math.max(0, 1 - (blinkPhase - 0.06) / 0.08)
        vrm.expressionManager?.setValue('blink', w)
        if (blinkPhase > 0.15) {
          blinkPhase = -1
          blinkTimer = 1.5 + Math.random() * 3.5
        }
      }

      // Mouth: speaking cycles visemes on an uneven cadence — an even steps()
      // beat reads as a machine. ~18% of beats close the mouth so it breathes.
      if (mode === 'speaking') {
        visemeTimer -= dt
        if (visemeTimer <= 0) {
          if (currentViseme) vrm.expressionManager?.setValue(currentViseme, 0)
          currentViseme = Math.random() < 0.18 ? null : VISEMES[(Math.random() * VISEMES.length) | 0]
          visemeHold = 0.07 + Math.random() * 0.13
          visemeTimer = visemeHold
        }
        if (currentViseme) {
          // attack–decay envelope, not a square wave
          const p = 1 - visemeTimer / visemeHold
          const w = Math.sin(Math.min(p, 1) * Math.PI) * 0.65
          vrm.expressionManager?.setValue(currentViseme, w)
        }
      } else if (currentViseme) {
        vrm.expressionManager?.setValue(currentViseme, 0)
        currentViseme = null
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
    dispose: () => {
      disposed = true
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
      renderer.forceContextLoss()
      renderer.dispose()
    },
  }
}
