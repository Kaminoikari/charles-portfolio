import { whiteA, marsA, easeInOutCubic, CANVAS_W } from './shared'

// ─── Job Ops: Token rain → CV-match scan line → digest panel ───
// Layout on the 400×280 canvas:
//   Rain zone:     y 0–148   (vertical token streams falling down)
//   Scan line:     y 150     (mars dashed horizontal, fixed)
//   Digest panel:  y 168–268 (3 rows materialize one at a time)

export const JO_SCAN_Y = 150
export const JO_PANEL_X = 18
export const JO_PANEL_W = CANVAS_W - JO_PANEL_X * 2
export const JO_PANEL_Y = 168
export const JO_PANEL_H = 100
export const JO_ROW_START_Y = JO_PANEL_Y + 32
export const JO_ROW_HEIGHT = 22
export const JO_COLUMN_COUNT = 7
export const JO_COLUMN_W = CANVAS_W / JO_COLUMN_COUNT
export const JO_GLYPH_H = 17
export const JO_RAIN_TOP = -40
export const JO_RAIN_BOTTOM = 148
export const JO_FLASH_DURATION = 0.45

export const JO_ENTRANCE_DURATION = 0.5
export const JO_RAIN_DURATION = 1.6
export const JO_ROW_DURATION = 1.2
export const JO_ROW_MATERIALIZE = 0.45
export const JO_SETTLE_DURATION = 1.4
export const JO_FADEOUT_DURATION = 0.5

// Token vocabulary drawn from 104 job-post surface area
const TOKEN_POOL = [
  'Python', 'AI', 'PM', '資深', '遠端', '90K',
  '3y', 'Figma', '後端', '前端', 'Senior', '新創',
  'Hybrid', '中型', '管理職', 'Manager', 'Lead', '5y',
  '70K', 'Growth', 'Data', 'Product', '台北', '產品',
  '面議', 'IC', 'Full-stack', 'PdM', 'B2B', 'SaaS',
]

// Tokens flagged as CV signals; they flash mars when crossing the scan line
const CV_MATCHED_SET = new Set([
  'Python', 'AI', 'PM', '遠端', '90K', 'Senior', '5y', 'Lead', 'Product', 'PdM',
])

export type JoColumn = {
  x: number
  glyphs: string[]
  matchedIdx: Set<number>
  flashTimer: Map<number, number>
  speed: number
  offsetY: number
}

export type JoDigestRow = {
  title: string
  salary: string
  dots: number
  score: string
  band: 'rec' | 'cau' | 'skip'
}

export const JO_DIGEST_ROWS: JoDigestRow[] = [
  { title: 'Senior AI PM',    salary: '90K', dots: 4, score: '4.6', band: 'rec' },
  { title: 'Growth PM',       salary: '75K', dots: 3, score: '3.8', band: 'cau' },
  { title: 'Junior Data PM',  salary: '55K', dots: 2, score: '2.9', band: 'skip' },
]

function pickGlyphs(count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(TOKEN_POOL[Math.floor(Math.random() * TOKEN_POOL.length)])
  }
  return out
}

function collectMatched(glyphs: string[]): Set<number> {
  const out = new Set<number>()
  glyphs.forEach((g, i) => {
    if (CV_MATCHED_SET.has(g)) out.add(i)
  })
  return out
}

export function generateColumns(): JoColumn[] {
  const cols: JoColumn[] = []
  for (let i = 0; i < JO_COLUMN_COUNT; i++) {
    const len = 7 + Math.floor(Math.random() * 3)
    const glyphs = pickGlyphs(len)
    const totalH = len * JO_GLYPH_H
    cols.push({
      x: i * JO_COLUMN_W + JO_COLUMN_W / 2,
      glyphs,
      matchedIdx: collectMatched(glyphs),
      flashTimer: new Map(),
      speed: 26 + Math.random() * 18,
      offsetY: JO_RAIN_TOP - Math.random() * totalH,
    })
  }
  return cols
}

export function updateColumns(cols: JoColumn[], dt: number) {
  for (const col of cols) {
    const totalH = col.glyphs.length * JO_GLYPH_H

    col.offsetY += dt * col.speed

    if (col.flashTimer.size > 0) {
      for (const [idx, t] of col.flashTimer) {
        const next = t - dt
        if (next <= 0) col.flashTimer.delete(idx)
        else col.flashTimer.set(idx, next)
      }
    }

    for (const idx of col.matchedIdx) {
      const glyphY = col.offsetY + idx * JO_GLYPH_H
      if (Math.abs(glyphY - JO_SCAN_Y) < 7 && !col.flashTimer.has(idx)) {
        col.flashTimer.set(idx, JO_FLASH_DURATION)
      }
    }

    if (col.offsetY > JO_RAIN_BOTTOM + 20) {
      const len = 7 + Math.floor(Math.random() * 3)
      col.glyphs = pickGlyphs(len)
      col.matchedIdx = collectMatched(col.glyphs)
      col.flashTimer.clear()
      col.offsetY = JO_RAIN_TOP - totalH * 0.3
      col.speed = 26 + Math.random() * 18
    }
  }
}

