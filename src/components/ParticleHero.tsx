import { useEffect, useRef, useState } from 'react'
import BlackHoleBackdrop from './BlackHoleBackdrop'

// --- Ring particle config (orbital model, inspired by msurguy's blackhole) ---
// Inner radius keeps particles outside the shader's lens crescents (~p_norm 0.5).
// Outer radius extends to the viewport's corner so particles cover the full
// canvas — especially the corners, which look empty if we cap at half-height.
const INNER_RADIUS_FACTOR = 0.62 // fraction of half-height, > shader lens at 0.5
const INNER_RADIUS_MIN = 220     // px floor for small viewports
const OUTER_RADIUS_PADDING = 80  // px past the corner so orbits don't truncate visibly
const PARTICLE_TOTAL = 3000
const PARTICLE_SIZE = 1.4
const PARTICLE_COLOR = 'rgba(235, 240, 250, 1)'
// Angular speeds (rad/sec). Wider Kepler-like differential for visible fast/slow shear.
const SPEED_INNER = 0.55
const SPEED_OUTER = 0.07
const SPEED_JITTER = 0.6
// Tangent line trail behind each particle (px), proportional to linear velocity.
const TRAIL_MAX = 8
// Pointer impulse → spring-damper system: outward velocity, gravity pulls back,
// under-damped so the particle swings past base orbit and oscillates while
// continuing to rotate (looks like an elliptical perturbation settling back).
const PUSH_RADIUS = 160
const PUSH_VELOCITY = 280     // initial radial velocity from a hit (px/sec)
const PUSH_SPRING_K = 60      // spring stiffness (1/s²) — gravity strength
const PUSH_DAMPING = 4        // damping coefficient — ζ ≈ 0.26 (under-damped)

const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']
const PHOTO_SAMPLE_SIZE = 400

// Easter-egg phase boundaries (seconds since trigger). Match BlackHoleBackdrop.
const EGG_COLLAPSE_END = 0.8
const EGG_FLASH_END = 1.0
const EGG_EXPLODE_END = 1.6
const EGG_PHOTO_END = 3.5
const EGG_REVERSE_END = 5.0
// Reverse splits into spiral-in (gravitational collapse) and re-emergence.
const REVERSE_COLLAPSE_FRAC = 0.55

