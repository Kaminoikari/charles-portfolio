import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { cinematicShader, globalFadeForTime } from './passes/cinematic'
import {
  createAudioBus,
  disposeAudioBus,
  fadeMaster,
  scheduleBeat1,
  scheduleBeat2,
  scheduleBeat3,
  scheduleBeat4,
  scheduleBeat5,
  scheduleBeat6,
  scheduleBeat7,
  scheduleBeat8,
  scheduleBeat9,
} from './audio'
import type { Beat, BeatScene, SceneContext } from './types'
import { createAwakening } from './scenes/awakening'
import { createNebula } from './scenes/nebula'
import { createJet } from './scenes/jet'
import { createDyson } from './scenes/dyson'
import { createLance } from './scenes/lance'
import { createWarp } from './scenes/warp'
import { createIgnition } from './scenes/ignition'
import { createConvergence } from './scenes/convergence'
import { createSnap } from './scenes/snap'

const BEATS: Beat[] = [
  { name: 'awakening',   start: 0.0,  end: 1.2,  factory: createAwakening },
  { name: 'nebula',      start: 1.2,  end: 3.0,  factory: createNebula },
  { name: 'jet',         start: 3.0,  end: 4.5,  factory: createJet },
  { name: 'dyson',       start: 4.5,  end: 6.0,  factory: createDyson },
  { name: 'lance',       start: 6.0,  end: 7.0,  factory: createLance },
  { name: 'warp',        start: 7.0,  end: 8.5,  factory: createWarp },
  { name: 'ignition',    start: 8.5,  end: 9.5,  factory: createIgnition },
  { name: 'convergence', start: 9.5,  end: 10.8, factory: createConvergence },
  { name: 'snap',        start: 10.8, end: 12.0, factory: createSnap },
]

const SEQUENCE_DURATION = 12.0

let running = false

export function runEasterEggSequence(): Promise<void> {
  if (running) return Promise.resolve()
  running = true
  return new Promise((resolve) => {
    const cleanup = startSequence(() => {
      running = false
      resolve()
    })
    // safety timeout: force-stop after 14s in case of hang
    setTimeout(() => {
      if (running) {
        cleanup()
        running = false
        resolve()
      }
    }, 14_000)
  })
}

