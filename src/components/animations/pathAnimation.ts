import { whiteA, marsA, quadBezier, easeInOutCubic, lerp } from './shared'

// ─── Route: S-curve via quadratic bezier segments ───
export const ROUTE_POINTS = [
  { x: 60, y: 240 },
  { x: 140, y: 180 },
  { x: 240, y: 120 },
  { x: 360, y: 40 },
]

const ROUTE_CONTROLS = [
  { x: 130, y: 240 },
  { x: 155, y: 105 },
  { x: 325, y: 120 },
]

export const COMET_TRAIL_LENGTH = 14

export function getEasedRoutePosition(t: number) {
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

export function strokeBezierSegment(ctx: CanvasRenderingContext2D, segIndex: number) {
  const p0 = ROUTE_POINTS[segIndex]
  const cp = ROUTE_CONTROLS[segIndex]
  const p1 = ROUTE_POINTS[segIndex + 1]
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.quadraticCurveTo(cp.x, cp.y, p1.x, p1.y)
  ctx.stroke()
}

export function strokePartialBezier(ctx: CanvasRenderingContext2D, segIndex: number, t0: number, t1: number, steps = 20) {
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

export function drawRoutePath(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = whiteA(0.2)
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  for (let i = 0; i < ROUTE_POINTS.length - 1; i++) {
    strokeBezierSegment(ctx, i)
  }
  ctx.setLineDash([])
}

export function drawPins(ctx: CanvasRenderingContext2D, arrivedSet?: Set<number>) {
  ROUTE_POINTS.forEach((p, i) => {
    const r = i === 0 || i === 3 ? 7 : 5
    const arrived = arrivedSet?.has(i) ?? false

    if (arrived) {
      ctx.fillStyle = marsA(0.7)
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = marsA(0.9)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeStyle = whiteA(0.3)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = whiteA(0.15)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

// ─── Itinerary cards ───
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

  ctx.globalAlpha = 1
  ctx.fillStyle = `rgb(${10 + brightness * 14}, ${10 + brightness * 14}, ${10 + brightness * 14})`
  ctx.beginPath()
  ctx.roundRect(x, y, CARD_W, CARD_H, 4)
  ctx.fill()

  const borderAlpha = 0.5 + brightness * 0.3
  ctx.globalAlpha = borderAlpha
  ctx.strokeStyle = whiteA(borderAlpha)
  ctx.lineWidth = brightness > 0.5 ? 1.2 : 1
  ctx.beginPath()
  ctx.roundRect(x, y, CARD_W, CARD_H, 4)
  ctx.stroke()

  ctx.globalAlpha = 0.2 + brightness * 0.5
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(x, y + 18)
  ctx.lineTo(x + CARD_W, y + 18)
  ctx.stroke()

  ctx.globalAlpha = 0.35 + brightness * 0.6
  ctx.fillStyle = whiteA(0.95)
  ctx.font = 'bold 10px monospace'
  ctx.fillText(cardDef.label, x + 8, y + 13)

  CARD_LINES.forEach((line, li) => {
    const lineX1 = x + 8
    const lineX2 = x + CARD_W - line.wShrink
    const lineY = y + line.yOff
    const lineThreshold = li / CARD_LINES.length
    const checked = checkProgress > lineThreshold + 1 / CARD_LINES.length
    const checking = checkProgress > lineThreshold && !checked
    const checkT = checking ? (checkProgress - lineThreshold) * CARD_LINES.length : 0

    const lineAlpha = checked || checking ? 0.5 + brightness * 0.3 : 0.12 + brightness * 0.3
    ctx.globalAlpha = lineAlpha
    ctx.strokeStyle = whiteA(lineAlpha)
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(lineX1, lineY)
    ctx.lineTo(lineX2, lineY)
    ctx.stroke()

    if (checked) {
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = marsA(0.9)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(lineX2 + 4, lineY - 4)
      ctx.lineTo(lineX2 + 8, lineY + 1)
      ctx.lineTo(lineX2 + 14, lineY - 6)
      ctx.stroke()
    } else if (checking) {
      const checkAlpha = Math.min(1, checkT * 1.5)
      ctx.globalAlpha = checkAlpha * 0.9
      ctx.strokeStyle = marsA(checkAlpha * 0.9)
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

export function drawItineraryCard(ctx: CanvasRenderingContext2D, cardTimers: number[], fadeAlpha: number) {
  ITINERARY_CARDS.forEach((card, i) => {
    const t = cardTimers[i]
    const brightness = 0.15 + t * 0.85
    const checkProgress = t
    ctx.globalAlpha = fadeAlpha
    drawSingleCard(ctx, card, brightness, checkProgress)
  })
  ctx.globalAlpha = 1
}
