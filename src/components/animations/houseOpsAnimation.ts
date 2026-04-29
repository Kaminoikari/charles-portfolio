import { whiteA, marsA } from './shared'

// ─── House Ops: Continuous Radar Sweep ───
// Layout on the 400×280 canvas:
//   Radar circle: center (200, 140), outer radius 120

export const HO_CX = 200
export const HO_CY = 140
export const HO_OUTER_R = 120
export const HO_RINGS = [40, 80, 120]
export const HO_LISTING_COUNT = 8
export const HO_TRAIL_RAD = (60 * Math.PI) / 180
export const HO_SWEEP_START = -Math.PI / 2
export const HO_SWEEP_DURATION = 3.0   // seconds per full rotation
export const HO_ENTRANCE_FADE = 0.4    // first-hover soft fade-in
export const HO_LISTING_LIFETIME_MIN = 5.0
export const HO_LISTING_LIFETIME_MAX = 7.0
export const HO_SCORE_VISIBLE = 0.5    // score visible window after blip
export const HO_SCORE_FADE = 0.3       // additional fade window
export const HO_BLIP_FLASH = HO_SCORE_VISIBLE + HO_SCORE_FADE  // synced with score lifecycle
export const HO_LISTING_FADE_OUT = 0.8 // lifetime tail used to fade listing out

const TWO_PI = Math.PI * 2

export type HoListing = {
  angle: number
  radius: number
  score: number
  createdTime: number
  lifetime: number
  blipTime: number  // cumulative time when blipped (0 = not yet)
}

function randomScore(): number {
  // 3/8 RECOMMEND (4.0–4.7), 3/8 CAUTIOUS (3.5–3.9), 2/8 SKIP (2.0–3.4)
  const r = Math.random()
  if (r < 0.375) return 4.0 + Math.random() * 0.7
  if (r < 0.75) return 3.5 + Math.random() * 0.4
  return 2.0 + Math.random() * 1.4
}

export function makeListing(now: number): HoListing {
  return {
    angle: Math.random() * TWO_PI,
    radius: 50 + Math.random() * 65,  // 50–115 (inside HO_OUTER_R = 120)
    score: randomScore(),
    createdTime: now,
    lifetime: HO_LISTING_LIFETIME_MIN + Math.random() * (HO_LISTING_LIFETIME_MAX - HO_LISTING_LIFETIME_MIN),
    blipTime: 0,
  }
}

export function generateListings(): HoListing[] {
  const list: HoListing[] = []
  for (let i = 0; i < HO_LISTING_COUNT; i++) {
    const l = makeListing(0)
    // Stagger their start so they don't all expire at once
    l.createdTime = -Math.random() * l.lifetime * 0.5
    list.push(l)
  }
  return list
}

function normalizeAngle(a: number): number {
  let n = a - HO_SWEEP_START
  while (n < 0) n += TWO_PI
  while (n >= TWO_PI) n -= TWO_PI
  return n
}

// Returns true if `target` lies in the CW arc (prev, curr] (with wrap support).
function arcContainsCW(target: number, prev: number, curr: number): boolean {
  if (curr >= prev) return target > prev && target <= curr
  // Sweep wrapped past 2π between frames
  return target > prev || target <= curr
}

// Mutates `listings` in place. Per frame:
//   - if a listing's age >= its lifetime, replace it with a fresh one at a new angle/score
//   - otherwise, if it hasn't blipped yet and the sweep arm crossed its angle this frame, blip it
export function updateListings(
  listings: HoListing[],
  cumTime: number,
  prevSweepNorm: number,
  currSweepNorm: number,
) {
  for (let i = 0; i < listings.length; i++) {
    const l = listings[i]
    const age = cumTime - l.createdTime
    if (age >= l.lifetime) {
      listings[i] = makeListing(cumTime)
      continue
    }
    // Re-blip each time the arm passes (radar metaphor: target re-pinged per rotation)
    const lNorm = normalizeAngle(l.angle)
    if (arcContainsCW(lNorm, prevSweepNorm, currSweepNorm)) {
      l.blipTime = cumTime > 0 ? cumTime : 0.0001
    }
  }
}

// ── Drawing helpers ──

function listingStroke(score: number, alpha: number): string {
  if (score >= 4.0) return marsA(alpha)
  if (score >= 3.5) return whiteA(alpha * 0.85)
  return whiteA(alpha * 0.4)
}

