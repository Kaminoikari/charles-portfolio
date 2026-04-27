import { useRef, useState, useCallback, useEffect } from 'react'
import { useSkills } from '../data'
// English skills file is also used at module load time for stable particle
// generation (count is invariant across locales). Display labels come from
// the locale-aware useSkills() hook inside the component.
import { skills as EN_SKILLS } from '../data/skills.en'
import { useT } from '../i18n'

const SKILL_COUNT = EN_SKILLS.length

// --- Constants ---

const LINE_COUNT = 120 // every line gets a particle
// Every line gets an endpoint particle — no separate count needed
const ROTATION_SPEED = -0.001 // Y-axis rotation speed (negative = reverse direction)
const FOCAL_LENGTH = 900 // Higher = less perspective distortion, rounder sphere
const SLOW_MULTIPLIER = 0.3

// Max radius in world units (will be scaled to screen)
const MAX_RADIUS = 450

interface Line {
  theta: number // polar angle (0~π, angle from Z-axis)
  phi: number // azimuthal angle (0~2π, angle in XY plane)
  rho: number // radius in pixels
  brightness: number
  alpha: number
  width: number
}

interface Particle {
  theta: number
  phi: number
  rho: number
  size: number
  colorR: number
  colorG: number
  colorB: number
  alpha: number
  phase: number // for noise/breathing
  isSkill: boolean
  skillIndex: number
}

// --- Generate data using spherical coordinates ---

function generateLines(): Line[] {
  const lines: Line[] = []

  for (let i = 0; i < LINE_COUNT; i++) {
    // Organic random direction — uniform on sphere via random sampling
    // (not Fibonacci which creates visible geometric patterns)
    const theta = Math.acos(1 - 2 * Math.random()) // uniform polar
    const phi = Math.random() * Math.PI * 2 // uniform azimuthal

    // Add organic angular jitter — slight perturbation for natural feel
    const jitterTheta = theta + (Math.random() - 0.5) * 0.05
    const jitterPhi = phi + (Math.random() - 0.5) * 0.05

    // Organic length distribution — smooth exponential falloff
    // Most lines cluster around medium length, with organic tails
    const baseLen = Math.random()
    const organicLen = Math.pow(baseLen, 0.6) // bias toward longer, smooth falloff
    const jitter = 1 + (Math.random() - 0.5) * 0.2 // ±10% organic variation
    const rho = MAX_RADIUS * (0.08 + organicLen * 0.92) * jitter

    const depthBrightness = 90 + (rho / MAX_RADIUS) * 60

    lines.push({
      theta: jitterTheta, phi: jitterPhi, rho,
      brightness: depthBrightness,
      alpha: 0.25 + (rho / MAX_RADIUS) * 0.35,
      width: 0.8,
    })
  }
  return lines
}

function generateParticles(lines: Line[]): Particle[] {
  const particles: Particle[] = []

  // Shuffle lines, assign first N to skills, rest to decoration
  const shuffledLines = [...lines].sort(() => Math.random() - 0.5)
  const skillLines = shuffledLines.slice(0, SKILL_COUNT)
  const decoLines = shuffledLines.slice(SKILL_COUNT)

  // Skill particles — attached to line endpoints
  EN_SKILLS.forEach((_skill, i) => {
    const line = skillLines[i]
    const phi = line.phi
    const theta = line.theta
    const rho = line.rho

    // ~20% of skill particles get bright blue accent (like xAI highlights)
    const isBrightAccent = Math.random() < 0.2
    const c = isBrightAccent
      ? { r: 120, g: 180, b: 255 }  // bright blue accent
      : { r: 156, g: 184, b: 221 }  // default muted blue

    // Smaller, more uniform sizes like xAI
    const size = 6.4 + Math.random() * 6.4

    particles.push({
      theta, phi, rho, size,
      colorR: c.r, colorG: c.g, colorB: c.b,
      alpha: 1,
      phase: Math.random() * Math.PI * 2,
      isSkill: true,
      skillIndex: i,
    })
  })

  // Decoration particles — one per remaining line (all lines get a particle)
  for (let i = 0; i < decoLines.length; i++) {
    const line = decoLines[i]
    const isBright = Math.random() < 0.1 // 10% bright accent
    particles.push({
      theta: line.theta,
      phi: line.phi,
      rho: line.rho,
      size: 6 + Math.random() * 4,
      colorR: isBright ? 120 : 156,
      colorG: isBright ? 180 : 184,
      colorB: isBright ? 255 : 221,
      alpha: isBright ? 0.8 : 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      isSkill: false,
      skillIndex: -1,
    })
  }

  return particles
}

