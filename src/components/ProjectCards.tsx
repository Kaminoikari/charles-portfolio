import { useEffect, useRef, useState } from 'react'
import type { Project } from '../data/projects'
import { projects } from '../data/projects'

const CTA_FONT_FAMILY = 'var(--font-mono)'
const CANVAS_W = 400
const CANVAS_H = 280

// ─── Route: S-curve via quadratic bezier segments ───
const ROUTE_POINTS = [
  { x: 60, y: 240 },
  { x: 140, y: 180 },
  { x: 240, y: 120 },
  { x: 360, y: 40 },
]
/** Control points for each bezier segment to form S-curve */
const ROUTE_CONTROLS = [
  { x: 130, y: 240 },  // Seg 0: starts horizontal, curves up
  { x: 155, y: 105 },  // Seg 1: curves up sharply, then back
  { x: 325, y: 120 },  // Seg 2: starts horizontal, curves up
]

const ACCENT_MARS_RGB = '232,101,43'
const COMET_TRAIL_LENGTH = 14

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Quadratic bezier at t */
function quadBezier(p0: number, cp: number, p1: number, t: number) {
  const inv = 1 - t
  return inv * inv * p0 + 2 * inv * t * cp + t * t * p1
}

/** Ease-in-out per segment — slows near pins, speeds between them */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Get eased position (used for light point movement) */
function getEasedRoutePosition(t: number) {
  const segments = ROUTE_POINTS.length - 1
  const seg = Math.min(Math.floor(t * segments), segments - 1)
  const localT = easeInOutCubic(t * segments - seg)
  const p0 = ROUTE_POINTS[seg]
  const cp = ROUTE_CONTROLS[seg]
  const p1 = ROUTE_POINTS[seg + 1]
  return {
    x: quadBezier(p0.x, cp.x, p1.x, localT),
    y: quadBezier(p0.y, cp.y, p1.y, localT),
  }
}

// ─── Static drawing helpers ───

/** Draw a single bezier segment as a stroked path */
function strokeBezierSegment(ctx: CanvasRenderingContext2D, segIndex: number) {
  const p0 = ROUTE_POINTS[segIndex]
  const cp = ROUTE_CONTROLS[segIndex]
  const p1 = ROUTE_POINTS[segIndex + 1]
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y)
  ctx.stroke()
}

