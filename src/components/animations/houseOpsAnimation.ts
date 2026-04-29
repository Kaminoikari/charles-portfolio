import { whiteA, marsA } from './shared'

// ─── House Ops: Radar Sweep Animation ───
// Layout on the 400×280 canvas:
//   Radar circle: center (130, 140), outer radius 100
//   Envelope:     (245, 95, 115×90)

export const HO_CX = 130
export const HO_CY = 140
export const HO_OUTER_R = 100
export const HO_RINGS = [33, 67, 100]
export const HO_LISTING_COUNT = 8
export const HO_TRAIL_RAD = (60 * Math.PI) / 180
export const HO_SWEEP_START = -Math.PI / 2

export const HO_ENV_X = 245
export const HO_ENV_Y = 95
export const HO_ENV_W = 115
export const HO_ENV_H = 90

export const HO_ENTRANCE_DURATION = 0.4
export const HO_SWEEP_DURATION = 3.0
export const HO_SETTLED_DURATION = 0.6
export const HO_DIGEST_DURATION = 0.7
export const HO_FADE_DURATION = 0.5

export type HoPhase = 'entrance' | 'sweep' | 'settled' | 'digest' | 'fadeOut'

export type HoListing = {
  angle: number
  radius: number
  score: number
  blipTime: number  // cumulative time when this listing got blipped (0 = not yet)
}

export function generateListings(): HoListing[] {
  // 3 RECOMMEND (4.0–4.7) + 3 CAUTIOUS (3.5–3.9) + 2 SKIP (2.0–3.4)
  const scores = [
    4.0 + Math.random() * 0.7,
    4.0 + Math.random() * 0.7,
    4.0 + Math.random() * 0.7,
    3.5 + Math.random() * 0.4,
    3.5 + Math.random() * 0.4,
    3.5 + Math.random() * 0.4,
    2.0 + Math.random() * 1.4,
    2.0 + Math.random() * 1.4,
  ]
  for (let i = scores.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[scores[i], scores[j]] = [scores[j], scores[i]]
  }

  const angles: number[] = []
  for (let i = 0; i < HO_LISTING_COUNT; i++) {
    const base = (i / HO_LISTING_COUNT) * Math.PI * 2
    const jitter = ((Math.random() - 0.5) * Math.PI * 0.6) / HO_LISTING_COUNT
    angles.push(base + jitter)
  }
  angles.sort((a, b) => a - b)

  return angles.map((angle, i) => ({
    angle,
    radius: 42 + Math.random() * 50,
    score: scores[i],
    blipTime: 0,
  }))
}

// Sweep starts at HO_SWEEP_START and goes CW.
// Returns the fraction of a full sweep (0–1) at which the arm reaches `listingAngle`.
export function listingSweepFraction(listingAngle: number): number {
  let norm = listingAngle - HO_SWEEP_START
  while (norm < 0) norm += Math.PI * 2
  while (norm >= Math.PI * 2) norm -= Math.PI * 2
  return norm / (Math.PI * 2)
}

// Mark any listing whose angle has been swept. Mutates listings in place.
export function updateBlips(listings: HoListing[], sweepProgress: number, cumTime: number) {
  listings.forEach((l) => {
    if (l.blipTime > 0) return
    if (sweepProgress >= listingSweepFraction(l.angle)) {
      l.blipTime = cumTime > 0 ? cumTime : 0.0001
    }
  })
}

// ── Drawing helpers ──

function listingStroke(score: number, alpha: number): string {
  if (score >= 4.0) return marsA(alpha)
  if (score >= 3.5) return whiteA(alpha * 0.7)
  return whiteA(alpha * 0.25)
}

