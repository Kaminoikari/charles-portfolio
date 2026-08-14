// Particle-only hero background: a field expanding outward from the centre of
// the screen, with the headline sitting in the middle of it.
//
// It descends from faceHero.ts's shed-dust field and keeps that field's
// material — the soft-edged square sprite (halftone pixels read square, not
// round), additive blending, mote size, the cyan-white colour, the
// sin(π·life) fade in and out, and the UnrealBloom settings.
//
// The MOTION is not inherited. The original spawned each mote on a vertex of
// the head mesh and pushed it sideways and up, which drew two plumes peeling
// off a portrait; with no portrait there, that shape has nothing to peel from.
// Motes here are born in a small core at the centre and travel straight out
// along the direction they were born on, never turning, so wherever you look on
// screen the motion is away from the middle.

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export type ParticleHeroHandle = {
  // Pauses the render loop when the hero scrolls off screen. The field is
  // ambient, so a paused frame costs nothing visually and saves a whole GPU
  // pass on every other section of the page.
  setActive: (active: boolean) => void
  dispose: () => void
}

export type ParticleHeroOptions = {
  // Called if the browser reclaims the WebGL context. The shell hides the
  // canvas: a lost-context canvas composites as an opaque box in Chrome, which
  // would put a black rectangle over the page.
  onError?: (err: Error) => void
}

// From faceHero.ts's DUST: mote size and colour are the original values.
//
// Brightness is lifted 50% over the original 1.0. Additive blending makes this
// the direct lever, and it buys more than the number suggests: the bloom pass
// only glows what clears 0.55, so at 1.5 a mote spends most of its life over
// that line instead of under half of it. Much past 1.8 the blue and green
// channels clip for most of a mote's life and the cyan washes out to white.
//
// Speed is deliberately double the original. The original 0.48 (its 0.24 scaled
// by the head's ~2-unit bounding box) was calibrated against a head that filled
// a small part of the frame, and a mote crossed that whole reference in about
// its 3.4s lifetime. The reference is the entire viewport now, some 2.5x wider,
// so carrying the absolute number over made the field crawl. At 0.96 a mote
// reaches the left or right edge in about 3.6s and the top or bottom in about
// 1.7s. The cost is that the shortest-lived motes — the ones heading straight up
// or down, which have the least distance to cover — last about 2.6s against the
// original 3.4s, so they turn over a little faster.
//
// Count differs too: the same motes spread over the whole viewport instead of
// the area a head occupied would read as a much thinner field.
//
// There is no `life` here. A mote's lifetime is derived from how far it has to
// travel (see respawn), so every mote moves at this one speed no matter which
// way it is heading.
const DUST = {
  count: 2200,
  speed: 0.96,
  size: 0.02,
  bright: 1.5,
  col: [0.3, 0.8, 1.0] as const,
}

// Radial expansion from a point, in world units at z=0 with the camera at z=5.
// Every mote is born in a small core at the centre and travels straight out
// along one direction and never turns, so wherever you look on screen the
// motion is away from the middle. This replaces the original's two-sided plume:
// that shape came from motes peeling off the left and right of a head and
// rising, which only makes sense when there is a head there.
//
// Direction is picked in the SCREEN plane with only a slight depth component:
// spreading directions evenly over a 3D sphere would send a large share of
// motes almost straight at the camera, where they barely move across the frame
// and, under sizeAttenuation, change size instead of position.
//
// A mote dies once it is OVERSHOOT times as far out as the frame edge lies in
// its own direction — so it always leaves the frame, and never by much. A single
// reach shared by every direction is what left the field thin: on a 2:1 viewport
// the frame edge is 4.7 units away sideways but only 2.3 units straight up, so a
// mote heading up spent 11% of its life on screen against a sideways mote's 50%,
// and the rest of the budget burned outside the frame. The min/max spread stops
// them all winking out on the same contour.
const CORE = 0.18
const OVERSHOOT = { min: 1.06, max: 1.45 }
const DEPTH_SPREAD = 0.1