/** Draw partial bezier segment from localT0 to localT1 */
function strokePartialBezier(ctx: CanvasRenderingContext2D, segIndex: number, t0: number, t1: number, steps = 20) {
  const p0 = ROUTE_POINTS[segIndex]
  const cp = ROUTE_CONTROLS[segIndex]
  const p1 = ROUTE_POINTS[segIndex + 1]
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = lerp(t0, t1, i / steps)
    const x = quadBezier(p0.x, cp.x, p1.x, t)
    const y = quadBezier(p0.y, cp.y, p1.y, t)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawRoutePath(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  for (let i = 0; i < ROUTE_POINTS.length - 1; i++) {
    strokeBezierSegment(ctx, i)
  }
  ctx.setLineDash([])
}

function drawPins(ctx: CanvasRenderingContext2D, arrivedSet?: Set<number>) {
  ROUTE_POINTS.forEach((p, i) => {
    const r = i === 0 || i === 3 ? 7 : 5
    const arrived = arrivedSet?.has(i) ?? false

    if (arrived) {
      // Filled warm pin
      ctx.fillStyle = `rgba(${ACCENT_MARS_RGB},0.7)`
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},0.9)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** Itinerary cards — fanned out with rotation, each covers the previous */
const ITINERARY_CARDS = [
  { label: 'Day 1', x: 195, y: 215, angle: 0 },
  { label: 'Day 2', x: 250, y: 175, angle: 0 },
  { label: 'Day 3', x: 305, y: 135, angle: 0 },
]
const CARD_W = 85
const CARD_H = 62

const CARD_LINES = [
  { yOff: 28, wShrink: 14 },
  { yOff: 38, wShrink: 22 },
  { yOff: 48, wShrink: 30 },
]

function drawSingleCard(ctx: CanvasRenderingContext2D, cardDef: typeof ITINERARY_CARDS[number], brightness: number, checkProgress: number) {
  ctx.save()
  ctx.translate(cardDef.x + CARD_W / 2, cardDef.y + CARD_H / 2)
  ctx.rotate((cardDef.angle * Math.PI) / 180)

  const x = -CARD_W / 2
  const y = -CARD_H / 2

  // Background fill — opaque to cover previous cards
  ctx.globalAlpha = 1
  ctx.fillStyle = `rgb(${10 + brightness * 14}, ${10 + brightness * 14}, ${10 + brightness * 14})`
  ctx.beginPath()
  ctx.roundRect(x, y, CARD_W, CARD_H, 4)
  ctx.fill()

  // Border — always visible
  const borderAlpha = 0.5 + brightness * 0.3
  ctx.globalAlpha = borderAlpha
  ctx.strokeStyle = `rgba(255,255,255,${borderAlpha})`
  ctx.lineWidth = brightness > 0.5 ? 1.2 : 1
  ctx.beginPath()
  ctx.roundRect(x, y, CARD_W, CARD_H, 4)
  ctx.stroke()

  // Header bar
  ctx.globalAlpha = 0.2 + brightness * 0.5
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(x, y + 18)
  ctx.lineTo(x + CARD_W, y + 18)
  ctx.stroke()

  // Day label
  ctx.globalAlpha = 0.35 + brightness * 0.6
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 10px monospace'
  ctx.fillText(cardDef.label, x + 8, y + 13)

  // Content lines + progressive checkmarks (top-down, stay checked)
  CARD_LINES.forEach((line, li) => {
    const lineX1 = x + 8
    const lineX2 = x + CARD_W - line.wShrink
    const lineY = y + line.yOff
    const lineThreshold = li / CARD_LINES.length
    const checked = checkProgress > lineThreshold + 1 / CARD_LINES.length
    const checking = checkProgress > lineThreshold && !checked
    const checkT = checking ? (checkProgress - lineThreshold) * CARD_LINES.length : 0

    // Line is always visible
    const lineAlpha = checked || checking ? 0.5 + brightness * 0.3 : 0.12 + brightness * 0.3
    ctx.globalAlpha = lineAlpha
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(lineX1, lineY)
    ctx.lineTo(lineX2, lineY)
    ctx.stroke()

    // Checkmark — fade in when checking, stay visible when checked
    if (checked) {
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},0.9)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(lineX2 + 4, lineY - 4)
      ctx.lineTo(lineX2 + 8, lineY + 1)
      ctx.lineTo(lineX2 + 14, lineY - 6)
      ctx.stroke()
    } else if (checking) {
      const checkAlpha = Math.min(1, checkT * 1.5)
      ctx.globalAlpha = checkAlpha * 0.9
      ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},${checkAlpha * 0.9})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(lineX2 + 4, lineY - 4)
      ctx.lineTo(lineX2 + 8, lineY + 1)
      ctx.lineTo(lineX2 + 14, lineY - 6)
      ctx.stroke()
    }
  })

  ctx.restore()
}

/** Draw itinerary cards — checkmarks animate smoothly after pin arrival */
function drawItineraryCard(ctx: CanvasRenderingContext2D, cardTimers: number[], fadeAlpha: number) {
  ITINERARY_CARDS.forEach((card, i) => {
    // cardTimers[i] goes from 0→1 over CHECK_ANIM_DURATION after pin arrival
    const t = cardTimers[i]
    const brightness = 0.15 + t * 0.85
    const checkProgress = t
    ctx.globalAlpha = fadeAlpha
    drawSingleCard(ctx, card, brightness, checkProgress)
  })
  ctx.globalAlpha = 1
}

// ─── Candle data for Plutus Trade ───
const CANDLE_BASE_Y = 260
const CANDLE_SPACING = 40
const CANDLE_START_X = 50
const TRADE_DAY_DURATION = 8 // seconds of trading before closing
const CLOSING_DURATION = 1.5
const RESET_DURATION = 0.5
const SURGE_INTERVAL = 3.5 // seconds between surge events

const INITIAL_CANDLES = [
  { h: 120, b: 40, up: false }, { h: 80, b: 30, up: true }, { h: 140, b: 50, up: true },
  { h: 60, b: 25, up: false }, { h: 100, b: 35, up: true }, { h: 160, b: 45, up: true },
  { h: 90, b: 30, up: false }, { h: 110, b: 40, up: true },
]