const easeInCubic = (x: number) => x * x * x
const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)
const easeOutBack = (x: number, c1 = 1.2) => {
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// Stellar plasma palette for the egg's photo phase. Each particle gets a
// stable slot (white-gold ~60%, mars-orange ~25%, cyan ~15% — site brand
// accents) plus a per-frame shimmer that drifts hue/lightness slightly so the
// portrait twinkles like cooling stellar matter. `satScale` < 1 desaturates
// (used during reverse fade-back); `litBoost` brightens (used early in the
// explode phase to render newly-ejected particles as still-hot plasma).
function stellarColor(index: number, time: number, satScale = 1, litBoost = 0): string {
  const slot = (index * 7919) % 100
  const shimmer = Math.sin(time * 1.5 + index * 0.13) * 0.5 + 0.5
  if (slot < 60) {
    return `hsl(${44 + shimmer * 6}, ${65 * satScale}%, ${82 + shimmer * 10 + litBoost}%)`
  }
  if (slot < 85) {
    return `hsl(${16 + shimmer * 4}, ${85 * satScale}%, ${55 + shimmer * 12 + litBoost}%)`
  }
  return `hsl(${188 + shimmer * 6}, ${80 * satScale}%, ${65 + shimmer * 10 + litBoost}%)`
}

// Photo-phase palette tuned to the shader's lens-halo colour spectrum:
//  - Brightness 0 → flame red-orange (h=14, s=88, l=42), like warm gas
//  - Brightness 0.5 → warm amber, like the inner halo
//  - Brightness 1 → cream-white (h=44, s=22, l=92), like the lens crescent
// 12% are pulled to a cool cyan accent (h=198) to mirror the cool gas on
// the opposite side of the lens.
function photoColor(brightness: number, index: number, time: number): string {
  const slot = (index * 7919) % 100
  const shimmer = Math.sin(time * 1.5 + index * 0.13) * 0.5 + 0.5
  if (slot < 12) {
    return `hsl(${198 + shimmer * 6}, 72%, ${72 + shimmer * 8}%)`
  }
  const hue = 14 + brightness * 30
  const sat = 88 - brightness * 66
  const lit = 42 + brightness * 50
  return `hsl(${hue + shimmer * 4}, ${sat}%, ${lit + shimmer * 5}%)`
}

interface Star {
  // tNorm 0..1 = inner..outer; orbital + speed computed per-frame from viewport
  tNorm: number
  baseAngle: number
  speedJitter: number
  baseAlpha: number
  twinkleRate: number
  twinklePhase: number
  // Spring-damper push state
  pushOffset: number
  pushVelocity: number
  // Photo target (normalized 0-1, mapped to screen at runtime)
  photoX: number
  photoY: number
  hasPhotoTarget: boolean
  // Photo target's pixel brightness (0..1), used to drive the cooling-plasma
  // colour gradient: bright pixels render white-gold, dark pixels deep mars.
  photoBrightness: number
  // ~30% of particles are flagged at init to render a short tangent streak
  // during the photo phase, hinting they just escaped the orbital ring.
  hasTail: boolean
  row: number
  index: number
}


const HINT_LINES = ['> click the logo 5 times', '> or try ↑ ↑ ↓ ↓ ← → ← →']
const TYPING_SPEED_MS = 45
const LINE_PAUSE_MS = 300

function EasterEggHint() {
  const [text, setText] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    let lineIdx = 0
    let charIdx = 0
    let current = ''

    const tick = () => {
      if (lineIdx >= HINT_LINES.length) {
        setShowCursor(false)
        return
      }

      const line = HINT_LINES[lineIdx]
      if (charIdx < line.length) {
        current += line[charIdx]
        charIdx++
        setText(current)
        setTimeout(tick, TYPING_SPEED_MS)
      } else {
        lineIdx++
        if (lineIdx < HINT_LINES.length) {
          current += '\n'
          charIdx = 0
          setTimeout(tick, LINE_PAUSE_MS)
        } else {
          setShowCursor(false)
        }
      }
    }

    tick()
  }, [])

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center"
      style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 400, letterSpacing: '2px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre', lineHeight: 1.8, textTransform: 'uppercase' }}
    >
      <span>{text.split('').map((ch, i) =>
        /[↑↓←→]/.test(ch)
          ? <span key={i} style={{ fontSize: '1.4em', lineHeight: 1 }}>{ch}</span>
          : <span key={i}>{ch}</span>
      )}</span>{showCursor && <span style={{ animation: 'cursor-blink 1s step-end infinite' }}>_</span>}
    </div>
  )
}

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  // Three refs share the same fade so all hero overlays vanish together
  // during the easter-egg photo phase (the avatar is the only thing on
  // screen while the portrait holds).
  const heroTextRef = useRef<HTMLDivElement>(null)
  const heroHintRef = useRef<HTMLDivElement>(null)
  const heroScrollRef = useRef<HTMLDivElement>(null)
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  // performance.now() at egg trigger; 0 = inactive. Drives phased state machine.
  const eggStartRef = useRef(0)
  const konamiIndexRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      // Use section dimensions, not window — on mobile Safari, h-screen (100vh)
      // includes the URL bar area while window.innerHeight doesn't, so the two
      // disagree by ~100px and canvas "center" drifts off the visual center.
      width = section.clientWidth
      height = section.clientHeight
      // Cap DPR at 2.0. The original 1.5 cap (for idle-loop perf headroom
      // on 3000 drawImages + 1000+ trail strokes) was visibly soft on
      // dpr=3 iPhones — the canvas rendered at half native density, then
      // CSS-stretched 2× to fit the layout, blurring every particle edge
      // and stroke. 2.0 is dpr=3 → 0.67× native on iPhone (vs 0.5× before)
      // and full native on dpr=2 desktop Retina; the sprite/dot supersampling
      // already accounts for the higher resolution, so particles render
      // sharp without further changes. Idle-loop perf headroom is still
      // safe on modern A14+ devices given the trail-style hoisting, the
      // pre-baked glow sprites that replaced shadowBlur, and the 0.42-alpha
      // gate that skips trails on dim outer-corner particles.
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(section)

    // Pre-render dot
    const dotSize = Math.ceil(PARTICLE_SIZE * 2 * window.devicePixelRatio) + 2
    const dotCanvas = document.createElement('canvas')
    dotCanvas.width = dotSize
    dotCanvas.height = dotSize
    const dotCtx = dotCanvas.getContext('2d')!
    dotCtx.fillStyle = PARTICLE_COLOR
    dotCtx.beginPath()
    dotCtx.arc(dotSize / 2, dotSize / 2, PARTICLE_SIZE * window.devicePixelRatio, 0, Math.PI * 2)
    dotCtx.fill()

    // Pre-rendered glow sprites for the photo phase. Designed for additive
    // ('lighter') blending: each sprite is a soft fuzzy blob with NO sharp
    // bright core (max alpha ~0.7), so a single particle reads as a fuzzy
    // luminous spot — not a hard dot — and overlapping halos add cleanly
    // into bright areas without blowing out to white.
    //
    // The sprite itself is rendered at a fixed canvas size; its display
    // size at draw time scales with viewport (see GLOW_DISPLAY_PX in the
    // animate loop) so the halo stays proportionally tight on mobile
    // without rebuilding sprites on resize.
    const GLOW_SPRITE_PX = 48
    const makeGlowSprite = (h: number, s: number, l: number) => {
      const dpr = window.devicePixelRatio
      const px = Math.ceil(GLOW_SPRITE_PX * dpr)
      const c = document.createElement('canvas')
      c.width = px
      c.height = px
      const gctx = c.getContext('2d')!
      const center = px / 2
      const grad = gctx.createRadialGradient(center, center, 0, center, center, center)
      // Pure white core (~4% radius) — matches the lens crescent's exact
      // colour, so every particle reads as a tiny point of the same light
      // that forms the accretion-disk lens. Halo is tinted by the bucket so
      // particles transition from white core → tinted shoulder → ambient
      // halo, mirroring the lens-core → halo → outer-gas falloff in the
      // shader.
      grad.addColorStop(0.00, 'hsla(0, 0%, 98%, 1)')
      grad.addColorStop(0.04, `hsla(${h}, ${Math.min(s + 5, 100)}%, ${Math.min(l + 50, 95)}%, 0.92)`)
      grad.addColorStop(0.10, `hsla(${h}, ${s}%, ${Math.min(l + 28, 86)}%, 0.55)`)
      grad.addColorStop(0.26, `hsla(${h}, ${s}%, ${Math.min(l + 14, 78)}%, 0.22)`)
      grad.addColorStop(0.52, `hsla(${h}, ${s}%, ${l}%, 0.08)`)
      grad.addColorStop(0.82, `hsla(${h}, ${s}%, ${l}%, 0.02)`)
      grad.addColorStop(1.00, `hsla(${h}, ${s}%, ${l}%, 0)`)
      gctx.fillStyle = grad
      gctx.fillRect(0, 0, px, px)
      return c
    }
    // Brightness curve: matches the shader's halo palette.
    //  brightness 0 → flame red-orange (h=14, s=88, l=42) — warm gas filament
    //  brightness 0.5 → warm amber (h=29, s=72, l=66) — inner halo
    //  brightness 1 → cool cream-white (h=44, s=22, l=92) — lens crescent
    // Hue and lightness rise together; saturation falls off so the brightest
    // particles approach pure white instead of saturated yellow.
    const GLOW_BUCKETS = 5
    const glowBright: HTMLCanvasElement[] = []
    for (let i = 0; i < GLOW_BUCKETS; i++) {
      const b = i / (GLOW_BUCKETS - 1)
      glowBright.push(makeGlowSprite(14 + b * 30, 88 - b * 66, 42 + b * 50))
    }
    // Cool gas accent — h=198 puts it on the cool gas side of the lens (the
    // bluish filaments opposite the warm orange ones), with high lightness
    // so it reads as a bright cool highlight rather than a dim blue dot.
    const glowCyan = makeGlowSprite(198, 72, 72)

    // Weighted random tNorm — biased toward middle of orbital range.
    const particles: Star[] = []
    for (let i = 0; i < PARTICLE_TOTAL; i++) {
      const tNorm = (Math.random() + Math.random()) / 2

      // Brightness peaks at middle (parabolic falloff)
      const distFromMid = Math.abs(tNorm - 0.5) * 2
      const baseAlpha = 0.25 + 0.75 * (1 - distFromMid * distFromMid)

      particles.push({
        tNorm,
        baseAngle: Math.random() * Math.PI * 2,
        speedJitter: 1 + (Math.random() - 0.5) * SPEED_JITTER,
        baseAlpha,
        twinkleRate: 0.4 + Math.random() * 0.7,
        twinklePhase: Math.random() * Math.PI * 2,
        pushOffset: 0,
        pushVelocity: 0,
        photoX: 0,
        photoY: 0,
        hasPhotoTarget: false,
        photoBrightness: 0,
        hasTail: Math.random() < 0.3,
        row: Math.floor(i / 60),
        index: i,
      })
    }

    // Load photo targets async
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/assets/charles-face.png'
    img.onload = () => {
      const sampleCanvas = document.createElement('canvas')
      sampleCanvas.width = PHOTO_SAMPLE_SIZE
      sampleCanvas.height = PHOTO_SAMPLE_SIZE
      const sampleCtx = sampleCanvas.getContext('2d')
      if (!sampleCtx) return

      const size = Math.min(img.width, img.height)
      sampleCtx.drawImage(img, (img.width - size) / 2, 0, size, size, 0, 0, PHOTO_SAMPLE_SIZE, PHOTO_SAMPLE_SIZE)

      const imageData = sampleCtx.getImageData(0, 0, PHOTO_SAMPLE_SIZE, PHOTO_SAMPLE_SIZE)
      const pixels = imageData.data

      // Get brightness + alpha at pixel
      const getPixel = (px: number, py: number) => {
        const idx = (py * PHOTO_SAMPLE_SIZE + px) * 4
        return {
          b: (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3,
          a: pixels[idx + 3], // alpha channel — 0 = transparent (outside circle)
        }
      }

      // Wireframe sampling — only edge pixels enter the pool. The portrait
      // is intentionally drawn as feature lines (eyes, brows, nose, mouth,
      // jaw, hair) plus a head silhouette outline. No interior fill, so
      // the face does not read as a textured mass.
      const pool: Array<{ x: number; y: number; weight: number; brightness: number }> = []

      for (let py = 1; py < PHOTO_SAMPLE_SIZE - 1; py += 1) {
        for (let px = 1; px < PHOTO_SAMPLE_SIZE - 1; px += 1) {
          const { b, a } = getPixel(px, py)

          // Skip transparent pixels (outside circular crop)
          if (a < 128) continue

          // Skip pixels near circular crop edge — prevents circle outline
          const centerX = PHOTO_SAMPLE_SIZE / 2
          const centerY = PHOTO_SAMPLE_SIZE / 2
          const radius = PHOTO_SAMPLE_SIZE / 2
          const distFromCenter = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2)
          if (distFromCenter > radius * 0.70) continue // skip outer 30%
          // Skip top region — hair/background boundary creates false arc
          if (py < PHOTO_SAMPLE_SIZE * 0.28) continue

          // Edge detection (4-direction Laplacian)
          const edge = Math.abs(b - getPixel(px - 1, py).b)
            + Math.abs(b - getPixel(px + 1, py).b)
            + Math.abs(b - getPixel(px, py - 1).b)
            + Math.abs(b - getPixel(px, py + 1).b)

          // Wireframe-only sampling: only edges enter the pool, no interior
          // fill. The portrait should read as feature lines (eyes, brows,
          // nose, mouth, jaw, hair) plus a clean head silhouette — not as
          // a textured mass.
          //
          // Threshold is radius-aware because the same noise level reads
          // very differently inside the face vs. on the silhouette band:
          //   - Inner 50% (face core): threshold 30 keeps subtle feature
          //     transitions (eyelash, lip line, nostril shadow). Histogram
          //     of this region shows ~7400 edges ≥ 30, all of which trace
          //     real face anatomy, with none in pure background.
          //   - 50-70% (silhouette band): threshold 60 keeps only the hard
          //     head/hair-vs-background transitions (typical edge ≥ 200).
          //     The 25-60 range here is dominated by AA fringe, hair
          //     flyaways, and the photo's mid-gray background gradient
          //     (~600 such edges by histogram) — exactly the noise that
          //     produced the scattered halo of dim dots on real devices.
          const inFaceCore = distFromCenter < radius * 0.50
          const threshold = inFaceCore ? 30 : 60
          if (edge > threshold) {
            pool.push({
              x: px / PHOTO_SAMPLE_SIZE,
              y: py / PHOTO_SAMPLE_SIZE,
              weight: edge,
              brightness: b / 255,
            })
          }
        }
      }

      // Remap coordinates — uniform scale to preserve aspect ratio
      if (pool.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const p of pool) {
          if (p.x < minX) minX = p.x
          if (p.x > maxX) maxX = p.x
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
        }
        const rangeX = maxX - minX || 1
        const rangeY = maxY - minY || 1
        const maxRange = Math.max(rangeX, rangeY)
        const midX = (minX + maxX) / 2
        const midY = (minY + maxY) / 2
        for (const p of pool) {
          p.x = 0.5 + (p.x - midX) / maxRange
          p.y = 0.5 + (p.y - midY) / maxRange
        }
      }

      // Sort by weight (edges first) and distribute evenly across particles
      pool.sort((a, b) => b.weight - a.weight)

      // Assign targets — spread evenly across pool to avoid clustering
      const totalParticles = particles.length
      for (let i = 0; i < totalParticles; i++) {
        if (pool.length > 0) {
          // Distribute evenly across the sorted pool
          const poolIdx = Math.floor((i / totalParticles) * pool.length)
          const target = pool[poolIdx]
          particles[i].photoX = target.x
          particles[i].photoY = target.y
          particles[i].hasPhotoTarget = true
          particles[i].photoBrightness = target.brightness
        }
      }
    }

    // Pointer impulse — click or tap gives nearby particles an outward velocity
    // kick. Spring-damper return (in animate loop) lets them swing back through
    // their orbit, oscillating a couple times before settling.
    const onPointerDown = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const innerR = geom.innerR
      const range = Math.max(1, geom.outerR - geom.innerR)
      for (const p of particles) {
        const baseOrbital = innerR + p.tNorm * range
        const speedBase = SPEED_INNER + (SPEED_OUTER - SPEED_INNER) * p.tNorm
        const speed = speedBase * p.speedJitter
        const angle = p.baseAngle + currentTime * speed
        const radius = baseOrbital + p.pushOffset
        const sx = geom.cx + Math.cos(angle) * radius
        const sy = geom.cy + Math.sin(angle) * radius
        const dx = sx - px
        const dy = sy - py
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < PUSH_RADIUS) {
          const factor = (1 - dist / PUSH_RADIUS) ** 2
          p.pushVelocity += PUSH_VELOCITY * factor
        }
      }
    }
    section.addEventListener('pointerdown', onPointerDown)

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Time tracking — currentTime advances in seconds, used by orbital rotation.
    let currentTime = 0
    let lastFrameTime = performance.now()
    // Shared geometry between animate loop and pointer handler.
    const geom = { cx: 0, cy: 0, innerR: 0, outerR: 0 }

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1)
      lastFrameTime = now
      if (!visibleRef.current) return

      if (!prefersReduced) currentTime += dt
      ctx.clearRect(0, 0, width, height)

      const PHOTO_DISPLAY_SIZE = Math.min(width * 0.7, height * 0.75, 900)

      const ringCX = width / 2
      const ringCY = height / 2
      const halfH = height / 2
      const halfW = width / 2
      // Dynamic orbital range — INNER stays just outside the shader's lens
      // crescents, OUTER reaches the viewport corner so particles fill the
      // whole canvas (corners included), not just a band around the lens.
      const innerRadius = Math.max(INNER_RADIUS_MIN, halfH * INNER_RADIUS_FACTOR)
      const outerRadius = Math.hypot(halfW, halfH) + OUTER_RADIUS_PADDING
      const safeOuter = Math.max(outerRadius, innerRadius + 200)
      const orbitalRange = safeOuter - innerRadius
      const halfRange = orbitalRange / 2
      geom.cx = ringCX
      geom.cy = ringCY
      geom.innerR = innerRadius
      geom.outerR = safeOuter

      // Easter-egg phase machine. eggElapsed = -1 when idle.
      let eggElapsed = -1
      if (eggStartRef.current > 0) {
        eggElapsed = (now - eggStartRef.current) / 1000
        if (eggElapsed > EGG_REVERSE_END) {
          eggStartRef.current = 0
          eggElapsed = -1
        }
      }
      const eggActive = eggElapsed >= 0
      const eggReducedJump = eggActive && prefersReduced
        && eggElapsed > 0.05 && eggElapsed < EGG_PHOTO_END

      // Frame-wide phase flag — all particles share the same egg phase in a
      // given frame. Used to hoist shadowBlur (expensive to toggle per-arc)
      // and the post-loop radial glow overlay.
      const isPhotoFrame =
        (eggReducedJump)
        || (eggActive && eggElapsed >= EGG_EXPLODE_END && eggElapsed < EGG_PHOTO_END)

      // Hero overlay fade — mirrors the shader's photoHide ramp so the
      // hero text, easter-egg hint, and scroll indicator vanish together
      // with the lens halo while the portrait holds. Same timings as
      // BlackHoleBackdrop: ramp out 1.25→1.55s (ends just as the photo
      // resolves), hold hidden through PHOTO_END, fade back over 0.15s.
      let heroHide = 0
      if (eggActive) {
        const HIDE_RAMP_START = EGG_EXPLODE_END - 0.35
        const HIDE_RAMP_END = EGG_EXPLODE_END - 0.05
        const PHOTO_FADE_OUT = 0.15
        if (eggElapsed >= HIDE_RAMP_START && eggElapsed < HIDE_RAMP_END) {
          heroHide = (eggElapsed - HIDE_RAMP_START) / (HIDE_RAMP_END - HIDE_RAMP_START)
        } else if (eggElapsed >= HIDE_RAMP_END && eggElapsed < EGG_PHOTO_END) {
          heroHide = 1
        } else if (eggElapsed >= EGG_PHOTO_END && eggElapsed < EGG_PHOTO_END + PHOTO_FADE_OUT) {
          heroHide = 1 - (eggElapsed - EGG_PHOTO_END) / PHOTO_FADE_OUT
        }
      }
      const heroOpacity = String(1 - heroHide)
      if (heroTextRef.current) heroTextRef.current.style.opacity = heroOpacity
      if (heroHintRef.current) heroHintRef.current.style.opacity = heroOpacity
      if (heroScrollRef.current) heroScrollRef.current.style.opacity = heroOpacity

      const photoCX = width / 2 - PHOTO_DISPLAY_SIZE / 2
      const photoCY = height * 0.50 - PHOTO_DISPLAY_SIZE / 2

      // Halo display size scales with viewport. On desktop the 22px halo
      // (~11px effective radius per particle) creates the intended cosmic
      // nebula bleed across ~3000 silhouette particles. On mobile the
      // photo display itself is only ~273px wide, so halving the halo
      // contains the bleed within the silhouette and the face reads as a
      // sharp constellation rather than a glowing cloud. Recomputed per
      // frame so rotating a phone or resizing a window across the 768px
      // breakpoint takes effect immediately.
      const GLOW_DISPLAY_PX = width < 768 ? 13 : 22

      ctx.fillStyle = PARTICLE_COLOR
      // Hoist constant stroke styles (trail width/cap/colour). Setting these
      // per-particle was 3 redundant state changes × ~1500 trails = 4500
      // unnecessary GPU state touches per frame.
      ctx.strokeStyle = PARTICLE_COLOR
      ctx.lineWidth = 0.7
      ctx.lineCap = 'round'
      // Photo phase uses additive blending so the per-particle halos overlap
      // into a continuous glowing fabric instead of stacking as discrete
      // dots. Reset to source-over after the loop so the radial overlay and
      // subsequent frames behave normally.
      if (isPhotoFrame) ctx.globalCompositeOperation = 'lighter'

      for (const p of particles) {
        const baseOrbital = innerRadius + p.tNorm * orbitalRange
        const speedBase = SPEED_INNER + (SPEED_OUTER - SPEED_INNER) * p.tNorm
        const speed = speedBase * p.speedJitter

        // Orbital position — angle advances with currentTime * speed.
        const angle = p.baseAngle + currentTime * speed
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const radius = baseOrbital + p.pushOffset
        const ringX = ringCX + cosA * radius
        const ringY = ringCY + sinA * radius

        // Spring-damper return: gravity pulls back to base orbit, damping
        // attenuates oscillation. Under-damped (ζ ≈ 0.26) so particle swings
        // past base, oscillates a couple times, then settles — natural decay.
        if (p.pushOffset !== 0 || p.pushVelocity !== 0) {
          const accel = -PUSH_SPRING_K * p.pushOffset - PUSH_DAMPING * p.pushVelocity
          p.pushVelocity += accel * dt
          p.pushOffset += p.pushVelocity * dt
          if (Math.abs(p.pushOffset) < 0.3 && Math.abs(p.pushVelocity) < 1) {
            p.pushOffset = 0
            p.pushVelocity = 0
          }
        }

        // Per-particle twinkle
        const twinkle = 0.7 + 0.3 * Math.sin(currentTime * p.twinkleRate + p.twinklePhase)
        let alpha = p.baseAlpha * twinkle

        // Edge fade — particles fade as they approach INNER (absorbed) or OUTER
        const distFromInner = radius - innerRadius
        const distFromOuter = safeOuter - radius
        let visibility = Math.min(distFromInner, distFromOuter) / halfRange
        if (visibility < 0) visibility = 0
        if (visibility > 1) visibility = 1
        visibility = 0.45 + visibility * 0.55
        alpha *= visibility

        // Absorption fade — particles dim sharply when crossing inside lens
        // (radius < innerRadius), suggesting they're sucked into the event horizon.
        if (radius < innerRadius) {
          const overshoot = (innerRadius - radius) / 80
          alpha *= Math.max(0, 1 - overshoot)
        }

        // Photo position
        const photoX = p.hasPhotoTarget ? photoCX + p.photoX * PHOTO_DISPLAY_SIZE : ringX
        const photoY = p.hasPhotoTarget ? photoCY + p.photoY * PHOTO_DISPLAY_SIZE : ringY

        // Default = idle ring
        let x = ringX
        let y = ringY
        let streakFromX = 0
        let streakFromY = 0
        let streakAlpha = 0
        // 'idle' | 'collapse' | 'flash' | 'explode' | 'photo' | 'reverse'
        let eggPhase: 'idle' | 'collapse' | 'flash' | 'explode' | 'photo' | 'reverse' = 'idle'

        if (eggReducedJump) {
          x = photoX
          y = photoY
          alpha = 1
          eggPhase = 'photo'
        } else if (eggActive) {
          if (eggElapsed < EGG_COLLAPSE_END) {
            const k = easeInCubic(eggElapsed / EGG_COLLAPSE_END)
            x = ringX + (ringCX - ringX) * k
            y = ringY + (ringCY - ringY) * k
            alpha = alpha + (1 - alpha) * k
            eggPhase = 'collapse'
          } else if (eggElapsed < EGG_FLASH_END) {
            const fk = (eggElapsed - EGG_COLLAPSE_END) / (EGG_FLASH_END - EGG_COLLAPSE_END)
            // Tiny jitter at singularity — rotates around center as if compressed
            const jitterAng = p.baseAngle * 3 + currentTime * 8
            const jitterR = 6 * (1 - fk)
            x = ringCX + Math.cos(jitterAng) * jitterR
            y = ringCY + Math.sin(jitterAng) * jitterR
            alpha = 1
            eggPhase = 'flash'
          } else if (eggElapsed < EGG_EXPLODE_END) {
            const ek = (eggElapsed - EGG_FLASH_END) / (EGG_EXPLODE_END - EGG_FLASH_END)
            const k = easeOutBack(ek, 1.2)
            x = ringCX + (photoX - ringCX) * k
            y = ringCY + (photoY - ringCY) * k
            alpha = 1
            // Speed-line trail behind the particle, peaks mid-explosion
            const trailK = Math.max(0, k - 0.18)
            streakFromX = ringCX + (photoX - ringCX) * trailK
            streakFromY = ringCY + (photoY - ringCY) * trailK
            streakAlpha = (1 - ek) * 0.85
            eggPhase = 'explode'
          } else if (eggElapsed < EGG_PHOTO_END) {
            x = photoX
            y = photoY
            alpha = 1
            eggPhase = 'photo'
          } else {
            // Reverse: simple dispersal — particles fly back to their
            // orbital ring position along a straight line with easeOutQuart
            // deceleration. No spiral, no rotation. The shader's secondary
            // collapse plays in parallel for the gravitational atmosphere,
            // but the particles themselves just disperse and reform.
            const rk = (eggElapsed - EGG_PHOTO_END) / (EGG_REVERSE_END - EGG_PHOTO_END)
            const k = easeOutQuart(rk)
            x = photoX + (ringX - photoX) * k
            y = photoY + (ringY - photoY) * k
            alpha = 1 + (alpha - 1) * k
            eggPhase = 'reverse'
          }
        }

        if (alpha < 0.01) continue
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue

        // Speed-line streak behind exploding particles (drawn under the dot).
        // Warm white-gold ejecta plume — feels like hot stellar matter being
        // flung out, matches the cooling-plasma theme of the explode phase.
        if (streakAlpha > 0.01) {
          ctx.globalAlpha = streakAlpha
          ctx.strokeStyle = 'rgba(255, 240, 215, 1)'
          ctx.lineWidth = 1.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(streakFromX, streakFromY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }

        // Idle orbit trail — tangent line behind each star, length scaled to
        // angular velocity * radius (faster orbits = longer streaks). Threshold
        // raised to alpha > 0.42 / |speed| > 0.25 so dim/slow particles skip
        // the stroke entirely (they contribute no visible motion blur), which
        // halves stroke count vs the previous threshold.
        if (eggPhase === 'idle' && !prefersReduced && alpha > 0.42 && Math.abs(speed) > 0.25) {
          const motionSign = speed >= 0 ? 1 : -1
          const tangX = -sinA * motionSign
          const tangY = cosA * motionSign
          const trailLen = Math.min(TRAIL_MAX, Math.abs(speed) * radius * 0.28)
          if (trailLen > 1) {
            ctx.globalAlpha = alpha * 0.32
            ctx.beginPath()
            ctx.moveTo(x - tangX * trailLen, y - tangY * trailLen)
            ctx.lineTo(x, y)
            ctx.stroke()
          }
        }

        ctx.globalAlpha = alpha

        if (eggPhase === 'flash') {
          // Hot white core during singularity
          ctx.fillStyle = 'rgba(255, 245, 230, 1)'
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE * 1.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
        } else if (eggPhase === 'explode') {
          // Cooling plasma: just-ejected particles render hot (lit boost +
          // desaturation), settling into the stellar palette as they reach
          // their photo target.
          const ek = (eggElapsed - EGG_FLASH_END) / (EGG_EXPLODE_END - EGG_FLASH_END)
          const heat = Math.max(0, 1 - ek * 1.5)
          ctx.fillStyle = stellarColor(p.index, currentTime, 1 - heat * 0.45, heat * 14)
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE * (1 + heat * 0.35), 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
        } else if (eggPhase === 'photo') {
          // Accretion-disk debris: drawImage a pre-baked radial-gradient
          // glow sprite (one of 5 brightness buckets, plus a cyan accent
          // sprite for ~15% of particles). One raster op per particle —
          // shadowBlur was multiple times more expensive and pushed 3000
          // particles past the GPU's frame budget.
          const slot = (p.index * 7919) % 100
          let sprite: HTMLCanvasElement
          if (slot < 12) {
            sprite = glowCyan
          } else {
            const bucket = Math.min(
              GLOW_BUCKETS - 1,
              Math.floor(p.photoBrightness * GLOW_BUCKETS),
            )
            sprite = glowBright[bucket]
          }
          const shimmer = 0.78 + Math.sin(currentTime * 1.5 + p.index * 0.13) * 0.22
          ctx.globalAlpha = alpha * shimmer
          ctx.drawImage(
            sprite,
            x - GLOW_DISPLAY_PX / 2,
            y - GLOW_DISPLAY_PX / 2,
            GLOW_DISPLAY_PX,
            GLOW_DISPLAY_PX,
          )
          if (p.hasTail) {
            // Short tangent streak — implies recent escape from the orbital
            // ring. No shadow on the stroke (it's already a thin line at
            // 1-3px, which reads cleanly without extra blur).
            const tailLen = 1.4 + (p.index % 3) * 0.8
            const color = photoColor(p.photoBrightness, p.index, currentTime)
            ctx.globalAlpha = alpha * shimmer * 0.55
            ctx.strokeStyle = color
            ctx.lineWidth = 0.7
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(x - Math.cos(p.baseAngle) * tailLen, y - Math.sin(p.baseAngle) * tailLen)
            ctx.lineTo(x, y)
            ctx.stroke()
          }
        } else if (eggPhase === 'collapse') {
          // Warm tint that brightens as particles compress toward singularity
          const intensity = eggElapsed / EGG_COLLAPSE_END
          const hue = 30 + intensity * 30
          ctx.fillStyle = `hsl(${hue}, 70%, ${65 + intensity * 25}%)`
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
        } else if (eggPhase === 'reverse') {
          // R1 (spiral-in): keep full saturation and brighten as particles
          // compress — reads as plasma being heated by gravitational pull.
          // R2 (emerge): desaturate toward white so the portrait colors
          //   dissolve into the white-gold orbital ring.
          const rk = (eggElapsed - EGG_PHOTO_END) / (EGG_REVERSE_END - EGG_PHOTO_END)
          let satScale: number
          let litBoost: number
          if (rk < REVERSE_COLLAPSE_FRAC) {
            const sk = rk / REVERSE_COLLAPSE_FRAC
            satScale = 1
            litBoost = sk * 10
          } else {
            const sk = (rk - REVERSE_COLLAPSE_FRAC) / (1 - REVERSE_COLLAPSE_FRAC)
            satScale = 1 - sk
            litBoost = 10 + sk * 6
          }
          ctx.fillStyle = stellarColor(p.index, currentTime, satScale, litBoost)
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
        } else {
          ctx.drawImage(dotCanvas, x - PARTICLE_SIZE, y - PARTICLE_SIZE, PARTICLE_SIZE * 2, PARTICLE_SIZE * 2)
        }
      }

      // Photo-phase atmosphere: a very faint warm radial glow centred on the
      // portrait, additively blended ('lighter') so it lifts the entire
      // hologram without hiding particles. Reads as residual heat clinging to
      // matter freshly ejected from the event horizon.
      if (isPhotoFrame) {
        const ox = width / 2
        const oy = height * 0.5
        const orad = Math.min(width, height) * 0.45
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orad)
        grad.addColorStop(0, 'hsla(38, 70%, 62%, 0.10)')
        grad.addColorStop(0.45, 'hsla(20, 78%, 52%, 0.05)')
        grad.addColorStop(0.85, 'hsla(20, 78%, 52%, 0.01)')
        grad.addColorStop(1, 'hsla(20, 78%, 52%, 0)')
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 1
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = 'source-over'
      }

      ctx.globalAlpha = 1
    }

    animate()

    return () => {
      cancelAnimationFrame(animIdRef.current)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      section.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  // Konami code + easter egg. Konami dispatches the global event so
  // BlackHoleBackdrop's shader phases stay synced with the particle phases.
  useEffect(() => {
    // SFX paired with the egg animation. Lazily constructed and reused so
    // browsers cache the file after the first trigger.
    //
    // Trailer-braam sync: the source MP3 is a 9s cinematic braam. It is
    // silent until ~0.26s, attacks sharply (~50dB rise) into the iconic
    // braam onset at t≈0.31s, swells to peak (~-12dB) at t≈2.3s, then decays
    // slowly through 9s. We land the braam attack at egg elapsed ~0.80s —
    // right at COLLAPSE_END, the moment the singularity reaches maximum
    // compression and the white flash ignites. The braam then swells through
    // flash/explode and decays through photo-hold and reverse.
    const SFX_BOOM_TIME = 0.31
    const SFX_VISUAL_TARGET = 0.80
    const SFX_DELAY_MS = Math.max(0, (SFX_VISUAL_TARGET - SFX_BOOM_TIME) * 1000)
    const sfx = new Audio('/assets/easter-egg.mp3')
    sfx.volume = 0.55
    sfx.preload = 'auto'

    let sfxTimeoutId: number | null = null

    const onEasterEgg = () => {
      // Don't restart if currently active — let the existing run finish
      if (eggStartRef.current === 0) {
        eggStartRef.current = performance.now()
        if (sfxTimeoutId !== null) clearTimeout(sfxTimeoutId)
        sfx.pause()
        sfxTimeoutId = window.setTimeout(() => {
          sfxTimeoutId = null
          sfx.currentTime = 0
          sfx.play().catch(() => {})
        }, SFX_DELAY_MS)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI_SEQUENCE[konamiIndexRef.current]) {
        konamiIndexRef.current++
        if (konamiIndexRef.current === KONAMI_SEQUENCE.length) {
          konamiIndexRef.current = 0
          window.dispatchEvent(new Event('easter-egg'))
        }
      } else {
        konamiIndexRef.current = e.key === KONAMI_SEQUENCE[0] ? 1 : 0
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('easter-egg', onEasterEgg)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('easter-egg', onEasterEgg)
      if (sfxTimeoutId !== null) clearTimeout(sfxTimeoutId)
      sfx.pause()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden supports-[height:100dvh]:h-[100dvh]"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <BlackHoleBackdrop />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" role="presentation" aria-hidden="true" />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)' }}
      />

      <div ref={heroTextRef} className="relative z-10 mx-auto w-full max-w-[1400px] px-6 md:px-12">
        <h1
          className="mx-auto max-w-[900px] text-center text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]"
          style={{ textShadow: '0 0 14px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6), 0 0 48px rgba(0,0,0,0.45)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Hi, I'm </span>
          <span className="font-normal text-white">Charles.</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> I'm a </span>
          <span className="font-normal text-white">Senior Product Manager</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> building products at the speed of </span>
          <span className="font-normal text-white">AI.</span>
        </h1>
      </div>

      <div ref={heroHintRef}>
        <EasterEggHint />
      </div>

      <div ref={heroScrollRef} className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL ↓</span>
      </div>
    </section>
  )
}
