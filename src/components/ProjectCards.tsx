import { useEffect, useRef, useState } from 'react'
import type { Project } from '../data/projects'
import { projects } from '../data/projects'
import { CANVAS_W, CANVAS_H, easeInOutCubic, marsA, whiteA } from './animations/shared'
import {
  ROUTE_POINTS, COMET_TRAIL_LENGTH,
  getEasedRoutePosition, strokeBezierSegment, strokePartialBezier,
  drawRoutePath, drawPins, drawItineraryCard,
} from './animations/pathAnimation'
import {
  type Candle,
  CANDLE_BASE_Y, CANDLE_SPACING, CANDLE_START_X,
  TRADE_DAY_DURATION, CLOSING_DURATION, RESET_DURATION, SURGE_INTERVAL,
  generateCandle, resetCandles, drawCandle, drawTrendLine,
} from './animations/plutusAnimation'
import {
  type PbMetrics,
  PB_ENTRANCE_DURATION, PB_SECTION_FILL_DURATION, PB_PAUSE_DURATION, PB_FADE_DURATION,
  computePbMetrics, drawPlaybookStatic, drawPlaybookAnimated,
} from './animations/playbookAnimation'

const CTA_FONT_FAMILY = 'var(--font-mono)'

// ─── Canvas Illustration Component ───