function drawRadarFrame(ctx: CanvasRenderingContext2D, alpha: number) {
  // Bold outer ring
  ctx.strokeStyle = marsA(0.6 * alpha)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(HO_CX, HO_CY, HO_OUTER_R, 0, TWO_PI)
  ctx.stroke()
  ctx.lineWidth = 1

  // Inner concentric rings
  ctx.strokeStyle = marsA(0.2 * alpha)
  for (let i = 0; i < HO_RINGS.length - 1; i++) {
    ctx.beginPath()
    ctx.arc(HO_CX, HO_CY, HO_RINGS[i], 0, TWO_PI)
    ctx.stroke()
  }

  // Rim ticks: every 5° short, every 30° long
  ctx.strokeStyle = marsA(0.42 * alpha)
  ctx.lineWidth = 0.9
  for (let deg = 0; deg < 360; deg += 5) {
    const angle = HO_SWEEP_START + (deg / 360) * TWO_PI
    const isMajor = deg % 30 === 0
    const tickLen = isMajor ? 6 : 3
    const x1 = HO_CX + Math.cos(angle) * HO_OUTER_R
    const y1 = HO_CY + Math.sin(angle) * HO_OUTER_R
    const x2 = HO_CX + Math.cos(angle) * (HO_OUTER_R - tickLen)
    const y2 = HO_CY + Math.sin(angle) * (HO_OUTER_R - tickLen)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.lineWidth = 1

  // Degree numbers every 30° (000, 030, 060 …)
  ctx.fillStyle = marsA(0.7 * alpha)
  ctx.font = 'bold 8px monospace'
  for (let deg = 0; deg < 360; deg += 30) {
    const angle = HO_SWEEP_START + (deg / 360) * TWO_PI
    const labelR = HO_OUTER_R + 9
    const lx = HO_CX + Math.cos(angle) * labelR
    const ly = HO_CY + Math.sin(angle) * labelR
    const text = deg.toString().padStart(3, '0')
    const tw = ctx.measureText(text).width
    ctx.fillText(text, lx - tw / 2, ly + 3)
  }

  // Dashed crosshair through center
  ctx.strokeStyle = marsA(0.18 * alpha)
  ctx.setLineDash([2, 4])
  ctx.beginPath()
  ctx.moveTo(HO_CX - HO_OUTER_R, HO_CY)
  ctx.lineTo(HO_CX + HO_OUTER_R, HO_CY)
  ctx.moveTo(HO_CX, HO_CY - HO_OUTER_R)
  ctx.lineTo(HO_CX, HO_CY + HO_OUTER_R)
  ctx.stroke()
  ctx.setLineDash([])

  // Cardinal axis tick clusters: small perpendicular ticks where each ring meets the crosshair
  ctx.strokeStyle = marsA(0.42 * alpha)
  ctx.lineWidth = 1
  const tickHL = 3
  HO_RINGS.forEach((r) => {
    ctx.beginPath()
    ctx.moveTo(HO_CX - r, HO_CY - tickHL)
    ctx.lineTo(HO_CX - r, HO_CY + tickHL)
    ctx.moveTo(HO_CX + r, HO_CY - tickHL)
    ctx.lineTo(HO_CX + r, HO_CY + tickHL)
    ctx.moveTo(HO_CX - tickHL, HO_CY - r)
    ctx.lineTo(HO_CX + tickHL, HO_CY - r)
    ctx.moveTo(HO_CX - tickHL, HO_CY + r)
    ctx.lineTo(HO_CX + tickHL, HO_CY + r)
    ctx.stroke()
  })
}

function drawHouseHub(ctx: CanvasRenderingContext2D, alpha: number, pulse: number) {
  // Reticle ring around hub
  ctx.strokeStyle = marsA(0.42 * alpha)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(HO_CX, HO_CY, 11, 0, TWO_PI)
  ctx.stroke()

  // House icon (slightly smaller to sit comfortably inside the reticle)
  const s = 4
  ctx.fillStyle = marsA((0.78 + pulse * 0.22) * alpha)
  ctx.beginPath()
  ctx.rect(HO_CX - s, HO_CY - 1, s * 2, s + 1)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(HO_CX - s - 1, HO_CY - 1)
  ctx.lineTo(HO_CX, HO_CY - s - 1.5)
  ctx.lineTo(HO_CX + s + 1, HO_CY - 1)
  ctx.closePath()
  ctx.fill()
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
  const dotR = isRec ? 4 + pulse * 0.8 : 3

  // Recommend halo — tighter and brighter for a crisp blip rather than a fuzzy aura
  if (isRec && blipFlash > 0) {
    const haloR = dotR * 2.2
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR)
    halo.addColorStop(0, marsA(0.75 * alpha * blipFlash))
    halo.addColorStop(0.4, marsA(0.3 * alpha * blipFlash))
    halo.addColorStop(1, marsA(0))
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(x, y, haloR, 0, TWO_PI)
    ctx.fill()
  }

  // Blip flash — small, punchy, sharper falloff
  if (blipFlash > 0) {
    const flashR = 10
    const flash = ctx.createRadialGradient(x, y, 0, x, y, flashR)
    flash.addColorStop(0, whiteA(0.95 * blipFlash * alpha))
    flash.addColorStop(0.5, whiteA(0.35 * blipFlash * alpha))
    flash.addColorStop(1, whiteA(0))
    ctx.fillStyle = flash
    ctx.beginPath()
    ctx.arc(x, y, flashR, 0, TWO_PI)
    ctx.fill()
  }

  // Solid dot
  ctx.fillStyle = listingStroke(listing.score, alpha)
  ctx.beginPath()
  ctx.arc(x, y, dotR, 0, TWO_PI)
  ctx.fill()

  // Bright pinpoint core for visual sharpness — only on RECOMMEND/CAUTIOUS, scaled by band
  if (listing.score >= 3.5 && alpha > 0) {
    const coreAlpha = isRec ? 0.95 : 0.65
    ctx.fillStyle = whiteA(coreAlpha * alpha)
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.8, dotR * 0.32), 0, TWO_PI)
    ctx.fill()
  }

  if (showScore) {
    const a = (1 - scoreFadeOut) * alpha
    ctx.fillStyle = isRec ? marsA(0.95 * a) : whiteA(0.75 * a)
    ctx.font = 'bold 12px monospace'
    const text = listing.score.toFixed(1)
    const tw = ctx.measureText(text).width
    ctx.fillText(text, x - tw / 2, y - 13)
  }
}

