import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 280
const VAPOR_COUNT = 60 // large translucent vapor blobs — creates smoke density
const MOUSE_RADIUS = 200
const MOUSE_PUSH_FORCE = 40
const NOISE_SCALE = 0.002 // How "zoomed in" the flow field is
const FLOW_STRENGTH = 1.2 // How fast particles follow the field

interface Particle {
  x: number
  y: number
  size: number
  opacity: number
  phase: number
  isCyan: boolean
  isVapor: boolean
}

// --- Simplified Perlin-like noise using sin/cos layering (fast, no lookup table) ---
function noise2D(x: number, y: number): number {
  // 4-octave layered sin noise — approximates Perlin at a fraction of the cost
  return (
    Math.sin(x * 1.2 + y * 0.9) * 0.5 +
    Math.sin(x * 0.5 - y * 1.3 + 2.1) * 0.3 +
    Math.sin(x * 2.1 + y * 0.4 - 1.7) * 0.15 +
    Math.cos(x * 0.7 + y * 1.8 + 0.5) * 0.05
  )
}

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
] as const

const EASTER_EGG_DURATION_MS = 4000

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const textOffsetRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  const easterEggRef = useRef(false)
  const konamiIndexRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const computedStyle = getComputedStyle(document.documentElement)
    const bgColor = computedStyle.getPropertyValue('--color-bg-primary').trim() || '#0A0A0A'
    const cyanColor = computedStyle.getPropertyValue('--color-accent-cyan').trim() || '#00D9FF'

    let width = 0
    let height = 0
    const particles: Particle[] = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    const initParticles = () => {
      particles.length = 0
      // Regular small particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 1 + Math.random() * 1.8,
          opacity: 0.1 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          isCyan: Math.random() < 0.12,
          isVapor: false,
        })
      }
      // Large vapor blobs — translucent, big radius
      for (let i = 0; i < VAPOR_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 10 + Math.random() * 20,
          opacity: 0.015 + Math.random() * 0.035,
          phase: Math.random() * Math.PI * 2,
          isCyan: Math.random() < 0.3,
          isVapor: true,
        })
      }
    }

    resize()
    initParticles()

    const onResize = () => { resize(); initParticles() }
    window.addEventListener('resize', onResize)

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY

      // Text repulsion
      if (textRef.current) {
        const rect = textRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 300 && dist > 0) {
          const strength = ((1 - dist / 300) ** 2) * 20
          textOffsetRef.current.x = (dx / dist) * strength
          textOffsetRef.current.y = (dy / dist) * strength
        }
      }
    }
    const onMouseLeave = () => {
      mouseRef.current.x = -9999
      mouseRef.current.y = -9999
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    let time = 0
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      if (!visibleRef.current) return

      time += 0.003
      ctx.clearRect(0, 0, width, height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const p of particles) {
        // --- Noise flow field ---
        // Sample noise at particle position to get flow direction
        const nx = p.x * NOISE_SCALE + time
        const ny = p.y * NOISE_SCALE + time * 0.7

        const angle = noise2D(nx, ny) * Math.PI * 2
        const flowMultiplier = easterEggRef.current ? 2 : 1
        const speed = (p.isVapor ? FLOW_STRENGTH * 0.6 : FLOW_STRENGTH) * flowMultiplier
        const flowX = Math.cos(angle) * speed
        const flowY = Math.sin(angle) * speed

        // Apply flow
        p.x += flowX
        p.y += flowY

        // Mouse repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 1) {
          const force = ((1 - dist / MOUSE_RADIUS) ** 2) * MOUSE_PUSH_FORCE
          p.x += (dx / dist) * force
          p.y += (dy / dist) * force
        }

        // Wrap around screen edges — tight wrap keeps density uniform
        if (p.x < -30) p.x = width + 20
        if (p.x > width + 30) p.x = -20
        if (p.y < -30) p.y = height + 20
        if (p.y > height + 30) p.y = -20

        // Bottom fade: particles near bottom of section fade out
        const bottomFade = 1 - Math.max(0, (p.y - height * 0.75) / (height * 0.25))
        const pulsedOpacity = p.opacity * bottomFade * (0.6 + 0.4 * Math.sin(time * 80 + p.phase))

        if (pulsedOpacity < 0.01) continue // skip invisible particles

        // Draw
        const isRainbow = easterEggRef.current
        if (isRainbow) {
          const rainbowColor = `hsl(${(time * 200 + p.phase * 57) % 360}, 80%, 60%)`
          ctx.globalAlpha = pulsedOpacity
          ctx.fillStyle = rainbowColor
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (p.isVapor ? 1 : 1.2), 0, Math.PI * 2)
          ctx.fill()
        } else if (p.isVapor) {
          // Large translucent vapor blob
          ctx.globalAlpha = pulsedOpacity
          ctx.fillStyle = p.isCyan ? 'rgba(0,180,220,0.6)' : 'rgba(255,255,255,0.5)'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.isCyan) {
          // Cyan particle with glow
          ctx.globalAlpha = pulsedOpacity * 0.25
          ctx.fillStyle = cyanColor
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = pulsedOpacity * 0.9
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // White particle
          ctx.globalAlpha = pulsedOpacity * 0.6
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
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
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Konami code + custom easter-egg event listener
  useEffect(() => {
    const activateEasterEgg = () => {
      easterEggRef.current = true
      setTimeout(() => { easterEggRef.current = false }, EASTER_EGG_DURATION_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI_SEQUENCE[konamiIndexRef.current]) {
        konamiIndexRef.current++
        if (konamiIndexRef.current === KONAMI_SEQUENCE.length) {
          konamiIndexRef.current = 0
          activateEasterEgg()
        }
      } else {
        konamiIndexRef.current = e.key === KONAMI_SEQUENCE[0] ? 1 : 0
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('easter-egg', activateEasterEgg)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('easter-egg', activateEasterEgg)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 80%, rgba(120,70,20,0.35) 0%, rgba(60,30,10,0.2) 40%, #0A0A0A 75%)',
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" role="presentation" aria-hidden="true" />

      {/* Bottom gradient fade — blends into About section */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, #0A0A0A 100%)',
        }}
      />

      <div ref={textRef} className="relative z-10 max-w-[900px] px-6">
        {/* Hero headline — xAI universe-grade typography */}
        <h1 className="text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]">
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>My name is </span>
          <span className="font-normal text-white">Charles.</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> I'm a Product Manager building products that drive </span>
          <span className="font-normal text-white">millions of users</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> and </span>
          <span className="font-normal text-white">mass revenue</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> at scale.</span>
        </h1>

        <div className="mt-10 font-mono text-[11px] uppercase tracking-[3px] text-text-muted md:text-xs">
          6M+ Users · 85% Revenue Impact · 5x Faster with AI
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/20">↓</span>
      </div>
    </section>
  )
}