function CanvasIllustration({ id, isHovered }: { id: string; isHovered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pbMetricsRef = useRef<PbMetrics | null>(null)
  const stateRef = useRef<{
    // Path state
    pathT: number
    ripples: { x: number; y: number; r: number; opacity: number; speed: number }[]
    arrivedPins: Set<number>
    cometTrail: { x: number; y: number }[]
    cardTimers: number[]
    pauseTimer: number
    fadeOutTimer: number
    // Plutus state
    candles: Candle[]
    scrollOffset: number
    priceFlash: number
    tickTimer: number
    tradeDayTimer: number
    tradeDayPhase: 'trading' | 'closing' | 'reset'
    surgeTimer: number
    tradeFadeAlpha: number
    // Playbook state
    pbProgress: number
    pbPhase: 'entrance' | 'building' | 'pause' | 'fadeOut'
    pbEntranceTimer: number
    pbPauseTimer: number
    pbFadeTimer: number
    pbTime: number
  }>({
    pathT: 0,
    ripples: [],
    arrivedPins: new Set<number>(),
    cometTrail: [],
    cardTimers: [0, 0, 0],
    pauseTimer: 0,
    fadeOutTimer: 0,
    candles: resetCandles(),
    scrollOffset: 0,
    priceFlash: 0,
    tickTimer: 0,
    tradeDayTimer: 0,
    tradeDayPhase: 'trading',
    surgeTimer: SURGE_INTERVAL,
    tradeFadeAlpha: 1,
    pbProgress: 0,
    pbPhase: 'entrance',
    pbEntranceTimer: 0,
    pbPauseTimer: 0,
    pbFadeTimer: 0,
    pbTime: 0,
  })

  const prefersReduced = useRef(false)

  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Compute Playbook badge metrics once, cache in ref across re-renders
    if (id === 'product-playbook' && !pbMetricsRef.current) {
      pbMetricsRef.current = computePbMetrics(ctx)
    }
    const pbMetrics = pbMetricsRef.current ?? []

    const drawStatic = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      if (id === 'path') {
        drawItineraryCard(ctx, [0, 0, 0], 1)
        drawRoutePath(ctx)
        drawPins(ctx, undefined)
      } else if (id === 'plutus-trade') {
        const s = stateRef.current
        s.candles.forEach((c, i) => {
          const x = CANDLE_START_X + i * CANDLE_SPACING + c.offsetX
          if (x > -20 && x < CANVAS_W + 20) {
            drawCandle(ctx, x, c, 0.5)
          }
        })
        drawTrendLine(ctx, s.candles, CANDLE_START_X, CANDLE_SPACING, 0.5)
      } else if (id === 'product-playbook') {
        drawPlaybookStatic(ctx, pbMetrics)
      }
    }

    if (!isHovered || prefersReduced.current) {
      cancelAnimationFrame(animRef.current)
      drawStatic()
      return
    }

    // Animated loop
    let lastTime = 0
    const animate = (time: number) => {
      const dt = lastTime ? (time - lastTime) / 1000 : 0.016
      lastTime = time
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const s = stateRef.current

      if (id === 'path') {
        const CHECK_ANIM_DURATION = 0.8
        const FADE_OUT_DURATION = 0.5

        // Phase management: travel → pause → fadeOut → reset
        if (s.fadeOutTimer > 0) {
          s.fadeOutTimer -= dt
          if (s.fadeOutTimer <= 0) {
            s.fadeOutTimer = 0
            s.pathT = 0
            s.arrivedPins.clear()
            s.cometTrail = []
            s.cardTimers = [0, 0, 0]
            s.ripples = []
          }
        } else if (s.pauseTimer > 0) {
          s.pauseTimer -= dt
          if (s.pauseTimer <= 0) {
            s.pauseTimer = 0
            s.fadeOutTimer = FADE_OUT_DURATION
          }
        }

        const isTraveling = s.pauseTimer <= 0 && s.fadeOutTimer <= 0
        if (isTraveling) {
          s.pathT = (s.pathT + dt * 0.22) % 1
        }

        const fadeAlpha = s.fadeOutTimer > 0 ? s.fadeOutTimer / FADE_OUT_DURATION : 1

        const isPaused = s.pauseTimer > 0 || s.fadeOutTimer > 0
        const pos = getEasedRoutePosition(isPaused ? 0.999 : s.pathT)
        const segIndex = isPaused ? ROUTE_POINTS.length - 2 : Math.floor(s.pathT * (ROUTE_POINTS.length - 1))

        if (isTraveling && segIndex === 0 && s.arrivedPins.size > 0) {
          s.arrivedPins.clear()
          s.cometTrail = []
          s.cardTimers = [0, 0, 0]
        }

        s.arrivedPins.add(0)

        for (let i = 0; i < s.cardTimers.length; i++) {
          const pinIndex = i + 1
          if (s.arrivedPins.has(pinIndex) && s.cardTimers[i] < 1) {
            s.cardTimers[i] = Math.min(1, s.cardTimers[i] + dt / CHECK_ANIM_DURATION)
          }
        }

        if (isTraveling) {
          s.cometTrail.push({ x: pos.x, y: pos.y })
          if (s.cometTrail.length > COMET_TRAIL_LENGTH) {
            s.cometTrail.shift()
          }
        } else if (s.cometTrail.length > 0 && s.fadeOutTimer > 0) {
          s.cometTrail.shift()
        }

        // Layer 1: Cards
        drawItineraryCard(ctx, s.cardTimers, fadeAlpha)

        // Layer 2: Static dashed route
        ctx.globalAlpha = fadeAlpha
        ctx.strokeStyle = whiteA(0.15)
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        for (let i = 0; i < ROUTE_POINTS.length - 1; i++) {
          strokeBezierSegment(ctx, i)
        }
        ctx.setLineDash([])

        // Layer 3: Warm trail
        const warmSeg = segIndex
        const warmLocalT = easeInOutCubic(s.pathT * (ROUTE_POINTS.length - 1) - segIndex)

        ctx.globalAlpha = 0.6 * fadeAlpha
        ctx.strokeStyle = marsA(1)
        ctx.lineWidth = 2
        ctx.setLineDash([])
        for (let i = 0; i < warmSeg; i++) {
          strokeBezierSegment(ctx, i)
        }
        if (warmLocalT > 0) {
          strokePartialBezier(ctx, warmSeg, 0, warmLocalT)
        }

        // Layer 4: Comet trail
        const trail = s.cometTrail
        for (let i = 0; i < trail.length - 1; i++) {
          const t = i / trail.length
          const width = 1 + t * 3
          const alpha = t * 0.5 * fadeAlpha
          ctx.strokeStyle = marsA(alpha)
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.moveTo(trail[i].x, trail[i].y)
          ctx.lineTo(trail[i + 1].x, trail[i + 1].y)
          ctx.stroke()
        }

        // Layer 5: Light point glow
        if (s.fadeOutTimer <= 0) {
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 28)
          glow.addColorStop(0, marsA(0.9))
          glow.addColorStop(0.2, marsA(0.4))
          glow.addColorStop(0.5, marsA(0.1))
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = whiteA(0.95)
          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }

        // Layer 6: Arrival ripples
        ROUTE_POINTS.forEach((p, i) => {
          if (i > 0 && i <= segIndex && !s.arrivedPins.has(i)) {
            s.arrivedPins.add(i)
            s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 1, speed: 60 })
            s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 0.7, speed: 30 })
          }
        })
        const lastPin = ROUTE_POINTS.length - 1
        const lastSegLocalT = s.pathT * (ROUTE_POINTS.length - 1) - segIndex
        if (segIndex === lastPin - 1 && lastSegLocalT > 0.9 && !s.arrivedPins.has(lastPin)) {
          const p = ROUTE_POINTS[lastPin]
          s.arrivedPins.add(lastPin)
          s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 1, speed: 60 })
          s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 0.7, speed: 30 })
          s.pauseTimer = 2
        }

        ctx.globalAlpha = fadeAlpha
        drawPins(ctx, s.arrivedPins)

        ctx.globalAlpha = 1
        s.ripples = s.ripples.filter((rp) => {
          rp.r += dt * rp.speed
          rp.opacity -= dt * (rp.speed > 40 ? 1.0 : 0.5)
          if (rp.opacity <= 0) return false
          ctx.strokeStyle = marsA(rp.opacity * 0.7 * fadeAlpha)
          ctx.lineWidth = rp.speed > 40 ? 1.5 : 1
          ctx.beginPath()
          ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
          ctx.stroke()
          return true
        })
        ctx.globalAlpha = 1
      } else if (id === 'plutus-trade') {
        // ── Trade day lifecycle ──
        s.tradeDayTimer += dt

        if (s.tradeDayPhase === 'trading') {
          const scrollSpeed = 30
          s.scrollOffset += dt * scrollSpeed
          s.tickTimer += dt
          s.surgeTimer -= dt

          if (s.tickTimer > 1.3) {
            s.tickTimer = 0
            const isSurge = s.surgeTimer <= 0
            s.candles.push(generateCandle(isSurge))
            if (isSurge) s.surgeTimer = SURGE_INTERVAL
          }

          if (s.tradeDayTimer > TRADE_DAY_DURATION) {
            s.tradeDayPhase = 'closing'
            s.tradeDayTimer = 0
          }
        } else if (s.tradeDayPhase === 'closing') {
          const progress = s.tradeDayTimer / CLOSING_DURATION
          const scrollSpeed = 30 * (1 - progress)
          s.scrollOffset += dt * Math.max(0, scrollSpeed)

          if (s.tradeDayTimer > CLOSING_DURATION) {
            s.tradeDayPhase = 'reset'
            s.tradeDayTimer = 0
          }
        } else if (s.tradeDayPhase === 'reset') {
          s.tradeFadeAlpha = 1 - s.tradeDayTimer / RESET_DURATION

          if (s.tradeDayTimer > RESET_DURATION) {
            s.candles = resetCandles()
            s.scrollOffset = 0
            s.tickTimer = 0
            s.surgeTimer = SURGE_INTERVAL
            s.tradeDayPhase = 'trading'
            s.tradeDayTimer = 0
            s.tradeFadeAlpha = 1
          }
        }

        const fa = Math.max(0, s.tradeFadeAlpha)

        let removeCount = 0
        s.candles.forEach((c, i) => {
          c.offsetX = -s.scrollOffset
          const x = CANDLE_START_X + i * CANDLE_SPACING + c.offsetX

          if (x < 20) {
            c.opacity = Math.max(0, c.opacity - dt * 2)
            if (c.opacity <= 0) removeCount++
          }

          if (x > -20 && x < CANVAS_W + 20 && c.opacity > 0) {
            drawCandle(ctx, x, c, 0.7 * fa)
          }
        })

        if (removeCount > 0) {
          const removed = s.candles.splice(0, removeCount)
          s.scrollOffset -= removed.length * CANDLE_SPACING
          s.candles.forEach((c) => { c.offsetX = -s.scrollOffset })
        }

        const visibleCandles = s.candles.filter((c, i) => {
          const x = CANDLE_START_X + i * CANDLE_SPACING + c.offsetX
          return x > -20 && x < CANVAS_W + 20 && c.opacity > 0
        })
        if (visibleCandles.length > 1) {
          const firstIdx = s.candles.indexOf(visibleCandles[0])
          drawTrendLine(ctx, visibleCandles, CANDLE_START_X + firstIdx * CANDLE_SPACING + visibleCandles[0].offsetX, CANDLE_SPACING, 0.7 * fa)
        }

        if (s.candles.length > 0) {
          const lastCandle = s.candles[s.candles.length - 1]
          const lastX = CANDLE_START_X + (s.candles.length - 1) * CANDLE_SPACING + lastCandle.offsetX
          const lastY = CANDLE_BASE_Y - lastCandle.h + lastCandle.b / 2

          const flashSpeed = s.tradeDayPhase === 'closing' ? 8 : 3
          s.priceFlash += dt * flashSpeed
          const flashAlpha = (0.3 + 0.3 * Math.abs(Math.sin(s.priceFlash))) * fa

          ctx.strokeStyle = whiteA(flashAlpha)
          ctx.lineWidth = 0.8
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.moveTo(lastX + 15, lastY)
          ctx.lineTo(CANVAS_W, lastY)
          ctx.stroke()
          ctx.setLineDash([])

          ctx.fillStyle = whiteA(flashAlpha + 0.1)
          ctx.font = '10px monospace'
          ctx.fillText(`${(100 + lastCandle.h * 0.5).toFixed(0)}`, CANVAS_W - 35, lastY - 5)
        }
      } else if (id === 'product-playbook') {
        // ── Spec assembly lifecycle ──
        s.pbTime += dt

        if (s.pbPhase === 'entrance') {
          s.pbEntranceTimer += dt
          if (s.pbEntranceTimer >= PB_ENTRANCE_DURATION) {
            s.pbPhase = 'building'
            s.pbEntranceTimer = PB_ENTRANCE_DURATION
          }
        } else if (s.pbPhase === 'building') {
          const totalDuration = PB_SECTION_FILL_DURATION * 4
          s.pbProgress = Math.min(1, s.pbProgress + dt / totalDuration)
          if (s.pbProgress >= 1) {
            s.pbPhase = 'pause'
            s.pbPauseTimer = PB_PAUSE_DURATION
          }
        } else if (s.pbPhase === 'pause') {
          s.pbPauseTimer -= dt
          if (s.pbPauseTimer <= 0) {
            s.pbPhase = 'fadeOut'
            s.pbFadeTimer = PB_FADE_DURATION
          }
        } else if (s.pbPhase === 'fadeOut') {
          s.pbFadeTimer -= dt
          if (s.pbFadeTimer <= 0) {
            s.pbProgress = 0
            s.pbPhase = 'entrance'
            s.pbFadeTimer = 0
            s.pbPauseTimer = 0
            s.pbEntranceTimer = 0
          }
        }

        const pbFadeAlpha = s.pbPhase === 'fadeOut'
          ? Math.max(0, s.pbFadeTimer / PB_FADE_DURATION)
          : 1
        const pbEntranceProgress = Math.min(1, s.pbEntranceTimer / PB_ENTRANCE_DURATION)

        drawPlaybookAnimated(ctx, s.pbProgress, pbFadeAlpha, s.pbTime, pbEntranceProgress, pbMetrics)
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [id, isHovered])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none w-full"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      aria-hidden="true"
    />
  )
}

