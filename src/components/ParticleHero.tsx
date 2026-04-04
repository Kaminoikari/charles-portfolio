import { useEffect, useRef } from 'react'

// --- Ring particle config ---
const INNER_RADIUS = 120
const THICKNESS = 450
const NUM_PARTICLES = 40
const NUM_ROWS = 15
const PARTICLE_SIZE = 1.5
const MIN_ALPHA = 0.05
const MAX_ALPHA = 1.0
const PARTICLE_COLOR = 'rgba(180, 190, 210, 1)'
const ANIMATION_SPEED = 0.003
const MOUSE_EASE = 0.015
const W1_FREQ = 4
const W1_SPEED = 1.5
const W1_DIR = 1
const W2_FREQ = 6
const W2_SPEED = 1
const W2_DIR = -1
const ROW_TWIST = 1.5
const AMPLITUDE = 14

const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']
const EASTER_EGG_DURATION_MS = 5000
const PHOTO_SAMPLE_SIZE = 300 // higher resolution for better detail

interface ParticleData {
  row: number
  index: number
  rowProgress: number
  angle: number
  // Photo target (normalized 0-1, mapped to screen at runtime)
  photoX: number
  photoY: number
  hasPhotoTarget: boolean
}


export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const textOffsetRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  const easterEggRef = useRef(false)
  const easterEggProgressRef = useRef(0) // 0 = ring, 1 = photo
  const konamiIndexRef = useRef(0)

  const mouseTargetRef = useRef({ x: 50, y: 50 })
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

    // Build particle list with pre-computed properties
    const particles: ParticleData[] = []
    for (let r = 0; r < NUM_ROWS; r++) {
      const rowProgress = NUM_ROWS > 1 ? r / (NUM_ROWS - 1) : 0
      const currentBaseRadius = INNER_RADIUS + (rowProgress * THICKNESS)
      const circumferenceRatio = currentBaseRadius / INNER_RADIUS
      const actualNumParticles = Math.max(8, Math.floor(NUM_PARTICLES * circumferenceRatio))

      for (let i = 0; i < actualNumParticles; i++) {
        particles.push({
          row: r,
          index: i,
          rowProgress,
          angle: (i / actualNumParticles) * Math.PI * 2,
          photoX: 0,
          photoY: 0,
          hasPhotoTarget: false,
        })
      }
    }

    // Load photo targets async
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/assets/charles-profile.jpg'
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

      // Get brightness at pixel
      const getBrightness = (px: number, py: number) => {
        const idx = (py * PHOTO_SAMPLE_SIZE + px) * 4
        return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3
      }

      // Collect pixels using edge detection + brightness weighting
      // Edge pixels define the silhouette; bright pixels fill the face
      const pool: Array<{ x: number; y: number; weight: number }> = []

      for (let py = 1; py < PHOTO_SAMPLE_SIZE - 1; py += 1) {
        for (let px = 1; px < PHOTO_SAMPLE_SIZE - 1; px += 1) {
          const b = getBrightness(px, py)
          // Edge detection: difference from neighbors
          const edge = Math.abs(b - getBrightness(px - 1, py))
            + Math.abs(b - getBrightness(px + 1, py))
            + Math.abs(b - getBrightness(px, py - 1))
            + Math.abs(b - getBrightness(px, py + 1))

          // Include pixel if it's an edge OR reasonably bright
          const isEdge = edge > 40
          const isBright = b > 80

          if (isEdge || isBright) {
            // Weight: edges get higher priority, then by brightness
            const weight = (isEdge ? 3 : 0) + (b / 255)
            pool.push({ x: px / PHOTO_SAMPLE_SIZE, y: py / PHOTO_SAMPLE_SIZE, weight })
          }
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

    // Click ripple
    interface Ripple { x: number; y: number; radius: number; strength: number }
    const ripples: Ripple[] = []
    const onClick = (e: MouseEvent) => {
      ripples.push({ x: e.clientX, y: e.clientY, radius: 0, strength: 1 })
    }
    section.addEventListener('click', onClick)

    const outerRadius = INNER_RADIUS + THICKNESS
    const halfThick = THICKNESS / 2
    let tick = 0

    // Photo display area (centered, 300x300)
    const PHOTO_DISPLAY_SIZE = Math.min(350, height * 0.5) // responsive, up to 350px

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      if (!visibleRef.current) return

      tick += ANIMATION_SPEED
      ctx.clearRect(0, 0, width, height)

      const ms = mouseSmoothRef.current
      const mt = mouseTargetRef.current
      ms.x += (mt.x - ms.x) * MOUSE_EASE
      ms.y += (mt.y - ms.y) * MOUSE_EASE

      const ringCX = (width * ms.x) / 100
      const ringCY = (height * ms.y) / 100
      const t = tick * Math.PI * 2
      const isEasterEgg = easterEggRef.current

      // Easter egg progress: ease toward 1 when active, 0 when not
      const targetProgress = isEasterEgg ? 1 : 0
      easterEggProgressRef.current += (targetProgress - easterEggProgressRef.current) * 0.04
      const eggProgress = easterEggProgressRef.current

      // Update ripples
      for (let ri = ripples.length - 1; ri >= 0; ri--) {
        const rip = ripples[ri]
        rip.radius += 4
        rip.strength *= 0.97
        if (rip.radius > 400 || rip.strength < 0.01) ripples.splice(ri, 1)
      }

      // Photo target center
      const photoCX = width / 2 - PHOTO_DISPLAY_SIZE / 2
      const photoCY = height / 2 - PHOTO_DISPLAY_SIZE / 2

      ctx.fillStyle = PARTICLE_COLOR

      for (const p of particles) {
        const currentBaseRadius = INNER_RADIUS + (p.rowProgress * THICKNESS)

        // Ring position
        const w1 = Math.sin(p.angle * W1_FREQ + t * W1_SPEED * W1_DIR)
        const w2 = Math.sin(p.angle * W2_FREQ + t * W2_SPEED * W2_DIR)
        const rowOffset = Math.sin(p.rowProgress * ROW_TWIST * Math.PI * 2 + t)
        const waveHeight = w1 + w2 + rowOffset

        let normalized = (waveHeight + 3) / 6
        normalized = Math.pow(Math.max(0, normalized), 1.5)
        let alpha = MIN_ALPHA + (normalized * (MAX_ALPHA - MIN_ALPHA))

        const distortion = waveHeight * AMPLITUDE
        const finalRadius = currentBaseRadius + distortion
        let ringX = ringCX + Math.cos(p.angle) * finalRadius
        let ringY = ringCY + Math.sin(p.angle) * finalRadius

        // Edge fade
        const distFromInner = finalRadius - INNER_RADIUS
        const distFromOuter = outerRadius - finalRadius
        let visibility = Math.min(distFromInner, distFromOuter) / halfThick
        if (visibility < 0) visibility = 0
        if (visibility > 1) visibility = 1
        visibility = visibility * visibility
        alpha *= visibility

        // Photo position
        const photoX = p.hasPhotoTarget ? photoCX + p.photoX * PHOTO_DISPLAY_SIZE : ringX
        const photoY = p.hasPhotoTarget ? photoCY + p.photoY * PHOTO_DISPLAY_SIZE : ringY

        // Lerp between ring and photo based on easter egg progress
        let x = ringX + (photoX - ringX) * eggProgress
        let y = ringY + (photoY - ringY) * eggProgress

        // During easter egg, all particles fully visible
        if (eggProgress > 0.1) {
          alpha = Math.max(alpha, eggProgress * 0.8)
        }

        // Ripple displacement
        for (const rip of ripples) {
          const rdx = x - rip.x
          const rdy = y - rip.y
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
          const ringDist = Math.abs(rdist - rip.radius)
          if (ringDist < 60 && rdist > 0) {
            const push = (1 - ringDist / 60) * rip.strength * 30
            x += (rdx / rdist) * push
            y += (rdy / rdist) * push
          }
        }

        if (alpha < 0.01) continue
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue

        ctx.globalAlpha = alpha

        if (isEasterEgg && eggProgress > 0.5) {
          // Rainbow during photo formation
          const hue = (tick * 200 + p.row * 15 + p.index * 4) % 360
          ctx.fillStyle = `hsl(${hue}, 80%, 65%)`
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
      section.removeEventListener('click', onClick)
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