// Seconds to advance the field by, given a frame timestamp and the previous one.
//
// The ceiling stops a backgrounded tab or a stalled frame from teleporting the
// whole field on the next tick. The floor is the one that matters: a mote's
// radius is derived from its age with a square root, so a single negative delta
// drives an age below zero and every position it touches becomes NaN — three
// then reports "computeBoundingSphere(): Computed radius is NaN" and those motes
// are gone. A negative delta is not hypothetical here: the loop captures
// performance.now() and only then asks for a frame, and the timestamp handed to
// that callback is the time the frame BEGAN, which can predate the capture. It
// was measured at -11.2ms on the first frame of a local page load.
//
// It lives outside initParticleHero so the test drives the same code the render
// loop does.
export function frameDelta(nowMs: number, prevMs: number): number {
  return Math.min(Math.max(nowMs - prevMs, 0) / 1000, 0.05)
}

function squareTexture() {
  // Soft-edged square mote, straight from faceHero.ts.
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const x = c.getContext('2d')!
  x.fillStyle = 'rgba(255,255,255,0.35)'
  x.fillRect(4, 4, 24, 24)
  x.fillStyle = 'rgba(255,255,255,1)'
  x.fillRect(9, 9, 14, 14)
  const t = new THREE.CanvasTexture(c)
  t.needsUpdate = true
  return t
}