function drawColumn(ctx: CanvasRenderingContext2D, col: JoColumn, alpha: number) {
  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lead = col.glyphs.length - 1

  for (let i = 0; i < col.glyphs.length; i++) {
    const y = col.offsetY + i * JO_GLYPH_H
    if (y < JO_RAIN_TOP || y > JO_RAIN_BOTTOM) continue

    const isMatched = col.matchedIdx.has(i)
    const flashT = col.flashTimer.get(i) ?? 0
    const flashAlpha = flashT > 0 ? flashT / JO_FLASH_DURATION : 0

    const distFromLead = lead - i
    let baseAlpha = 0.55 - distFromLead * 0.07
    if (baseAlpha < 0.13) baseAlpha = 0.13

    if (isMatched && flashAlpha > 0) {
      const haloR = 14
      const halo = ctx.createRadialGradient(col.x, y, 0, col.x, y, haloR)
      halo.addColorStop(0, marsA(0.55 * flashAlpha * alpha))
      halo.addColorStop(0.5, marsA(0.18 * flashAlpha * alpha))
      halo.addColorStop(1, marsA(0))
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(col.x, y, haloR, 0, Math.PI * 2)
      ctx.fill()

      const merged = Math.min(0.95, baseAlpha + 0.45 * flashAlpha)
      ctx.fillStyle = marsA(merged * alpha)
    } else if (isMatched) {
      ctx.fillStyle = marsA(baseAlpha * 0.55 * alpha)
    } else {
      ctx.fillStyle = whiteA(baseAlpha * alpha)
    }

    ctx.fillText(col.glyphs[i], col.x, y)
  }

  ctx.textBaseline = 'alphabetic'
}

function drawScanLine(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = marsA(0.32 * alpha)
  ctx.lineWidth = 1
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(JO_PANEL_X, JO_SCAN_Y)
  ctx.lineTo(JO_PANEL_X + JO_PANEL_W, JO_SCAN_Y)
  ctx.stroke()
  ctx.setLineDash([])

  // Subtle bookend ticks
  ctx.strokeStyle = marsA(0.55 * alpha)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(JO_PANEL_X, JO_SCAN_Y - 3)
  ctx.lineTo(JO_PANEL_X, JO_SCAN_Y + 3)
  ctx.moveTo(JO_PANEL_X + JO_PANEL_W, JO_SCAN_Y - 3)
  ctx.lineTo(JO_PANEL_X + JO_PANEL_W, JO_SCAN_Y + 3)
  ctx.stroke()

  // CV anchor label on the scan line
  ctx.fillStyle = marsA(0.7 * alpha)
  ctx.font = 'bold 8px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('CV MATCH', JO_PANEL_X + 6, JO_SCAN_Y - 7)
  ctx.textBaseline = 'alphabetic'
}

function drawPanelFrame(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = whiteA(0.22 * alpha)
  ctx.lineWidth = 1
  ctx.strokeRect(JO_PANEL_X + 0.5, JO_PANEL_Y + 0.5, JO_PANEL_W - 1, JO_PANEL_H - 1)

  // Header divider
  ctx.strokeStyle = whiteA(0.14 * alpha)
  ctx.beginPath()
  ctx.moveTo(JO_PANEL_X, JO_PANEL_Y + 18)
  ctx.lineTo(JO_PANEL_X + JO_PANEL_W, JO_PANEL_Y + 18)
  ctx.stroke()

  // Header labels
  ctx.fillStyle = whiteA(0.55 * alpha)
  ctx.font = 'bold 8px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('07:00 · DAILY DIGEST', JO_PANEL_X + 8, JO_PANEL_Y + 9)

  ctx.fillStyle = marsA(0.65 * alpha)
  ctx.textAlign = 'right'
  ctx.fillText('3 / 47 LISTINGS', JO_PANEL_X + JO_PANEL_W - 8, JO_PANEL_Y + 9)
  ctx.textBaseline = 'alphabetic'
}

