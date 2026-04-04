import { useEffect, useRef } from 'react'

interface Firefly {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  maxOpacity: number
  phase: number
  speed: number
  color: string
  glowColor: string
}

function createFirefly(width: number, height: number, isHub = false): Firefly {
  const isCyan = isHub ? true : Math.random() > 0.55
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * (isHub ? 0.2 : 0.4),
    vy: (Math.random() - 0.5) * (isHub ? 0.2 : 0.4),
    size: isHub ? 3 + Math.random() * 2 : 1.2 + Math.random() * 1.3,
    opacity: 0,
    maxOpacity: isHub ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    speed: 0.005 + Math.random() * 0.015,
    color: isCyan ? '#00D9FF' : '#ffffff',
    glowColor: isCyan ? 'rgba(0,217,255,0.4)' : 'rgba(255,255,255,0.3)',
  }
}

export default function AboutFirefly() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = 0
    let height = 0
    const fireflies: Firefly[] = []
    const FIREFLY_COUNT = 45 // more nodes for denser network
const HUB_COUNT = 6 // large hub nodes

    const resize = () => {
      width = canvas.parentElement?.clientWidth ?? window.innerWidth
      height = canvas.parentElement?.clientHeight ?? window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    // Hub nodes — large, bright, slow-moving anchor points
    for (let i = 0; i < HUB_COUNT; i++) {
      fireflies.push(createFirefly(width, height, true))
    }
    // Regular nodes
    for (let i = 0; i < FIREFLY_COUNT - HUB_COUNT; i++) {
      fireflies.push(createFirefly(width, height, false))
    }

    // IntersectionObserver — pause when off-screen
    let visible = false
    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { threshold: 0.05 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!visible) return

      ctx.clearRect(0, 0, width, height)

      // Update positions
      for (const f of fireflies) {
        f.phase += f.speed
        f.opacity = f.maxOpacity * (0.3 + 0.7 * Math.abs(Math.sin(f.phase)))

        f.x += f.vx
        f.y += f.vy

        if (f.x < -10) f.x = width + 10
        if (f.x > width + 10) f.x = -10
        if (f.y < -10) f.y = height + 10
        if (f.y > height + 10) f.y = -10
      }

      // Draw quantum neural network connections
      const CONNECTION_DIST = 160
      const time = Date.now() * 0.001
      for (let i = 0; i < fireflies.length; i++) {
        for (let j = i + 1; j < fireflies.length; j++) {
          const fi = fireflies[i]
          const fj = fireflies[j]
          const dx = fi.x - fj.x
          const dy = fi.y - fj.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const proximity = 1 - dist / CONNECTION_DIST
            // Pulsing signal — alpha oscillates per connection
            const pulse = 0.5 + 0.5 * Math.sin(time * 2 + i * 0.7 + j * 0.3)
            const alpha = proximity * pulse * 0.2

            // Gradient line: cyan signal flowing from node i to node j
            const grad = ctx.createLinearGradient(fi.x, fi.y, fj.x, fj.y)
            const signalPos = (Math.sin(time * 3 + i + j) * 0.5 + 0.5) // 0-1 oscillating position
            const cyanAlpha = alpha * 1.5

            grad.addColorStop(Math.max(0, signalPos - 0.15), `rgba(255,255,255,${alpha})`)
            grad.addColorStop(signalPos, `rgba(0,217,255,${cyanAlpha})`)
            grad.addColorStop(Math.min(1, signalPos + 0.15), `rgba(255,255,255,${alpha})`)

            ctx.globalAlpha = 1
            ctx.strokeStyle = grad
            ctx.lineWidth = proximity > 0.6 ? 0.8 : 0.4
            ctx.beginPath()
            ctx.moveTo(fi.x, fi.y)
            ctx.lineTo(fj.x, fj.y)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      for (const f of fireflies) {
        // Outer glow
        ctx.globalAlpha = f.opacity * 0.2
        ctx.fillStyle = f.color
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size * 3, 0, Math.PI * 2)
        ctx.fill()
        // Inner core
        ctx.globalAlpha = f.opacity
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    if (!sectionRef.current) return
    const elements = sectionRef.current.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 },
    )
    elements.forEach((el) => observer.observe(el))
    const safety = setTimeout(() => elements.forEach((el) => el.classList.add('animate-in')), 2000)
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [])

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative flex min-h-[80vh] items-center overflow-hidden"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 px-6 md:flex-row md:gap-16 md:px-12">
        <div
          ref={photoRef}
          className="reveal h-[200px] w-[200px] shrink-0 overflow-hidden rounded-full border border-border-dark opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
        >
          <img
            src="/assets/charles-profile.jpg"
            alt="Charles Chen"
            className="h-full w-full object-cover object-top"
            style={{ objectPosition: '50% 15%' }}
          />
        </div>
        <div ref={textRef} className="reveal opacity-0 translate-x-8 [&.animate-in]:opacity-100 [&.animate-in]:translate-x-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 [&.animate-in]:delay-150">
          <h2 className="mb-6 text-[40px] font-semibold">About Me</h2>
          <p className="text-base leading-relaxed text-text-muted">
            Charles is a product leader with 5+ years of experience building and scaling consumer and SaaS products across enterprise and startup environments. Proven track record of launching products from 0→1, driving user growth to millions, and delivering measurable business impact in both B2C and B2B contexts. Passionate about AI-driven product development, gamification, and disruptive innovation.
          </p>
        </div>
      </div>
    </section>
  )
}
