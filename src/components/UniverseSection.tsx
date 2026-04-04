import { useRef, useState, useCallback, useEffect } from 'react'
import { skills } from '../data/skills'

// --- Constants ---

const LINE_COUNT = 120 // every line gets a particle
// Every line gets an endpoint particle — no separate count needed
const ROTATION_SPEED = -0.002 // Y-axis rotation speed (negative = reverse direction)
const FOCAL_LENGTH = 600 // Perspective camera focal length
const SLOW_MULTIPLIER = 0.3

// Max radius in world units (will be scaled to screen)
const MAX_RADIUS = 230

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
  // Fibonacci sphere — mathematically optimal uniform distribution on sphere
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < LINE_COUNT; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / LINE_COUNT)
    const phi = goldenAngle * i

    // ρ: varying lengths
    const lenRand = Math.random()
    let rho: number
    if (lenRand < 0.2) rho = MAX_RADIUS * (0.3 + Math.random() * 0.15)
    else if (lenRand < 0.5) rho = MAX_RADIUS * (0.45 + Math.random() * 0.2)
    else rho = MAX_RADIUS * (0.65 + Math.random() * 0.35)

    // Depth illusion: shorter lines are dimmer (farther away), longer lines brighter (closer)
    const depthBrightness = 60 + (rho / MAX_RADIUS) * 50

    lines.push({
      theta, phi, rho,
      brightness: depthBrightness,
      alpha: 0.15 + (rho / MAX_RADIUS) * 0.25, // farther = more transparent
      width: 0.8, // slightly thicker
    })
  }
  return lines
}