export function initParticleHero(
  canvas: HTMLCanvasElement,
  opts: ParticleHeroOptions = {},
): ParticleHeroHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  // Size from the canvas box rather than the window: the canvas is locked to the
  // svh hero by CSS, so a mobile address bar collapsing on scroll (which grows
  // window.innerHeight) must not resize the drawing buffer.
  const dispW = () => canvas.clientWidth || window.innerWidth
  const dispH = () => canvas.clientHeight || window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(dispW(), dispH(), false)
  renderer.setClearColor(0x000000, 1)

  let disposed = false

  const onContextLost = (e: Event) => {
    e.preventDefault()
    opts.onError?.(new Error('WebGL context lost'))
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, dispW() / dispH(), 0.1, 100)
  camera.position.z = 5

  // Half of what the camera sees on the z=0 plane, where the field lives. A
  // three.js fov is vertical, so the height falls straight out of it and the
  // width is the aspect-scaled one. respawn() measures each mote's travel
  // against these, which is what keeps the field filling the frame on any shape
  // of viewport instead of on the one it was tuned at.
  const halfH = camera.position.z * Math.tan((camera.fov / 2) * (Math.PI / 180))
  let halfW = halfH * camera.aspect

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(dispW(), dispH()), 0.22, 0.4, 0.55)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const M = DUST.count
  const pos = new Float32Array(M * 3)
  const col = new Float32Array(M * 3)
  // A mote is stored as the direction it travels plus how far it will get, and
  // its position is derived from its age every frame. Integrating a velocity
  // instead would tie the field's shape to how long the page has been open: a
  // mote's distance would start at zero no matter what age it was seeded with,
  // so the first frame is a dot in the middle and the field needs a whole
  // lifetime to spread out. Deriving position means frame one already shows the
  // steady state.
  const dir = new Float32Array(M * 3)
  const reach = new Float32Array(M)
  const life = new Float32Array(M)
  const age = new Float32Array(M)

  const respawn = (i: number) => {
    const o = i * 3
    // The direction is the ray from the centre through a uniformly random point
    // of the visible rectangle, rather than a uniformly random angle. A uniform
    // angle gives every direction the same number of motes, but a wedge aimed at
    // a near edge covers far less screen than one aimed at a far corner, so the
    // top and bottom pack up while the corners go bare — measured at 3x on a 2:1
    // viewport. Sampling a point weights each direction by the area it has to
    // cover, which is what makes the density even.
    let px = (Math.random() * 2 - 1) * halfW
    let py = (Math.random() * 2 - 1) * halfH
    let len = Math.hypot(px, py)
    if (len < 1e-6) {
      px = halfW
      py = 0
      len = halfW
    }
    const dx = px / len
    const dy = py / len
    dir[o] = dx
    dir[o + 1] = dy
    dir[o + 2] = (Math.random() - 0.5) * 2 * DEPTH_SPREAD

    // How far the frame edge is along this particular ray. The floor keeps a
    // mote travelling flat along an axis from dividing by a zero component.
    const toEdge = Math.min(
      halfW / Math.max(Math.abs(dx), 1e-4),
      halfH / Math.max(Math.abs(dy), 1e-4),
    )
    reach[i] = toEdge * (OVERSHOOT.min + (OVERSHOOT.max - OVERSHOOT.min) * Math.random())
    // Lifetime follows distance, so every mote averages DUST.speed no matter
    // which way it is heading. Tying them the other way round — one lifetime for
    // all — would make motes crawl towards the near edges and race to the far
    // ones on a wide viewport.
    life[i] = reach[i] / DUST.speed
    age[i] = 0
  }
  for (let i = 0; i < M; i++) {
    respawn(i)
    // Seeding is the one place a mote starts part-way through its life. Because
    // radius is derived from age, one random age per mote scatters the field
    // across the whole frame on the very first paint, and it also keeps the
    // motes from ever fading in unison.
    age[i] = Math.random() * life[i]
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const sprite = squareTexture()
  const mat = new THREE.PointsMaterial({
    size: DUST.size,
    map: sprite,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)

  const update = (dt: number) => {
    for (let i = 0; i < M; i++) {
      age[i] += dt
      if (age[i] >= life[i]) respawn(i)
      const o = i * 3
      const u = age[i] / life[i]
      // The square root is what makes the field even rather than a bright knot
      // in the middle. Ages are spread evenly across each mote's life, so a
      // radius that grew in step with age would put an equal count in every
      // ring — and since a ring's area grows with its radius, that leaves the
      // outer frame starved while the centre packs up. Taking the root spreads
      // the same motes over equal AREA instead, and it reads as an expansion
      // that opens fast and then eases out.
      const r = CORE + reach[i] * Math.sqrt(u)
      pos[o] = dir[o] * r
      pos[o + 1] = dir[o + 1] * r
      pos[o + 2] = dir[o + 2] * r
      // Per-mote fade in and out across its own life, so the field breathes
      // without any global pulse.
      const a = Math.sin(Math.PI * u) * DUST.bright
      col[o] = DUST.col[0] * a
      col[o + 1] = DUST.col[1] * a
      col[o + 2] = DUST.col[2] * a
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  const onResize = () => {
    if (disposed) return
    const w = dispW()
    const h = dispH()
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Motes seeded before the resize keep the reach they were given and simply
    // die a little inside or outside the new edge; every one seeded after this
    // matches the new frame.
    halfW = halfH * camera.aspect
  }
  window.addEventListener('resize', onResize)

  let active = true
  let pageVisible = document.visibilityState === 'visible'
  let rafId = 0
  let running = false
  let prevMs = 0

  const frame = (nowMs: number) => {
    if (disposed) return
    if (!active || !pageVisible) {
      running = false
      return
    }
    rafId = window.requestAnimationFrame(frame)
    const dt = frameDelta(nowMs, prevMs)
    prevMs = nowMs
    update(dt)
    composer.render()
  }

  const ensureRunning = () => {
    if (disposed || running || !active || !pageVisible) return
    running = true
    prevMs = performance.now()
    rafId = window.requestAnimationFrame(frame)
  }

  const onVisibility = () => {
    pageVisible = document.visibilityState === 'visible'
    ensureRunning()
  }
  document.addEventListener('visibilitychange', onVisibility)
  ensureRunning()

  return {
    setActive: (a: boolean) => {
      active = a
      ensureRunning()
    },
    dispose: () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      geo.dispose()
      mat.dispose()
      sprite.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
}
