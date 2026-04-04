import { useEffect, useRef } from 'react'

// --- Ring particle config (matching bramus/css-houdini-ringparticles) ---
const INNER_RADIUS = 120
const THICKNESS = 450
const NUM_PARTICLES = 40
const NUM_ROWS = 15
const PARTICLE_SIZE = 1.5
const MIN_ALPHA = 0.05
const MAX_ALPHA = 1.0
const PARTICLE_COLOR = 'rgba(180, 190, 210, 1)' // light gray-blue on dark bg
const ANIMATION_SPEED = 0.003 // controls wave speed (slower pulsation)
const MOUSE_EASE = 0.015 // ~3s ease to target
// Wave physics constants (deterministic from seed)
const W1_FREQ = 4
const W1_SPEED = 1.5
const W1_DIR = 1
const W2_FREQ = 6
const W2_SPEED = 1
const W2_DIR = -1
const ROW_TWIST = 1.5 // multiplied by normalized rowProgress [0,1] × 2π
const AMPLITUDE = 14

const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']
const EASTER_EGG_DURATION_MS = 4000

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const textOffsetRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  const easterEggRef = useRef(false)
  const konamiIndexRef = useRef(0)

  const mouseTargetRef = useRef({ x: 50, y: 50 }) // percentage 0-100
  const mouseSmoothRef = useRef({ x: 50, y: 50 })

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    // Fix #3: pre-render particle dot to OffscreenCanvas for perf
    const dotSize = Math.ceil(PARTICLE_SIZE * 2 * window.devicePixelRatio) + 2
    const dotCanvas = document.createElement('canvas')
    dotCanvas.width = dotSize
    dotCanvas.height = dotSize
    const dotCtx = dotCanvas.getContext('2d')!
    dotCtx.fillStyle = PARTICLE_COLOR
    dotCtx.beginPath()
    dotCtx.arc(dotSize / 2, dotSize / 2, PARTICLE_SIZE * window.devicePixelRatio, 0, Math.PI * 2)
    dotCtx.fill()

    const onMouseMove = (e: MouseEvent) => {
      mouseTargetRef.current.x = (e.clientX / window.innerWidth) * 100
      mouseTargetRef.current.y = (e.clientY / window.innerHeight) * 100

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
      mouseTargetRef.current.x = 50
      mouseTargetRef.current.y = 50
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    const outerRadius = INNER_RADIUS + THICKNESS
    const halfThick = THICKNESS / 2
    let tick = 0

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      if (!visibleRef.current) return

      tick += ANIMATION_SPEED
      ctx.clearRect(0, 0, width, height)

      // Smooth mouse follow
      const ms = mouseSmoothRef.current
      const mt = mouseTargetRef.current
      ms.x += (mt.x - ms.x) * MOUSE_EASE
      ms.y += (mt.y - ms.y) * MOUSE_EASE

      // Ring center in pixels
      const cx = (width * ms.x) / 100
      const cy = (height * ms.y) / 100

      const t = tick * Math.PI * 2
      const isRainbow = easterEggRef.current

      ctx.fillStyle = PARTICLE_COLOR

      for (let r = 0; r < NUM_ROWS; r++) {
        const rowProgress = NUM_ROWS > 1 ? r / (NUM_ROWS - 1) : 0
        const currentBaseRadius = INNER_RADIUS + (rowProgress * THICKNESS)

        // Fix #1: particle count proportional to circumference
        const circumferenceRatio = currentBaseRadius / INNER_RADIUS
        const actualNumParticles = Math.max(8, Math.floor(NUM_PARTICLES * circumferenceRatio))

        for (let i = 0; i < actualNumParticles; i++) {
          const angle = (i / actualNumParticles) * Math.PI * 2

          // --- Wave physics ---
          const w1 = Math.sin(angle * W1_FREQ + t * W1_SPEED * W1_DIR)
          const w2 = Math.sin(angle * W2_FREQ + t * W2_SPEED * W2_DIR)
          // Fix #2: use normalized rowProgress [0,1] instead of raw index
          const rowOffset = Math.sin(rowProgress * ROW_TWIST * Math.PI * 2 + t)
          const waveHeight = w1 + w2 + rowOffset

          // Depth alpha from wave height
          let normalized = (waveHeight + 3) / 6
          normalized = Math.pow(Math.max(0, normalized), 1.5)
          let alpha = MIN_ALPHA + (normalized * (MAX_ALPHA - MIN_ALPHA))

          // Position
          const distortion = waveHeight * AMPLITUDE
          const finalRadius = currentBaseRadius + distortion
          const x = cx + Math.cos(angle) * finalRadius
          const y = cy + Math.sin(angle) * finalRadius

          // Edge fade — particles near inner/outer edge fade out
          const distFromInner = finalRadius - INNER_RADIUS
          const distFromOuter = outerRadius - finalRadius
          let visibility = Math.min(distFromInner, distFromOuter) / halfThick
          if (visibility < 0) visibility = 0
          if (visibility > 1) visibility = 1
          // Simple ease-in for edge fade
          visibility = visibility * visibility
          alpha *= visibility

          if (alpha < 0.01) continue

          // Skip off-screen
          if (x < -5 || x > width + 5 || y < -5 || y > height + 5) continue

          ctx.globalAlpha = alpha

          if (isRainbow) {
            const hue = (tick * 200 + r * 15 + i * 4) % 360
            ctx.fillStyle = `hsl(${hue}, 80%, 60%)`
            ctx.beginPath()
            ctx.arc(x, y, PARTICLE_SIZE, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = PARTICLE_COLOR
          } else {
            // Use cached dot image instead of arc() — much faster
            ctx.drawImage(dotCanvas, x - PARTICLE_SIZE, y - PARTICLE_SIZE, PARTICLE_SIZE * 2, PARTICLE_SIZE * 2)
          }
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
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Konami code + easter egg
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
      style={{ background: '#0A0A0A' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" role="presentation" aria-hidden="true" />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, #0A0A0A 100%)' }}
      />

      <div ref={textRef} className="relative z-10 max-w-[900px] px-6">
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
          <span className="text-accent-cyan">6M+</span> Users · <span className="text-accent-cyan">85%</span> Revenue Impact · <span className="text-accent-cyan">5x</span> Faster with AI
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL ↓</span>
      </div>
    </section>
  )
}
