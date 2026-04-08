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
  // Blue-purple quantum palette
  const colorRand = Math.random()
  let color: string
  let glowColor: string
  if (colorRand < 0.5) {
    color = '#6BA3D6' // light blue
    glowColor = 'rgba(107,163,214,0.5)'
  } else if (colorRand < 0.8) {
    color = '#4E8FD4' // medium blue
    glowColor = 'rgba(78,143,212,0.5)'
  } else {
    color = '#8B9FD6' // blue-purple
    glowColor = 'rgba(139,159,214,0.4)'
  }

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * (isHub ? 0.15 : 0.35),
    vy: (Math.random() - 0.5) * (isHub ? 0.15 : 0.35),
    size: isHub ? 3 + Math.random() * 2 : 1.5 + Math.random() * 1.5,
    opacity: 0,
    maxOpacity: isHub ? 0.8 + Math.random() * 0.2 : 0.4 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    speed: 0.005 + Math.random() * 0.015,
    color,
    glowColor,
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
    const FIREFLY_COUNT = 80 // dense node network
const HUB_COUNT = 10 // bright hub nodes

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

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // IntersectionObserver — pause when off-screen
    let visible = false
    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { threshold: 0.05 },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)

    // Reusable containers for spatial grid — avoid GC pressure from per-frame allocation
    const grid = new Map<string, number[]>()
    const checked = new Set<string>()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!visible) return

      ctx.clearRect(0, 0, width, height)

      // Update positions (skip if reduced motion)
      if (!prefersReduced) {
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
      }

      // Draw quantum neural network connections — spatial grid for O(n) performance
      const CONNECTION_DIST = 250
      const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST
      const time = Date.now() * 0.001

      // Build spatial grid — reuse containers to avoid GC pressure
      grid.clear()
      for (let i = 0; i < fireflies.length; i++) {
        const col = Math.floor(fireflies[i].x / CONNECTION_DIST)
        const row = Math.floor(fireflies[i].y / CONNECTION_DIST)
        const key = `${col},${row}`
        const cell = grid.get(key)
        if (cell) cell.push(i); else grid.set(key, [i])
      }

      // Check only adjacent cells
      checked.clear()
      for (const [key, cell] of grid) {
        const [col, row] = key.split(',').map(Number)
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            const neighborKey = `${col + dc},${row + dr}`
            const neighbor = grid.get(neighborKey)
            if (!neighbor) continue
            const pairKey = key < neighborKey ? `${key}|${neighborKey}` : `${neighborKey}|${key}`
            if (key !== neighborKey && checked.has(pairKey)) continue
            checked.add(pairKey)

            for (const i of cell) {
              const startJ = key === neighborKey ? cell.indexOf(i) + 1 : 0
              const list = key === neighborKey ? cell : neighbor
              for (let jIdx = startJ; jIdx < list.length; jIdx++) {
                const j = list[jIdx]
                if (j <= i && key !== neighborKey) continue
                const fi = fireflies[i]
                const fj = fireflies[j]
                const dx = fi.x - fj.x
                const dy = fi.y - fj.y
                const distSq = dx * dx + dy * dy
                if (distSq > CONNECTION_DIST_SQ) continue

                const proximity = 1 - distSq / CONNECTION_DIST_SQ
                const alpha = proximity * proximity * 0.3
                const pulse = 0.7 + 0.3 * Math.sin(time * 2 + i * 0.5 + j * 0.3)
                ctx.globalAlpha = alpha * pulse
                ctx.strokeStyle = 'rgba(100,150,220,0.7)'
                ctx.lineWidth = proximity > 0.5 ? 0.8 : 0.35
                ctx.beginPath()
                ctx.moveTo(fi.x, fi.y)
                ctx.lineTo(fj.x, fj.y)
                ctx.stroke()
              }
            }
          }
        }
      }

      // Draw nodes — simple bright dots, no glow
      for (const f of fireflies) {
        ctx.globalAlpha = f.opacity
        ctx.fillStyle = f.color
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
      className="relative flex min-h-[90vh] items-center overflow-hidden"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" role="presentation" aria-hidden="true" />
      {/* Bottom gradient fade — smooth blend into Universe section */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-32"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)' }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center gap-8 px-6 md:flex-row md:gap-16 md:px-12">
        <div
          ref={photoRef}
          className="reveal h-[200px] w-[200px] shrink-0 overflow-hidden rounded-full border border-border-dark opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
        >
          <img
            src="/assets/charles-profile.jpg"
            alt="Charles Chen"
            loading="lazy"
            className="h-full w-full object-cover object-top"
            style={{ objectPosition: '50% 15%' }}
          />
        </div>
        <div ref={textRef} className="reveal opacity-0 translate-x-8 [&.animate-in]:opacity-100 [&.animate-in]:translate-x-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 [&.animate-in]:delay-150">
          <h2 className="sr-only">About</h2>
          <p className="text-lg leading-relaxed text-text-muted md:text-xl">
            Charles is a product leader with 5+ years of experience building and scaling consumer and SaaS products across enterprise and startup environments. Proven track record of launching products from 0→1, driving user growth to millions, and delivering measurable business impact in both B2C and B2B contexts. Passionate about AI-driven product development, gamification, and disruptive innovation.
          </p>
        </div>
      </div>
    </section>
  )
}