interface Candle {
  h: number
  b: number
  up: boolean
  offsetX: number
  opacity: number
}

function generateCandle(surge = false): Candle {
  const isSurgeUp = Math.random() > 0.5
  return {
    h: surge ? 140 + Math.random() * 60 : 50 + Math.random() * 120,
    b: surge ? 50 + Math.random() * 30 : 20 + Math.random() * 40,
    up: surge ? isSurgeUp : Math.random() > 0.4,
    offsetX: 0,
    opacity: 1,
  }
}

function resetCandles(): Candle[] {
  return INITIAL_CANDLES.map((c) => ({ ...c, offsetX: 0, opacity: 1 }))
}

function drawCandle(ctx: CanvasRenderingContext2D, x: number, candle: Candle, alpha: number) {
  const y = CANDLE_BASE_Y - candle.h
  const bodyY = y + (candle.h - candle.b) / 2
  const a = alpha * candle.opacity

  // Wick
  ctx.globalAlpha = a * 0.5
  ctx.strokeStyle = candle.up ? `rgba(${ACCENT_MARS_RGB},0.7)` : 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + candle.h)
  ctx.stroke()

  // Body
  ctx.globalAlpha = a
  if (candle.up) {
    // Bullish — warm accent
    ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},0.9)`
    ctx.fillStyle = `rgba(${ACCENT_MARS_RGB},${a * 0.25})`
  } else {
    // Bearish — white/cool
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.fillStyle = `rgba(255,255,255,${a * 0.08})`
  }
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x - 10, bodyY, 20, candle.b)
  ctx.stroke()
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawTrendLine(ctx: CanvasRenderingContext2D, candles: Candle[], startX: number, spacing: number, alpha: number) {
  if (candles.length < 2) return
  ctx.globalAlpha = alpha * 0.4
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  candles.forEach((c, i) => {
    const x = startX + i * spacing + c.offsetX
    const y = CANDLE_BASE_Y - c.h + c.b / 2
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

// ─── Canvas Illustration Component ───

function CanvasIllustration({ id, isHovered }: { id: string; isHovered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
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
          // Fade-out phase
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
          // Pause phase — hold at endpoint
          s.pauseTimer -= dt
          if (s.pauseTimer <= 0) {
            s.pauseTimer = 0
            s.fadeOutTimer = FADE_OUT_DURATION
          }
        }

        // Advance light point (only during travel phase)
        const isTraveling = s.pauseTimer <= 0 && s.fadeOutTimer <= 0
        if (isTraveling) {
          s.pathT = (s.pathT + dt * 0.22) % 1
        }

        // Compute fade alpha for fade-out phase
        const fadeAlpha = s.fadeOutTimer > 0 ? s.fadeOutTimer / FADE_OUT_DURATION : 1

        const isPaused = s.pauseTimer > 0 || s.fadeOutTimer > 0
        const pos = getEasedRoutePosition(isPaused ? 0.999 : s.pathT)
        const segIndex = isPaused ? ROUTE_POINTS.length - 2 : Math.floor(s.pathT * (ROUTE_POINTS.length - 1))

        // Reset arrived pins on loop restart
        if (isTraveling && segIndex === 0 && s.arrivedPins.size > 0) {
          s.arrivedPins.clear()
          s.cometTrail = []
          s.cardTimers = [0, 0, 0]
        }

        // Mark start pin as arrived
        s.arrivedPins.add(0)

        // Advance card check timers (smooth 0→1 over CHECK_ANIM_DURATION)
        for (let i = 0; i < s.cardTimers.length; i++) {
          const pinIndex = i + 1
          if (s.arrivedPins.has(pinIndex) && s.cardTimers[i] < 1) {
            s.cardTimers[i] = Math.min(1, s.cardTimers[i] + dt / CHECK_ANIM_DURATION)
          }
        }

        // Comet trail — only push during travel, fade during pause
        if (isTraveling) {
          s.cometTrail.push({ x: pos.x, y: pos.y })
          if (s.cometTrail.length > COMET_TRAIL_LENGTH) {
            s.cometTrail.shift()
          }
        } else if (s.cometTrail.length > 0 && s.fadeOutTimer > 0) {
          // During fade-out, shrink trail
          s.cometTrail.shift()
        }

        // Layer 1: Cards (behind everything)
        drawItineraryCard(ctx, s.cardTimers, fadeAlpha)

        // Layer 2: Full route as STATIC dashed lines
        ctx.globalAlpha = fadeAlpha
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
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
        ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},1)`
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
          ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},${alpha})`
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.moveTo(trail[i].x, trail[i].y)
          ctx.lineTo(trail[i + 1].x, trail[i + 1].y)
          ctx.stroke()
        }

        // Layer 5: Light point glow (hide during fade-out)
        if (s.fadeOutTimer <= 0) {
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 28)
          glow.addColorStop(0, `rgba(${ACCENT_MARS_RGB},0.9)`)
          glow.addColorStop(0.2, `rgba(${ACCENT_MARS_RGB},0.4)`)
          glow.addColorStop(0.5, `rgba(${ACCENT_MARS_RGB},0.1)`)
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.globalAlpha = fadeAlpha
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }

        // Layer 6: Trigger arrival ripples + mark arrived
        ROUTE_POINTS.forEach((p, i) => {
          if (i > 0 && i <= segIndex && !s.arrivedPins.has(i)) {
            s.arrivedPins.add(i)
            s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 1, speed: 60 })
            s.ripples.push({ x: p.x, y: p.y, r: 0, opacity: 0.7, speed: 30 })
          }
        })
        // Last pin — trigger when near end of final segment, then pause
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

        // Animate ripples
        ctx.globalAlpha = 1
        s.ripples = s.ripples.filter((rp) => {
          rp.r += dt * rp.speed
          rp.opacity -= dt * (rp.speed > 40 ? 1.0 : 0.5)
          if (rp.opacity <= 0) return false
          ctx.strokeStyle = `rgba(${ACCENT_MARS_RGB},${rp.opacity * 0.7 * fadeAlpha})`
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
          // Scroll speed — normal trading
          const scrollSpeed = 30
          s.scrollOffset += dt * scrollSpeed
          s.tickTimer += dt
          s.surgeTimer -= dt

          // Generate new candle
          if (s.tickTimer > 1.3) {
            s.tickTimer = 0
            const isSurge = s.surgeTimer <= 0
            s.candles.push(generateCandle(isSurge))
            if (isSurge) s.surgeTimer = SURGE_INTERVAL
          }

          // Transition to closing
          if (s.tradeDayTimer > TRADE_DAY_DURATION) {
            s.tradeDayPhase = 'closing'
            s.tradeDayTimer = 0
          }
        } else if (s.tradeDayPhase === 'closing') {
          // Decelerate scroll
          const progress = s.tradeDayTimer / CLOSING_DURATION
          const scrollSpeed = 30 * (1 - progress)
          s.scrollOffset += dt * Math.max(0, scrollSpeed)

          if (s.tradeDayTimer > CLOSING_DURATION) {
            s.tradeDayPhase = 'reset'
            s.tradeDayTimer = 0
          }
        } else if (s.tradeDayPhase === 'reset') {
          // Fade out
          s.tradeFadeAlpha = 1 - s.tradeDayTimer / RESET_DURATION

          if (s.tradeDayTimer > RESET_DURATION) {
            // Reset everything
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

        // Single pass: update positions + fade + draw
        let removeCount = 0
        s.candles.forEach((c, i) => {
          c.offsetX = -s.scrollOffset
          const x = CANDLE_START_X + i * CANDLE_SPACING + c.offsetX

          // Fade out off-screen left
          if (x < 20) {
            c.opacity = Math.max(0, c.opacity - dt * 2)
            if (c.opacity <= 0) removeCount++
          }

          // Draw if visible
          if (x > -20 && x < CANVAS_W + 20 && c.opacity > 0) {
            drawCandle(ctx, x, c, 0.7 * fa)
          }
        })

        // Remove fully faded candles
        if (removeCount > 0) {
          const removed = s.candles.splice(0, removeCount)
          s.scrollOffset -= removed.length * CANDLE_SPACING
          s.candles.forEach((c) => { c.offsetX = -s.scrollOffset })
        }

        // Trend line
        const visibleCandles = s.candles.filter((c, i) => {
          const x = CANDLE_START_X + i * CANDLE_SPACING + c.offsetX
          return x > -20 && x < CANVAS_W + 20 && c.opacity > 0
        })
        if (visibleCandles.length > 1) {
          const firstIdx = s.candles.indexOf(visibleCandles[0])
          drawTrendLine(ctx, visibleCandles, CANDLE_START_X + firstIdx * CANDLE_SPACING + visibleCandles[0].offsetX, CANDLE_SPACING, 0.7 * fa)
        }

        // Live price indicator
        if (s.candles.length > 0) {
          const lastCandle = s.candles[s.candles.length - 1]
          const lastX = CANDLE_START_X + (s.candles.length - 1) * CANDLE_SPACING + lastCandle.offsetX
          const lastY = CANDLE_BASE_Y - lastCandle.h + lastCandle.b / 2

          // Flash speed increases during closing
          const flashSpeed = s.tradeDayPhase === 'closing' ? 8 : 3
          s.priceFlash += dt * flashSpeed
          const flashAlpha = (0.3 + 0.3 * Math.abs(Math.sin(s.priceFlash))) * fa

          ctx.strokeStyle = `rgba(255,255,255,${flashAlpha})`
          ctx.lineWidth = 0.8
          ctx.setLineDash([3, 3])
          ctx.beginPath()
          ctx.moveTo(lastX + 15, lastY)
          ctx.lineTo(CANVAS_W, lastY)
          ctx.stroke()
          ctx.setLineDash([])

          // Price label — no currency symbol
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha + 0.1})`
          ctx.font = '10px monospace'
          ctx.fillText(`${(100 + lastCandle.h * 0.5).toFixed(0)}`, CANVAS_W - 35, lastY - 5)
        }
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