function drawDigestRow(
  ctx: CanvasRenderingContext2D,
  row: JoDigestRow,
  y: number,
  rowAlpha: number,
  alpha: number,
  pulse: number,
) {
  if (rowAlpha <= 0) return

  const eased = easeInOutCubic(Math.min(1, rowAlpha))
  const xOffset = (1 - eased) * -12
  const baseAlpha = eased * alpha
  if (baseAlpha <= 0.01) return

  const titleColor =
    row.band === 'rec' ? marsA(0.92 * baseAlpha) :
    row.band === 'cau' ? whiteA(0.72 * baseAlpha) :
                         whiteA(0.38 * baseAlpha)

  ctx.textBaseline = 'middle'

  // Title
  ctx.fillStyle = titleColor
  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(row.title, JO_PANEL_X + 10 + xOffset, y)

  // Salary chip
  ctx.fillStyle = whiteA(0.5 * baseAlpha)
  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.fillText(row.salary, JO_PANEL_X + 145 + xOffset, y)

  // 5 score dots
  const dotsX = JO_PANEL_X + 195 + xOffset
  const dotR = 2.6
  for (let i = 0; i < 5; i++) {
    const cx = dotsX + i * 9
    const filled = i < row.dots
    if (filled) {
      ctx.fillStyle =
        row.band === 'rec' ? marsA(0.88 * baseAlpha) :
        row.band === 'cau' ? whiteA(0.6 * baseAlpha) :
                             whiteA(0.35 * baseAlpha)
      ctx.beginPath()
      ctx.arc(cx, y, dotR, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = whiteA(0.28 * baseAlpha)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, y, dotR, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Score number (with mars pulse on REC during settle)
  const scoreMul = row.band === 'rec' ? 0.82 + 0.18 * pulse : 1
  ctx.fillStyle =
    row.band === 'rec' ? marsA(0.95 * scoreMul * baseAlpha) :
    row.band === 'cau' ? whiteA(0.72 * baseAlpha) :
                         whiteA(0.35 * baseAlpha)
  ctx.font = 'bold 12px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(row.score, JO_PANEL_X + JO_PANEL_W - 12 + xOffset, y)

  ctx.textBaseline = 'alphabetic'
}

// ── Public API ──

export function drawJobOpsStatic(ctx: CanvasRenderingContext2D) {
  const alpha = 0.7

  // Deterministic static rain (frozen mid-flight)
  const staticCols: JoColumn[] = []
  const sampleGlyphsPerCol: string[][] = [
    ['Senior', 'Python', '90K',    '資深',  'AI',      'PM',     '遠端',  '產品'],
    ['Figma',  'Hybrid', '70K',    'PdM',   '5y',      '中型',   'PM',    'IC'],
    ['Manager','後端',   'AI',     '面議',  'Lead',    'Senior', 'B2B',   '台北'],
    ['Growth', '3y',     '管理職', 'Data',  'Product', '前端',   '新創',  'PM'],
    ['SaaS',   '90K',    'PM',     'Hybrid','遠端',    'PdM',    '中型',  'IC'],
    ['Lead',   'Full-stack','Senior','Figma','Python', '面議',   '5y',    'Manager'],
    ['AI',     'Product','Senior', '70K',   '台北',    'B2B',    '產品',  '90K'],
  ]
  const sampleOffsets = [-12, 8, -22, 14, -4, 22, -18]
  for (let i = 0; i < JO_COLUMN_COUNT; i++) {
    const glyphs = sampleGlyphsPerCol[i]
    staticCols.push({
      x: i * JO_COLUMN_W + JO_COLUMN_W / 2,
      glyphs,
      matchedIdx: collectMatched(glyphs),
      flashTimer: new Map(),
      speed: 0,
      offsetY: sampleOffsets[i],
    })
  }
  staticCols.forEach((col) => drawColumn(ctx, col, alpha))

  drawScanLine(ctx, alpha)
  drawPanelFrame(ctx, alpha)
  JO_DIGEST_ROWS.forEach((row, i) => {
    drawDigestRow(ctx, row, JO_ROW_START_Y + i * JO_ROW_HEIGHT, 1, alpha, 0.5)
  })

  ctx.globalAlpha = 1
}

export function drawJobOpsAnimated(
  ctx: CanvasRenderingContext2D,
  columns: JoColumn[],
  rowAlphas: [number, number, number],
  entranceFade: number,
  outFade: number,
  pulse: number,
) {
  const alpha = entranceFade * outFade

  columns.forEach((col) => drawColumn(ctx, col, alpha))
  drawScanLine(ctx, alpha)
  drawPanelFrame(ctx, alpha)
  rowAlphas.forEach((ra, i) => {
    drawDigestRow(ctx, JO_DIGEST_ROWS[i], JO_ROW_START_Y + i * JO_ROW_HEIGHT, ra, alpha, pulse)
  })

  ctx.globalAlpha = 1
}