function drawRadarFrame(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = whiteA(0.12 * alpha)
  ctx.lineWidth = 1
  HO_RINGS.forEach((r) => {
    ctx.beginPath()
    ctx.arc(HO_CX, HO_CY, r, 0, Math.PI * 2)
    ctx.stroke()
  })
  ctx.strokeStyle = whiteA(0.06 * alpha)
  ctx.setLineDash([2, 4])
  ctx.beginPath()
  ctx.moveTo(HO_CX - HO_OUTER_R, HO_CY)
  ctx.lineTo(HO_CX + HO_OUTER_R, HO_CY)
  ctx.moveTo(HO_CX, HO_CY - HO_OUTER_R)
  ctx.lineTo(HO_CX, HO_CY + HO_OUTER_R)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawHouseHub(ctx: CanvasRenderingContext2D, alpha: number, pulse: number) {
  const s = 5
  ctx.fillStyle = marsA((0.7 + pulse * 0.25) * alpha)
  ctx.beginPath()
  ctx.rect(HO_CX - s, HO_CY - 1, s * 2, s + 1)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(HO_CX - s - 1.5, HO_CY - 1)
  ctx.lineTo(HO_CX, HO_CY - s - 2)
  ctx.lineTo(HO_CX + s + 1.5, HO_CY - 1)
  ctx.closePath()
  ctx.fill()
}

function drawEnvelope(ctx: CanvasRenderingContext2D, alpha: number, active: number) {
  const x = HO_ENV_X
  const y = HO_ENV_Y
  const w = HO_ENV_W
  const h = HO_ENV_H

  ctx.fillStyle = active > 0.3 ? marsA((0.04 + active * 0.12) * alpha) : whiteA(0.03 * alpha)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 3)
  ctx.fill()

  ctx.strokeStyle = active > 0.3 ? marsA((0.4 + active * 0.5) * alpha) : whiteA(0.25 * alpha)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 3)
  ctx.stroke()

  // Flap V
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w / 2, y + h * 0.42)
  ctx.lineTo(x + w, y)
  ctx.stroke()

  if (active > 0.7) {
    const sx = x + w - 16
    const sy = y + h - 14
    const stampA = (active - 0.7) / 0.3
    ctx.strokeStyle = marsA(stampA * alpha)
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(sx - 3, sy)
    ctx.lineTo(sx, sy + 3)
    ctx.lineTo(sx + 5, sy - 3)
    ctx.stroke()
    ctx.lineWidth = 1
  }
}