function drawSweepArm(ctx: CanvasRenderingContext2D, angle: number, alpha: number) {
  const STEPS = 14
  for (let i = 0; i < STEPS; i++) {
    const t1 = i / STEPS
    const t2 = (i + 1) / STEPS
    const a1 = angle - HO_TRAIL_RAD * t1
    const a2 = angle - HO_TRAIL_RAD * t2
    const wedgeAlpha = (1 - t1) * 0.32 * alpha
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
  ctx.arc(tx, ty, 2, 0, TWO_PI)
  ctx.fill()
}

// ── Public API ──

export function drawHouseOpsStatic(ctx: CanvasRenderingContext2D) {
  const alpha = 0.7
  drawRadarFrame(ctx, alpha)
  drawHouseHub(ctx, alpha, 0)
  // Deterministic sample dots so the static state reads as a populated radar
  const sample: HoListing[] = [
    { angle: -Math.PI / 2 + 0.3, radius: 88, score: 4.3, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 0.3, radius: 70, score: 3.7, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 1.0, radius: 100, score: 4.1, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 1.9, radius: 60, score: 2.8, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 2.6, radius: 92, score: 3.6, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 3.4, radius: 75, score: 4.5, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 4.3, radius: 95, score: 3.2, createdTime: 0, lifetime: 99, blipTime: 1 },
    { angle: 5.2, radius: 80, score: 3.8, createdTime: 0, lifetime: 99, blipTime: 1 },
  ]
  sample.forEach((l) => drawListing(ctx, l, alpha, 0, false, 1, 0))
  ctx.globalAlpha = 1
}

export function drawHouseOpsAnimated(
  ctx: CanvasRenderingContext2D,
  cumTime: number,
  listings: HoListing[],
  entranceFade: number,
) {
  drawRadarFrame(ctx, entranceFade)

  const hubPulse = 0.5 + 0.5 * Math.sin(cumTime * 3)
  drawHouseHub(ctx, entranceFade, hubPulse)

  // Listings
  const scoreWindow = HO_SCORE_VISIBLE + HO_SCORE_FADE
  listings.forEach((l) => {
    if (l.blipTime <= 0) return
    const sinceBlip = cumTime - l.blipTime
    if (sinceBlip < 0) return
    // After the score/flash window, the listing is fully gone (no residual dot)
    if (sinceBlip > scoreWindow) return

    const age = cumTime - l.createdTime
    const tailStart = l.lifetime - HO_LISTING_FADE_OUT
    const lifeFade = age > tailStart ? Math.max(0, 1 - (age - tailStart) / HO_LISTING_FADE_OUT) : 1
    const alpha = entranceFade * lifeFade
    if (alpha <= 0) return

    const blipFlash = sinceBlip < HO_BLIP_FLASH ? Math.max(0, 1 - sinceBlip / HO_BLIP_FLASH) : 0
    const showScore = sinceBlip < scoreWindow
    const scoreFadeOut = sinceBlip < HO_SCORE_VISIBLE
      ? 0
      : Math.min(1, (sinceBlip - HO_SCORE_VISIBLE) / HO_SCORE_FADE)
    const isRec = l.score >= 4.0
    const pulse = isRec ? Math.max(0, Math.sin(cumTime * 3 + l.angle * 1.7) * 0.5 + 0.5) : 0

    drawListing(ctx, l, alpha, blipFlash, showScore, scoreFadeOut, pulse)
  })

  // Sweep arm — always drawn, no phase gate
  const sweepAngle = HO_SWEEP_START + ((cumTime / HO_SWEEP_DURATION) * TWO_PI) % TWO_PI
  drawSweepArm(ctx, sweepAngle, entranceFade)

  ctx.globalAlpha = 1
}
