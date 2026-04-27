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

const easeInCubic = (x: number) => x * x * x
const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)
const easeOutBack = (x: number, c1 = 1.2) => {
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
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
  const textRef = useRef<HTMLDivElement>(null)
  const textOffsetRef = useRef({ x: 0, y: 0 })
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
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
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

      // Collect face pixels using edge detection + brightness
      // PNG with circular crop: alpha=0 outside circle, alpha=255 inside
      const pool: Array<{ x: number; y: number; weight: number }> = []

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

          // Edge detection
          const edge = Math.abs(b - getPixel(px - 1, py).b)
            + Math.abs(b - getPixel(px + 1, py).b)
            + Math.abs(b - getPixel(px, py - 1).b)
            + Math.abs(b - getPixel(px, py + 1).b)

          // Only edges — creates recognizable silhouette outline, not filled block
          if (edge > 25) {
            pool.push({ x: px / PHOTO_SAMPLE_SIZE, y: py / PHOTO_SAMPLE_SIZE, weight: edge })
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
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (textRef.current) {
        const rect = textRef.current.getBoundingClientRect()
        const tcx = rect.left + rect.width / 2
        const tcy = rect.top + rect.height / 2
        const dx = tcx - e.clientX
        const dy = tcy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 300 && dist > 0) {
          const strength = ((1 - dist / 300) ** 2) * 20
          textOffsetRef.current.x = (dx / dist) * strength
          textOffsetRef.current.y = (dy / dist) * strength
        }
      }
    }
    window.addEventListener('mousemove', onMouseMove)

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

      const photoCX = width / 2 - PHOTO_DISPLAY_SIZE / 2
      const photoCY = height * 0.50 - PHOTO_DISPLAY_SIZE / 2

      ctx.fillStyle = PARTICLE_COLOR

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
            // Reverse: 1.5s slow exponential approach back to ring, alpha and
            // saturation both fade so rainbow particles dissolve into white ring.
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

        // Speed-line streak behind exploding particles (drawn under the dot)
        if (streakAlpha > 0.01) {
          ctx.globalAlpha = streakAlpha
          ctx.strokeStyle = `hsl(${(currentTime * 60 + p.row * 15 + p.index * 4) % 360}, 90%, 75%)`
          ctx.lineWidth = 1.4
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(streakFromX, streakFromY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }

        // Idle orbit trail — tangent line behind each star, length scaled to
        // angular velocity * radius (faster orbits = longer streaks). Skip
        // dim or slow particles where the streak isn't visually meaningful;
        // with 3000 particles this saves a meaningful chunk of stroke calls.
        if (eggPhase === 'idle' && !prefersReduced && alpha > 0.28 && Math.abs(speed) > 0.18) {
          const motionSign = speed >= 0 ? 1 : -1
          const tangX = -sinA * motionSign
          const tangY = cosA * motionSign
          const trailLen = Math.min(TRAIL_MAX, Math.abs(speed) * radius * 0.28)
          if (trailLen > 1) {
            ctx.globalAlpha = alpha * 0.32
            ctx.strokeStyle = PARTICLE_COLOR
            ctx.lineWidth = 0.7
            ctx.lineCap = 'round'
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
        } else if (eggPhase === 'explode' || eggPhase === 'photo') {
          // Rainbow during explosion + photo
          const hue = (currentTime * 60 + p.row * 15 + p.index * 4) % 360
          ctx.fillStyle = `hsl(${hue}, 80%, 65%)`
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
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
          // Rainbow desaturates back to white as particles return to ring
          const rk = (eggElapsed - EGG_PHOTO_END) / (EGG_REVERSE_END - EGG_PHOTO_END)
          const hue = (currentTime * 60 + p.row * 15 + p.index * 4) % 360
          const sat = 80 * (1 - rk)
          const lit = 65 + rk * 25
          ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`
          ctx.beginPath()
          ctx.arc(x, y, PARTICLE_SIZE, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PARTICLE_COLOR
        } else {
          ctx.drawImage(dotCanvas, x - PARTICLE_SIZE, y - PARTICLE_SIZE, PARTICLE_SIZE * 2, PARTICLE_SIZE * 2)
        }
      }
      ctx.globalAlpha = 1

      // Text offset decay
      const tOff = textOffsetRef.current
      tOff.x *= 0.92
      tOff.y *= 0.92
      if (textRef.current) {
        textRef.current.style.transform = `translate(${tOff.x}px, ${tOff.y}px)`
      }
    }

    animate()

    return () => {
      cancelAnimationFrame(animIdRef.current)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      section.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  // Konami code + easter egg. Konami dispatches the global event so
  // BlackHoleBackdrop's shader phases stay synced with the particle phases.
  useEffect(() => {
    const onEasterEgg = () => {
      // Don't restart if currently active — let the existing run finish
      if (eggStartRef.current === 0) {
        eggStartRef.current = performance.now()
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

      <div ref={textRef} className="relative z-10 mx-auto w-full max-w-[1400px] px-6 md:px-12">
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

      <EasterEggHint />

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL ↓</span>
      </div>
    </section>
  )
}