const LINES = generateLines()
const PARTICLES = generateParticles(LINES)

// --- Helpers: spherical → 3D → rotated → projected ---

function sphericalToCartesian(rho: number, theta: number, phi: number) {
  const sinT = Math.sin(theta)
  return {
    x: rho * sinT * Math.cos(phi),
    y: rho * sinT * Math.sin(phi),
    z: rho * Math.cos(theta),
  }
}

function rotateY(x: number, y: number, z: number, cosR: number, sinR: number) {
  return {
    x: x * cosR + z * sinR,
    y: y, // unchanged
    z: -x * sinR + z * cosR,
  }
}

function perspectiveProject(x: number, y: number, z: number, cx: number, cy: number, screenScale: number) {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z)
  return {
    screenX: cx + x * scale * screenScale,
    screenY: cy + y * scale * screenScale,
    scale,
    z,
  }
}

// --- Component ---

interface ScreenPos { x: number; y: number }

export default function UniverseSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const speedRef = useRef(1)
  const hoveredRef = useRef<number | null>(null)
  const skills = useSkills()
  const t = useT()
  const screenPosRef = useRef<ScreenPos[]>(EN_SKILLS.map(() => ({ x: 0, y: 0 })))
  const hoverZoneRefs = useRef<(HTMLDivElement | null)[]>([])
  const tooltipRef = useRef<HTMLDivElement>(null)
  const textLeftRef = useRef<HTMLSpanElement>(null)
  const textRightRef = useRef<HTMLSpanElement>(null)
  const autoLabelRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  hoveredRef.current = hoveredIndex

  const handleTextEnter = useCallback(() => { speedRef.current = SLOW_MULTIPLIER }, [])
  const handleTextLeave = useCallback(() => { speedRef.current = 1 }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // CSS vars not needed in Universe draw loop (no bg fills or cyan particles)

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animId: number
    let width = 0
    let height = 0
    let rotation = 0
    let visible = false
    let frameCount = 0
    let autoLabelIndex = Math.floor(Math.random() * SKILL_COUNT)
    let autoLabelTimer = 0
    let autoLabelStarted = false
    const AUTO_LABEL_INTERVAL = 300 // frames (~5 seconds at 60fps)
    const AUTO_LABEL_FADE = 30 // frames for fade transition
    let cachedRect = section.getBoundingClientRect()

    const onScroll = () => { cachedRect = section.getBoundingClientRect() }
    window.addEventListener('scroll', onScroll, { passive: true })

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    // Z range for depth alpha calculation
    const zMax = MAX_RADIUS
    const zMin = -MAX_RADIUS
    const zRange = zMax - zMin

    // Pre-allocate particle sort array (reused every frame)
    const particleOrder = PARTICLES.map((_, i) => ({ z: 0, idx: i, sx: 0, sy: 0, sc: 1, da: 0 }))

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!visible) return

      if (!prefersReduced) rotation += ROTATION_SPEED * (speedRef.current ?? 1)
      frameCount++
      const time = frameCount * 0.016

      const cx = width / 2
      const cy = height / 2
      const cosR = Math.cos(rotation)
      const sinR = Math.sin(rotation)
      // Scale sphere to fill square canvas — sphere radius 300 maps to 80% of canvas
      const screenScale = (width * 0.8) / (MAX_RADIUS * 2)

      ctx.clearRect(0, 0, width, height)

      const positions = screenPosRef.current

      // --- Draw all lines first (no sorting needed — they all start from center) ---
      for (let i = 0; i < LINES.length; i++) {
        const line = LINES[i]
        const cart = sphericalToCartesian(line.rho, line.theta, line.phi)
        const rot = rotateY(cart.x, cart.y, cart.z, cosR, sinR)
        const proj = perspectiveProject(rot.x, rot.y, rot.z, cx, cy, screenScale)
        const depthAlpha = Math.max(0.08, (zMax - rot.z) / zRange)

        const b = Math.round(line.brightness)
        const a0 = line.alpha * depthAlpha
        ctx.strokeStyle = `rgba(${b},${b},${b + 5},${a0})`
        ctx.lineWidth = line.width
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(proj.screenX, proj.screenY)
        ctx.stroke()
      }

      // --- Compute particle positions + z-depth ---
      for (let i = 0; i < PARTICLES.length; i++) {
        const p = PARTICLES[i]
        const cart = sphericalToCartesian(p.rho, p.theta, p.phi)
        const rot = rotateY(cart.x, cart.y, cart.z, cosR, sinR)
        const proj = perspectiveProject(rot.x, rot.y, rot.z, cx, cy, screenScale)
        const depthAlpha = Math.max(0.1, (zMax - rot.z) / zRange)
        particleOrder[i].z = rot.z
        particleOrder[i].idx = i
        particleOrder[i].sx = proj.screenX
        particleOrder[i].sy = proj.screenY
        particleOrder[i].sc = proj.scale
        particleOrder[i].da = depthAlpha
      }

      // Sort particles: farthest first, closest last (drawn on top)
      particleOrder.sort((a, b) => b.z - a.z)

      // --- Draw particles in z-sorted order (near covers far) ---
      for (const item of particleOrder) {
        const p = PARTICLES[item.idx]

        if (p.isSkill && p.skillIndex >= 0) {
          positions[p.skillIndex] = { x: item.sx, y: item.sy }
        }

        const isHovered = p.isSkill && hoveredRef.current === p.skillIndex
        let flicker: number
        if (p.isSkill) {
          flicker = 1 // no flicker for skill particles
        } else {
          const raw = Math.sin(time * (2 + Math.sin(p.phase) * 1.5) + p.phase * 3)
          flicker = 0.4 + Math.max(0, raw) * 0.6
        }
        const pulse = p.alpha * item.da * flicker
        const drawAlpha = isHovered ? Math.min(pulse * 1.8, 1) : pulse
        const drawSize = (isHovered ? p.size * 1.5 : p.size) * Math.max(0.4, item.sc)

        // Opaque black background so lines don't show through
        ctx.globalAlpha = 1
        ctx.fillStyle = '#0A0A0A'
        ctx.fillRect(item.sx - drawSize / 2, item.sy - drawSize / 2, drawSize, drawSize)
        // Colored particle
        ctx.globalAlpha = drawAlpha
        ctx.fillStyle = `rgb(${p.colorR},${p.colorG},${p.colorB})`
        ctx.fillRect(item.sx - drawSize / 2, item.sy - drawSize / 2, drawSize, drawSize)
      }
      ctx.globalAlpha = 1

      // --- Update hover zones (every 5 frames) ---
      if (frameCount % 5 === 0) {
        for (let i = 0; i < SKILL_COUNT; i++) {
          const el = hoverZoneRefs.current[i]
          if (el) {
            el.style.transform = `translate(${positions[i].x - 24}px, ${positions[i].y - 24}px)`
          }
        }
        if (tooltipRef.current && hoveredRef.current !== null) {
          const idx = hoveredRef.current
          const cc = canvasContainerRef.current
          const sr = section.getBoundingClientRect()
          const cr = cc ? cc.getBoundingClientRect() : sr
          const ox = cr.left - sr.left
          const oy = cr.top - sr.top
          tooltipRef.current.style.transform = `translate(${positions[idx].x + ox}px, ${positions[idx].y + oy}px) translate(-50%, calc(-100% - 12px))`
        }

      }

      // Auto-cycling skill label — positioned at random skill particle (section-level coords)
      if (hoveredRef.current === null && autoLabelRef.current) {
        if (!autoLabelStarted && visible) {
          autoLabelStarted = true
          autoLabelTimer = 0
          autoLabelRef.current.textContent = skills[autoLabelIndex].name
        }
        autoLabelTimer++
        if (autoLabelTimer >= AUTO_LABEL_INTERVAL) {
          autoLabelTimer = 0
          let next = Math.floor(Math.random() * SKILL_COUNT)
          while (next === autoLabelIndex) next = Math.floor(Math.random() * SKILL_COUNT)
          autoLabelIndex = next
          autoLabelRef.current.textContent = skills[autoLabelIndex].name
        }
        const t = autoLabelTimer
        let opacity: number
        if (t < AUTO_LABEL_FADE) opacity = t / AUTO_LABEL_FADE
        else if (t > AUTO_LABEL_INTERVAL - AUTO_LABEL_FADE) opacity = (AUTO_LABEL_INTERVAL - t) / AUTO_LABEL_FADE
        else opacity = 1
        autoLabelRef.current.style.opacity = String(opacity)
        const pos = positions[autoLabelIndex]
        const cc = canvasContainerRef.current
        const sr = section.getBoundingClientRect()
        const cr = cc ? cc.getBoundingClientRect() : sr
        const ox = cr.left - sr.left
        const oy = cr.top - sr.top
        autoLabelRef.current.style.transform = `translate(${pos.x + ox}px, ${pos.y + oy}px) translate(-50%, calc(-100% - 12px))`
      } else if (autoLabelRef.current) {
        autoLabelRef.current.style.opacity = '0'
      }

      // Scroll-driven text spread — every frame for smooth motion
      const scrollProgress = Math.max(0, Math.min(1, 1 - cachedRect.bottom / (cachedRect.height + height)))
      const spread = scrollProgress * 100 // max 100px extra offset
      if (textLeftRef.current) {
        textLeftRef.current.style.transform = `translateX(${-spread}px)`
      }
      if (textRightRef.current) {
        textRightRef.current.style.transform = `translateX(${spread}px)`
      }
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <section
      id="skills"
      ref={sectionRef}
      className="relative flex w-full flex-col items-center overflow-hidden pb-0"
      style={{ background: '#0A0A0A' }}
    >
      <div className="z-10 w-full max-w-[1400px] px-6 pt-16 sm:pt-32 md:px-12">
        <h2 className="mb-2 font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ SKILLS ]</h2>
      </div>
      <div className="relative h-[550px] lg:h-[800px] xl:h-[1000px]">
        <div ref={canvasContainerRef} className="absolute left-1/2 top-0 h-[550px] w-[600px] -translate-x-1/2 lg:h-[800px] lg:w-[1000px] xl:h-[1000px] xl:w-[1200px] [&>canvas]:!h-full [&>canvas]:!w-full">
          <canvas ref={canvasRef} role="presentation" aria-hidden="true" />

          {/* Hover zones — inside canvas container so coordinates match */}
          <div className="pointer-events-none absolute inset-0 z-30">
            {skills.map((skill, i) => (
              <div
                key={skill.name}
                ref={(el) => { hoverZoneRefs.current[i] = el }}
                className="pointer-events-auto absolute left-0 top-0"
                style={{ width: 48, height: 48 }}
                role="button"
                tabIndex={0}
                aria-label={skill.name}
                onMouseEnter={() => {
                  setHoveredIndex(i)
                  speedRef.current = SLOW_MULTIPLIER
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null)
                  speedRef.current = 1
                }}
                onFocus={() => {
                  setHoveredIndex(i)
                  speedRef.current = SLOW_MULTIPLIER
                }}
                onBlur={() => {
                  setHoveredIndex(null)
                  speedRef.current = 1
                }}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Top gradient fade — smooth blend from About section */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-32"
        style={{ background: 'linear-gradient(to top, transparent 0%, #0A0A0A 100%)' }}
      />

      {/* Tooltip — section level so gradient can't cover it */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-50"
        style={{
          opacity: hoveredIndex !== null ? 1 : 0,
          transition: 'opacity 150ms',
        }}
      >
        <span
          style={{
            fontFamily: "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '1.5px',
            textTransform: 'uppercase' as const,
            color: '#9cb8dd', backgroundColor: 'rgba(10, 10, 10, 0.85)', padding: '2px 6px',
          }}
        >
          {hoveredIndex !== null ? skills[hoveredIndex].name : ''}
        </span>
      </div>

      {/* Auto-cycling skill label — section level */}
      <div
        ref={autoLabelRef}
        className="pointer-events-none absolute left-0 top-0 z-50"
        style={{
          opacity: 0,
          transition: 'none',
          fontFamily: "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '1.5px',
          textTransform: 'uppercase' as const,
          color: '#9cb8dd', backgroundColor: 'rgba(10, 10, 10, 0.85)', padding: '2px 6px',
        }}
      />

      {/* Text overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 select-none" aria-label={t('home.universeAriaLabel')}>
        <span
          ref={textLeftRef}
          className="pointer-events-auto absolute right-[calc(50%-10%)] top-[49%] text-4xl leading-[2.25rem] tracking-tight md:right-[calc(50%+80px)] md:top-[37%] md:text-[5rem] md:leading-[5rem] lg:right-[calc(50%+120px)]"
          onMouseEnter={handleTextEnter}
          onMouseLeave={handleTextLeave}
          style={{
            background: 'linear-gradient(to left, rgba(255,255,255,0.5), rgba(255,255,255,1))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t('home.universeWordLeft')}
        </span>
        <span
          ref={textRightRef}
          className="pointer-events-auto absolute left-[calc(50%-10%)] top-[58%] text-4xl leading-[2.25rem] tracking-tight md:left-[calc(50%+80px)] md:top-[53%] md:text-[5rem] md:leading-[5rem] lg:left-[calc(50%+120px)]"
          onMouseEnter={handleTextEnter}
          onMouseLeave={handleTextLeave}
          style={{
            background: 'linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,1))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t('home.universeWordRight')}
        </span>
      </div>
    </section>
  )
}