function startSequence(onDone: () => void): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Full-screen overlay container.
  const overlay = document.createElement('div')
  overlay.setAttribute('data-easter-egg', 'true')
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: #000; pointer-events: auto;
    opacity: 0; transition: opacity 0.18s ease-out;
  `
  document.body.appendChild(overlay)

  // Lock scrolling during sequence.
  const scrollY = window.scrollY
  const prevBodyStyle = {
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
  }
  document.body.style.position = 'fixed'
  document.body.style.top = `-${scrollY}px`
  document.body.style.width = '100%'
  document.body.style.overflow = 'hidden'

  let disposed = false
  const finish = () => {
    if (disposed) return
    disposed = true
    overlay.style.opacity = '0'
    setTimeout(() => {
      try {
        document.body.style.position = prevBodyStyle.position
        document.body.style.top = prevBodyStyle.top
        document.body.style.width = prevBodyStyle.width
        document.body.style.overflow = prevBodyStyle.overflow
        window.scrollTo(0, scrollY)
      } catch {}
      cleanupResources()
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      onDone()
    }, 200)
  }

  // Reduced motion fallback: brief flash then end.
  if (reducedMotion) {
    overlay.style.background = 'radial-gradient(circle at 50% 50%, #FFE0B0 0%, #000 60%)'
    overlay.style.opacity = '1'
    setTimeout(finish, 800)
    return finish
  }

  const width = window.innerWidth
  const height = window.innerHeight
  const isMobile = width < 768
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)

  // ----- three.js setup -----
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.autoClear = true
  renderer.setClearColor(0x000000, 1.0)
  const canvas = renderer.domElement
  canvas.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%;'
  overlay.appendChild(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 1000)
  camera.position.set(0, 0, 5)

  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(dpr)
  composer.setSize(width, height)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    isMobile ? 0.45 : 0.6,
    0.5,
    0.78,
  )
  composer.addPass(bloom)
  // Cinematic finishing pass: vignette, warm/cool grade, grain, plus a
  // boundary-driven global fade so beat-to-beat transitions read as cuts
  // rather than abrupt swaps.
  const cinematicPass = new ShaderPass(cinematicShader)
  cinematicPass.uniforms.u_resolution.value.set(width, height)
  // Grain reads heavier on low-DPR mobile screens; ease it back there so the
  // image stays clean while still benefiting from the grade and vignette.
  if (isMobile) {
    cinematicPass.uniforms.u_grainStrength.value = 0.028
    cinematicPass.uniforms.u_vignetteStrength.value = 0.34
  }
  composer.addPass(cinematicPass)
  composer.addPass(new OutputPass())

  // ----- audio setup -----
  const audio = createAudioBus()
  // resume immediately (we're on a user gesture path)
  if (audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {})
  fadeMaster(audio, 0.85, 0.15)

  const ctx: SceneContext = { scene, camera, renderer, width, height, audio, isMobile, reducedMotion }

  // Fade overlay in.
  requestAnimationFrame(() => { overlay.style.opacity = '1' })

  // ----- schedule SFX up front (locked to AudioContext clock) -----
  const audioT0 = audio.ctx.currentTime + 0.2
  scheduleBeat1(audio, audioT0 + BEATS[0].start)
  scheduleBeat2(audio, audioT0 + BEATS[1].start)
  scheduleBeat3(audio, audioT0 + BEATS[2].start)
  scheduleBeat4(audio, audioT0 + BEATS[3].start)
  scheduleBeat5(audio, audioT0 + BEATS[4].start)
  scheduleBeat6(audio, audioT0 + BEATS[5].start)
  scheduleBeat7(audio, audioT0 + BEATS[6].start)
  scheduleBeat8(audio, audioT0 + BEATS[7].start)
  scheduleBeat9(audio, audioT0 + BEATS[8].start)

  // ----- beat lifecycle -----
  // Lazy-init scenes on enter, dispose on exit (with crossfade overlap for
  // adjacent beats that share continuity).
  const activeScenes: Map<number, BeatScene> = new Map()
  let activeIndex = -1

  const ensureScene = (idx: number, globalT: number): BeatScene => {
    let s = activeScenes.get(idx)
    if (!s) {
      s = BEATS[idx].factory()
      s.init(ctx)
      s.enter(globalT)
      activeScenes.set(idx, s)
    }
    return s
  }

  const releaseScene = (idx: number) => {
    const s = activeScenes.get(idx)
    if (!s) return
    s.exit()
    s.dispose()
    activeScenes.delete(idx)
  }

  // ----- main loop -----
  const startWall = performance.now()
  let lastWall = startWall
  let raf = 0

  const onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.setSize(w, h)
    cinematicPass.uniforms.u_resolution.value.set(w, h)
  }
  window.addEventListener('resize', onResize)

  const tick = () => {
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    const t = (now - startWall) / 1000
    const dt = Math.min(0.05, (now - lastWall) / 1000)
    lastWall = now

    if (t >= SEQUENCE_DURATION) {
      finish()
      return
    }

    let idx = activeIndex
    for (let i = 0; i < BEATS.length; i++) {
      if (t >= BEATS[i].start && t < BEATS[i].end) {
        idx = i
        break
      }
    }

    if (idx !== activeIndex) {
      for (const k of Array.from(activeScenes.keys())) {
        if (k !== idx) releaseScene(k)
      }
      activeIndex = idx
    }

    try {
      if (idx >= 0) {
        const beat = BEATS[idx]
        const localT = (t - beat.start) / (beat.end - beat.start)
        const scene = ensureScene(idx, t)
        scene.update(t, localT, dt)
      }
      cinematicPass.uniforms.u_time.value = t
      cinematicPass.uniforms.u_globalFade.value = globalFadeForTime(t)
      composer.render()
    } catch (err) {
      console.error('[easter-egg] tick error', err)
      finish()
    }
  }

  raf = requestAnimationFrame(tick)

  function cleanupResources() {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    for (const k of Array.from(activeScenes.keys())) releaseScene(k)
    fadeMaster(audio, 0.0, 0.2)
    setTimeout(() => disposeAudioBus(audio), 250)
    composer.dispose()
    renderer.dispose()
    if (canvas.parentNode === overlay) overlay.removeChild(canvas)
  }

  return finish
}
