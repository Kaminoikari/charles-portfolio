import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 350
const MOUSE_RADIUS = 250
const MOUSE_PUSH_FORCE = 50
const TEXT_REPULSE_RADIUS = 300
const TEXT_REPULSE_STRENGTH = 20

interface Particle {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  size: number
  opacity: number
  phase: number
  flowSpeed: number
  isCyan: boolean
}

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const textOffsetRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        particles.push({
          x, y,
          originX: x, originY: y,
          vx: 0, vy: 0,
          size: 1 + Math.random() * 1.8,
          opacity: 0.1 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
          flowSpeed: 0.3 + Math.random() * 0.7,
          isCyan: Math.random() < 0.15,
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

      // Text repulsion — direct DOM manipulation, no React re-render
      if (textRef.current) {
        const rect = textRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < TEXT_REPULSE_RADIUS && dist > 0) {
          const strength = ((1 - dist / TEXT_REPULSE_RADIUS) ** 2) * TEXT_REPULSE_STRENGTH
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

    // IntersectionObserver — pause animation when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    let time = 0
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)

      // Skip rendering when not visible
      if (!visibleRef.current) return

      time += 0.016
      ctx.clearRect(0, 0, width, height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const p of particles) {
        // Wave-like fluid motion — large amplitude global wave field
        const waveFreq = 0.004
        const waveAmp = 40
        // Global wave: coordinated sine waves create visible ocean-like motion
        const globalWaveX = Math.sin(p.originY * waveFreq * 2 + time * 0.8) * waveAmp
            + Math.sin(p.originY * waveFreq * 0.7 + time * 0.5 + 1.5) * waveAmp * 0.6
        const globalWaveY = Math.cos(p.originX * waveFreq * 1.5 + time * 0.6) * waveAmp * 0.7
            + Math.cos(p.originX * waveFreq * 0.5 + time * 0.4 + 2.0) * waveAmp * 0.4
        // Individual micro-oscillation
        const microX = Math.sin(time * p.flowSpeed + p.phase) * 3
        const microY = Math.cos(time * p.flowSpeed * 0.8 + p.phase) * 2.5

        const targetX = p.originX + globalWaveX + microX
        const targetY = p.originY + globalWaveY + microY

        // Mouse repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 1) {
          const force = ((1 - dist / MOUSE_RADIUS) ** 2) * MOUSE_PUSH_FORCE
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }

        // Spring back + friction — fast enough to follow waves
        p.vx += (targetX - p.x) * 0.05
        p.vy += (targetY - p.y) * 0.05
        p.vx *= 0.88
        p.vy *= 0.88
        p.x += p.vx
        p.y += p.vy

        // Prevent teleport streaks — increased range for wave motion
        const distFromOrigin = Math.abs(p.x - p.originX) + Math.abs(p.y - p.originY)
        if (distFromOrigin > 500) {
          p.x = p.originX
          p.y = p.originY
          p.vx = 0
          p.vy = 0
        }

        // Draw — single arc per particle, glow only for cyan (15% of particles)
        const pulsedOpacity = p.opacity * (0.6 + 0.4 * Math.sin(time * 1.5 + p.phase))

        if (p.isCyan) {
          // Cyan: outer glow + inner core (only ~53 particles)
          ctx.globalAlpha = pulsedOpacity * 0.25
          ctx.fillStyle = '#00D9FF'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = pulsedOpacity * 0.9
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // White: single circle only (saves ~300 draw calls/frame)
          ctx.globalAlpha = pulsedOpacity * 0.6
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // Text offset decay — done in animation loop, not React state
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

      <div ref={textRef} className="relative z-10 text-center">
        <h1 className="text-[40px] font-bold tracking-[6px] text-white sm:text-[56px] md:text-[72px] lg:text-[80px]">
          CHARLES
        </h1>
        <p className="mt-3 text-lg tracking-[3px] text-text-muted md:text-xl">
          AI Product Builder
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>
          SCROLL TO EXPLORE ↓
        </span>
      </div>
    </section>
  )
}