function CornerSquare({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positionStyles: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1 },
    tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 },
    br: { bottom: -1, right: -1 },
  }

  return (
    <div
      className="absolute h-[8px] w-[8px] border border-border-highlight bg-surface-light"
      style={positionStyles[position]}
    />
  )
}

function ProjectCard({ project }: { project: Project }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLAnchorElement>(null)
  const isTouchDevice = useRef(false)

  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(hover: none)').matches
  }, [])

  useEffect(() => {
    if (!cardRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { setIsVisible(entry.isIntersecting) },
      { threshold: 0.3 },
    )
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  const isAnimating = isTouchDevice.current ? isVisible : isHovered

  return (
    <a
      ref={cardRef}
      href={`/projects/${project.id}`}
      aria-label={project.title}
      className="group relative flex min-h-0 flex-col border border-border no-underline transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.01] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] md:min-h-[520px]"
      style={{
        padding: '32px 32px 40px',
        flex: '1 1 0%',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(to bottom, rgba(125,129,135,0.1), transparent)',
        }}
      />

      {/* Hover border glow + corner squares */}
      <div
        className="pointer-events-none absolute inset-0 border border-border-subtle opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
      >
        <CornerSquare position="tl" />
        <CornerSquare position="tr" />
        <CornerSquare position="bl" />
        <CornerSquare position="br" />
      </div>

      {/* Title */}
      <h3
        className="text-white"
        style={{ fontSize: 20, fontWeight: 600, margin: 0 }}
      >
        {project.title}
      </h3>

      {/* Description */}
      <p
        className="text-text-secondary transition-colors duration-300 ease-in-out group-hover:text-white/85"
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          marginTop: 12,
        }}
      >
        {project.description}
      </p>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="font-mono text-[11px] tracking-[1px] text-text-tertiary"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Illustration area */}
      <div className="relative mt-auto flex items-center justify-center pt-8 text-white">
        <CanvasIllustration id={project.id} isHovered={isAnimating} />
      </div>

      {/* CTA button */}
      <div className="mt-6 flex justify-center">
        <div
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 transition-colors duration-300 ease-in-out group-hover:bg-white/[0.08]"
          style={{
            fontFamily: CTA_FONT_FAMILY,
            fontSize: 12,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'white',
          }}
        >
          <span>CASE STUDY</span>
          <span aria-hidden="true" className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5" style={{ fontSize: 13, lineHeight: 1 }}>→</span>
        </div>
      </div>
    </a>
  )
}

export default function ProjectCards() {
  return (
    <section id="projects" className="mx-auto w-full max-w-[1400px] px-6 md:px-12 py-16 sm:py-32">
      <h2 className="mb-2 font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ SIDE PROJECTS ]</h2>

      <div className="mt-12 flex flex-col md:flex-row md:gap-0">
        {projects.map((project, index) => (
          <div
            key={project.id}
            className={`flex flex-1 ${index > 0 ? '-mt-px md:mt-0 md:-ml-px' : ''}`}
          >
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </section>
  )
}