function generateParticles(lines: Line[]): Particle[] {
  const particles: Particle[] = []

  // Shuffle lines, assign first N to skills, rest to decoration
  const shuffledLines = [...lines].sort(() => Math.random() - 0.5)
  const skillLines = shuffledLines.slice(0, skills.length)
  const decoLines = shuffledLines.slice(skills.length)

  // Skill particles — attached to line endpoints
  skills.forEach((skill, i) => {
    const line = skillLines[i]
    const phi = line.phi
    const theta = line.theta
    const rho = line.rho

    const colorMap = {
      cyan: { r: 140, g: 180, b: 210 },
      white: { r: 180, g: 190, b: 205 },
      gray: { r: 130, g: 140, b: 155 },
    }
    const c = colorMap[skill.color]

    // Smaller, more uniform sizes like xAI
    const size = 4 + Math.random() * 4

    particles.push({
      theta, phi, rho, size,
      colorR: c.r, colorG: c.g, colorB: c.b,
      alpha: skill.color === 'cyan' ? 0.7 : skill.color === 'white' ? 0.6 : 0.35,
      phase: Math.random() * Math.PI * 2,
      isSkill: true,
      skillIndex: i,
    })
  })

  // Decoration particles — one per remaining line (all lines get a particle)
  for (let i = 0; i < decoLines.length; i++) {
    const line = decoLines[i]
    const brightness = 120 + Math.random() * 80
    particles.push({
      theta: line.theta,
      phi: line.phi,
      rho: line.rho,
      size: 2 + Math.random() * 1.5,
      colorR: brightness, colorG: brightness + 10, colorB: brightness + 20,
      alpha: 0.2 + Math.random() * 0.3,
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

function perspectiveProject(x: number, y: number, z: number, cx: number, cy: number) {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z)
  return {
    screenX: cx + x * scale,
    screenY: cy + y * scale,
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
  const screenPosRef = useRef<ScreenPos[]>(skills.map(() => ({ x: 0, y: 0 })))
  const hoverZoneRefs = useRef<(HTMLDivElement | null)[]>([])
  const tooltipRef = useRef<HTMLDivElement>(null)
  const textLeftRef = useRef<HTMLSpanElement>(null)
  const textRightRef = useRef<HTMLSpanElement>(null)

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

    let animId: number
    let width = 0
    let height = 0
    let rotation = 0
    let visible = false
    let frameCount = 0
    let cachedRect = section.getBoundingClientRect()

    const onScroll = () => { cachedRect = section.getBoundingClientRect() }
    window.addEventListener('scroll', onScroll, { passive: true })

    const resize = () => {
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

    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    // Z range for depth alpha calculation
    const zMax = MAX_RADIUS
    const zMin = -MAX_RADIUS
    const zRange = zMax - zMin

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!visible) return

      rotation += ROTATION_SPEED * (speedRef.current ?? 1)
      frameCount++
      const time = frameCount * 0.016

      const cx = width / 2
      const cy = height / 2
      const cosR = Math.cos(rotation)
      const sinR = Math.sin(rotation)

      ctx.clearRect(0, 0, width, height)

      // --- Draw lines ---
      for (let i = 0; i < LINES.length; i++) {
        const line = LINES[i]

        const rho = line.rho

        // Spherical → Cartesian → Y-rotation → Perspective
        const cart = sphericalToCartesian(rho, line.theta, line.phi)
        const rot = rotateY(cart.x, cart.y, cart.z, cosR, sinR)
        const proj = perspectiveProject(rot.x, rot.y, rot.z, cx, cy)

        // Depth-based alpha from 3D rotation
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

      // --- Draw particles ---
      const positions = screenPosRef.current

      for (let i = 0; i < PARTICLES.length; i++) {
        const p = PARTICLES[i]

        const rho = p.rho

        const cart = sphericalToCartesian(rho, p.theta, p.phi)
        const rot = rotateY(cart.x, cart.y, cart.z, cosR, sinR)
        const proj = perspectiveProject(rot.x, rot.y, rot.z, cx, cy)

        if (p.isSkill && p.skillIndex >= 0) {
          positions[p.skillIndex] = { x: proj.screenX, y: proj.screenY }
        }

        const isHovered = p.isSkill && hoveredRef.current === p.skillIndex

        // Depth alpha + star twinkle for decoration particles
        const depthAlpha = Math.max(0.1, (zMax - rot.z) / zRange)
        let flicker: number
        if (p.isSkill) {
          // Skill particles: gentle pulse
          flicker = 0.7 + 0.3 * Math.sin(time * 0.6 + p.phase * 2)
        } else {
          // Decoration: star-like twinkle — sharp peaks
          const raw = Math.sin(time * (2 + Math.sin(p.phase) * 1.5) + p.phase * 3)
          flicker = 0.4 + Math.max(0, raw) * 0.6 // never fully disappears, occasional bright flash
        }
        const pulse = p.alpha * depthAlpha * flicker
        const drawAlpha = isHovered ? Math.min(pulse * 1.8, 1) : pulse
        const drawSize = (isHovered ? p.size * 1.5 : p.size) * Math.max(0.4, proj.scale)

        ctx.globalAlpha = drawAlpha
        ctx.fillStyle = `rgb(${p.colorR},${p.colorG},${p.colorB})`
        ctx.fillRect(proj.screenX - drawSize / 2, proj.screenY - drawSize / 2, drawSize, drawSize)
      }
      ctx.globalAlpha = 1

      // --- Update hover zones (every 5 frames) ---
      if (frameCount % 5 === 0) {
        for (let i = 0; i < skills.length; i++) {
          const el = hoverZoneRefs.current[i]
          if (el) {
            el.style.transform = `translate(${positions[i].x - 24}px, ${positions[i].y - 24}px)`
          }
        }
        if (tooltipRef.current && hoveredRef.current !== null) {
          const idx = hoveredRef.current
          tooltipRef.current.style.transform = `translate(${positions[idx].x + 18}px, ${positions[idx].y}px) translateY(-50%)`
        }

        // Scroll-driven text spread — uses cached rect (updated on scroll, not per frame)
        const scrollProgress = Math.max(0, Math.min(1, 1 - cachedRect.bottom / (cachedRect.height + height)))
        const spread = scrollProgress * 100 // max 100px extra offset
        if (textLeftRef.current) {
          textLeftRef.current.style.transform = `translateX(${-spread}px)`
        }
        if (textRightRef.current) {
          textRightRef.current.style.transform = `translateX(${spread}px)`
        }
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
      className="relative w-full overflow-hidden"
      style={{ height: '100vh', background: '#0A0A0A' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" role="presentation" aria-hidden="true" />

      {/* Top gradient fade — smooth blend from About section */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-32"
        style={{ background: 'linear-gradient(to top, transparent 0%, #0A0A0A 100%)' }}
      />

      {/* Hover zones */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {skills.map((skill, i) => (
          <div
            key={skill.name}
            ref={(el) => { hoverZoneRefs.current[i] = el }}
            className="pointer-events-auto absolute left-0 top-0"
            style={{ width: 48, height: 48 }}
            onMouseEnter={() => {
              setHoveredIndex(i)
              speedRef.current = SLOW_MULTIPLIER
            }}
            onMouseLeave={() => {
              setHoveredIndex(null)
              speedRef.current = 1
            }}
          />
        ))}
      </div>

      {/* Tooltip */}
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
            color: 'rgba(180, 195, 215, 0.8)',
          }}
        >
          {hoveredIndex !== null ? skills[hoveredIndex].name : ''}
        </span>
      </div>

      {/* Text overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 select-none" aria-label="Understand What I Do">
        <span
          ref={textLeftRef}
          className="pointer-events-auto absolute right-[calc(50%-40px)] top-[46%] text-[32px] md:right-[calc(50%-60px)] md:text-[64px] lg:text-[80px]"
          onMouseEnter={handleTextEnter}
          onMouseLeave={handleTextLeave}
          style={{
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '3px',
            textAlign: 'right',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.95) 0%, rgba(200,210,225,0.65) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Understand
        </span>
        <span
          ref={textRightRef}
          className="pointer-events-auto absolute left-[calc(50%-30px)] top-[51%] text-[32px] md:left-[calc(50%-40px)] md:text-[64px] lg:text-[80px]"
          onMouseEnter={handleTextEnter}
          onMouseLeave={handleTextLeave}
          style={{
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '3px',
            background: 'linear-gradient(90deg, rgba(200,210,225,0.65) 0%, rgba(255,255,255,0.95) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          What I Do
        </span>
      </div>
    </section>
  )
}