function drawListing(
  ctx: CanvasRenderingContext2D,
  listing: HoListing,
  alpha: number,
  blipFlash: number,
  showScore: boolean,
  scoreFadeOut: number,
  pulse: number,
) {
  const x = HO_CX + Math.cos(listing.angle) * listing.radius
  const y = HO_CY + Math.sin(listing.angle) * listing.radius
  const isRec = listing.score >= 4.0
  const dotR = isRec ? 3 + pulse * 0.8 : 2.2

  if (isRec) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, dotR * 3.5)
    glow.addColorStop(0, marsA(0.45 * alpha))
    glow.addColorStop(1, marsA(0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, dotR * 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  if (blipFlash > 0) {
    const flash = ctx.createRadialGradient(x, y, 0, x, y, 14)
    flash.addColorStop(0, whiteA(0.85 * blipFlash * alpha))
    flash.addColorStop(1, whiteA(0))
    ctx.fillStyle = flash
    ctx.beginPath()
    ctx.arc(x, y, 14, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = listingStroke(listing.score, alpha)
  ctx.beginPath()
  ctx.arc(x, y, dotR, 0, Math.PI * 2)
  ctx.fill()

  if (showScore) {
    const a = (1 - scoreFadeOut) * alpha
    ctx.fillStyle = isRec ? marsA(0.95 * a) : whiteA(0.7 * a)
    ctx.font = 'bold 9px monospace'
    const text = listing.score.toFixed(1)
    const tw = ctx.measureText(text).width
    ctx.fillText(text, x - tw / 2, y - 10)
  }
}

function drawSweepArm(ctx: CanvasRenderingContext2D, angle: number, alpha: number) {
  // Trail wedge — 60° fading behind the arm
  const STEPS = 14
  for (let i = 0; i < STEPS; i++) {
    const t1 = i / STEPS
    const t2 = (i + 1) / STEPS
    const a1 = angle - HO_TRAIL_RAD * t1
    const a2 = angle - HO_TRAIL_RAD * t2
    const wedgeAlpha = (1 - t1) * 0.20 * alpha
    ctx.fillStyle = marsA(wedgeAlpha)
    ctx.beginPath()
    ctx.moveTo(HO_CX, HO_CY)
    ctx.arc(HO_CX, HO_CY, HO_OUTER_R, a1, a2, true)
    ctx.closePath()
    ctx.fill()
  }

  ctx.strokeStyle = marsA(0.85 * alpha)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(HO_CX, HO_CY)
  ctx.lineTo(HO_CX + Math.cos(angle) * HO_OUTER_R, HO_CY + Math.sin(angle) * HO_OUTER_R)
  ctx.stroke()
  ctx.lineWidth = 1

  const tx = HO_CX + Math.cos(angle) * HO_OUTER_R
  const ty = HO_CY + Math.sin(angle) * HO_OUTER_R
  ctx.fillStyle = marsA(alpha)
  ctx.beginPath()
  ctx.arc(tx, ty, 2, 0, Math.PI * 2)
  ctx.fill()
}

// ── Public API ──

export function drawHouseOpsStatic(ctx: CanvasRenderingContext2D) {
  const alpha = 0.7
  drawRadarFrame(ctx, alpha)
  drawHouseHub(ctx, alpha, 0)
  drawEnvelope(ctx, alpha, 0.2)
  // Deterministic sample so the static state is recognizable as a finished sweep
  const sample: HoListing[] = [
    { angle: -Math.PI / 2 + 0.3, radius: 70, score: 4.3, blipTime: 1 },
    { angle: 0.3, radius: 55, score: 3.7, blipTime: 1 },
    { angle: 1.0, radius: 85, score: 4.1, blipTime: 1 },
    { angle: 1.9, radius: 50, score: 2.8, blipTime: 1 },
    { angle: 2.6, radius: 75, score: 3.6, blipTime: 1 },
    { angle: 3.4, radius: 60, score: 4.5, blipTime: 1 },
    { angle: 4.3, radius: 80, score: 3.2, blipTime: 1 },
    { angle: 5.2, radius: 65, score: 3.8, blipTime: 1 },
  ]
  sample.forEach((l) => drawListing(ctx, l, alpha, 0, false, 1, 0))
  ctx.globalAlpha = 1
}

export function drawHouseOpsAnimated(
  ctx: CanvasRenderingContext2D,
  phase: HoPhase,
  phaseTimer: number,
  cumTime: number,
  listings: HoListing[],
  fadeAlpha: number,
) {
  const a = fadeAlpha
  const entranceP = phase === 'entrance' ? Math.min(1, phaseTimer / HO_ENTRANCE_DURATION) : 1

  drawRadarFrame(ctx, a * entranceP)

  const hubPulse = 0.5 + 0.5 * Math.sin(cumTime * 3)
  drawHouseHub(ctx, a * entranceP, hubPulse)

  let envActive = 0.15
  if (phase === 'digest') envActive = Math.min(1, phaseTimer / HO_DIGEST_DURATION)
  else if (phase === 'fadeOut') envActive = 1
  drawEnvelope(ctx, a * entranceP, envActive)

  // Connection lines first so they sit behind the dots
  if (phase === 'digest' || phase === 'fadeOut') {
    const lineT = phase === 'digest' ? Math.min(1, phaseTimer / HO_DIGEST_DURATION) : 1
    listings.forEach((l) => {
      if (l.score < 4.0) return
      const lx = HO_CX + Math.cos(l.angle) * l.radius
      const ly = HO_CY + Math.sin(l.angle) * l.radius
      const ex = HO_ENV_X + 4
      const ey = HO_ENV_Y + HO_ENV_H / 2
      const drawT = Math.min(1, lineT * 1.4)
      const dx = lx + (ex - lx) * drawT
      const dy = ly + (ey - ly) * drawT
      ctx.strokeStyle = marsA(0.30 * a * lineT)
      ctx.lineWidth = 0.8
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(dx, dy)
      ctx.stroke()
    })
    ctx.setLineDash([])
    ctx.lineWidth = 1
  }

  // Listings
  listings.forEach((l) => {
    if (l.blipTime <= 0) return
    const sinceBlip = cumTime - l.blipTime
    const blipFlash = sinceBlip < 0.18 ? Math.max(0, 1 - sinceBlip / 0.18) : 0
    const showScore = sinceBlip < 0.8
    const scoreFadeOut = sinceBlip < 0.5 ? 0 : Math.min(1, (sinceBlip - 0.5) / 0.3)
    const isRec = l.score >= 4.0
    const pulse = isRec ? Math.max(0, Math.sin(cumTime * 3 + l.angle * 1.7) * 0.5 + 0.5) : 0
    drawListing(ctx, l, a, blipFlash, showScore, scoreFadeOut, pulse)
  })

  // Sweep arm last so it sits above settled dots
  if (phase === 'sweep') {
    const sweepAngle = HO_SWEEP_START + (phaseTimer / HO_SWEEP_DURATION) * Math.PI * 2
    drawSweepArm(ctx, sweepAngle, a)
  }

  ctx.globalAlpha = 1
}
