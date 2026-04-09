import { whiteA, marsA } from './shared'

// ─── Candle data for Plutus Trade ───
export const CANDLE_BASE_Y = 260
export const CANDLE_SPACING = 40
export const CANDLE_START_X = 50
export const TRADE_DAY_DURATION = 8
export const CLOSING_DURATION = 1.5
export const RESET_DURATION = 0.5
export const SURGE_INTERVAL = 3.5

const INITIAL_CANDLES = [
  { h: 120, b: 40, up: false }, { h: 80, b: 30, up: true }, { h: 140, b: 50, up: true },
  { h: 60, b: 25, up: false }, { h: 100, b: 35, up: true }, { h: 160, b: 45, up: true },
  { h: 90, b: 30, up: false }, { h: 110, b: 40, up: true },
]

export interface Candle {
  h: number
  b: number
  up: boolean
  offsetX: number
  opacity: number
}

export function generateCandle(surge = false): Candle {
  const isSurgeUp = Math.random() > 0.5
  return {
    h: surge ? 140 + Math.random() * 60 : 50 + Math.random() * 120,
    b: surge ? 50 + Math.random() * 30 : 20 + Math.random() * 40,
    up: surge ? isSurgeUp : Math.random() > 0.4,
    offsetX: 0,
    opacity: 1,
  }
}

export function resetCandles(): Candle[] {
  return INITIAL_CANDLES.map((c) => ({ ...c, offsetX: 0, opacity: 1 }))
}

export function drawCandle(ctx: CanvasRenderingContext2D, x: number, candle: Candle, alpha: number) {
  const y = CANDLE_BASE_Y - candle.h
  const bodyY = y + (candle.h - candle.b) / 2
  const a = alpha * candle.opacity

  // Wick
  ctx.globalAlpha = a * 0.5
  ctx.strokeStyle = candle.up ? marsA(0.7) : whiteA(0.6)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + candle.h)
  ctx.stroke()

  // Body
  ctx.globalAlpha = a
  if (candle.up) {
    ctx.strokeStyle = marsA(0.9)
    ctx.fillStyle = marsA(a * 0.25)
  } else {
    ctx.strokeStyle = whiteA(0.7)
    ctx.fillStyle = whiteA(a * 0.08)
  }
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x - 10, bodyY, 20, candle.b)
  ctx.stroke()
  ctx.fill()
  ctx.globalAlpha = 1
}

export function drawTrendLine(ctx: CanvasRenderingContext2D, candles: Candle[], startX: number, spacing: number, alpha: number) {
  if (candles.length < 2) return
  ctx.globalAlpha = alpha * 0.4
  ctx.strokeStyle = whiteA(0.6)
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