/** Static SVG for Project Three (no animation needed) */
function ProjectThreeIllustration() {
  const commonClass = 'w-full h-full opacity-[0.3] transition-all duration-500 group-hover:opacity-[0.5]'
  return (
    <svg viewBox="0 0 400 280" fill="none" stroke="currentColor" className={commonClass}>
      {[80, 140, 200].map((y) => (
        <circle key={`l1-${y}`} cx="60" cy={y} r="8" strokeWidth="1" />
      ))}
      {[60, 120, 180, 240].map((y) => (
        <circle key={`l2-${y}`} cx="160" cy={y} r="6" strokeWidth="1" />
      ))}
      {[80, 140, 200].map((y) => (
        <circle key={`l3-${y}`} cx="260" cy={y} r="6" strokeWidth="1" />
      ))}
      <circle cx="350" cy="140" r="10" strokeWidth="1.2" />
      {[80, 140, 200].map((y1) =>
        [60, 120, 180, 240].map((y2) => (
          <line key={`c1-${y1}-${y2}`} x1="68" y1={y1} x2="154" y2={y2} strokeWidth="0.4" opacity="0.3" />
        )),
      )}
      {[60, 120, 180, 240].map((y1) =>
        [80, 140, 200].map((y2) => (
          <line key={`c2-${y1}-${y2}`} x1="166" y1={y1} x2="254" y2={y2} strokeWidth="0.4" opacity="0.3" />
        )),
      )}
      {[80, 140, 200].map((y1) => (
        <line key={`c3-${y1}`} x1="266" y1={y1} x2="340" y2={140} strokeWidth="0.5" opacity="0.4" />
      ))}
      <circle cx="350" cy="140" r="18" strokeWidth="0.6" strokeDasharray="5 3" opacity="0.4" />
    </svg>
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

  return (
    <a
      href={project.ctaUrl}
      target={project.ctaUrl.startsWith('http') ? '_blank' : undefined}
      rel={project.ctaUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
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
        {project.id === 'project-three' ? (
          <ProjectThreeIllustration />
        ) : (
          <CanvasIllustration id={project.id} isHovered={isHovered} />
        )}
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
          <span>{project.ctaText}</span>
          <span aria-hidden="true" className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ fontSize: 13, lineHeight: 1, transform: 'scale(1.4)' }}>↗</span>
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
