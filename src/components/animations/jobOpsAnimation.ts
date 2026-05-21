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
export const JO_COLUMN_COUNT = 5
// Rain columns are confined to the digest panel's horizontal span (with
// inner padding) so falling tokens never spill past the panel edges.
export const JO_RAIN_PAD = 10
export const JO_RAIN_LEFT = JO_PANEL_X + JO_RAIN_PAD
export const JO_RAIN_W = JO_PANEL_W - JO_RAIN_PAD * 2
export const JO_COLUMN_W = JO_RAIN_W / JO_COLUMN_COUNT
export const JO_GLYPH_H = 22
export const JO_RAIN_TOP = -40
export const JO_RAIN_BOTTOM = 148
export const JO_FLASH_DURATION = 0.45

export const JO_ENTRANCE_DURATION = 0.5
export const JO_RAIN_DURATION = 1.6
export const JO_ROW_DURATION = 1.2
export const JO_ROW_MATERIALIZE = 0.45
export const JO_SETTLE_DURATION = 1.4
export const JO_FADEOUT_DURATION = 0.5

// Single shared falling speed so every column drops in parallel
export const JO_RAIN_SPEED = 34

// Per-column token vocabularies. Each column visually represents one
// dimension of a 104 listing, so its rain content stays semantically
// consistent (titles, industry, AI keywords, salary, location).
const JO_COLUMN_POOLS: string[][] = [
  // 0 — 職位名稱
  ['Senior PM', 'Growth PM', 'AI PM', 'TPM', 'Lead PM', 'Staff PM', 'Group PM', 'Principal', 'Director', 'Head PM', 'Sr. PM', 'PdM', 'Manager', 'Architect'],
  // 1 — 產業
  ['Fintech', 'SaaS', 'B2B', 'B2C', 'Platform', 'AdTech', 'EdTech', 'HealthTech', 'Crypto', 'Web3', 'Gaming', 'MarTech', 'DevTools', 'Mobility'],
  // 2 — AI 關鍵字
  ['AI', 'ML', 'LLM', 'RAG', 'GPT', 'Vision', 'NLP', 'Agent', 'Python', 'PyTorch', 'Embedding', 'Prompt', 'TensorFlow', 'Generative'],
  // 3 — 薪資
  ['120K', '150K', '180K', '200K', '240K', '300K', '+Equity', '+Stock', '+Bonus', '150-200K', '180-240K', 'RSU', 'Sign-on'],
  // 4 — 地點
  ['Taipei', 'Hsinchu', 'Taoyuan', 'Tokyo', 'Singapore', 'Remote', 'Hybrid', 'APAC', 'Tainan', 'Kaohsiung', 'Seoul', 'Hong Kong', 'Onsite', 'Shanghai'],
]

// Tokens flagged as CV signals; they flash mars when crossing the scan line.
// At least one per column so every stream gets a chance to flash.
const CV_MATCHED_SET = new Set([
  'Senior PM', 'AI PM',
  'Fintech', 'Platform',
  'AI', 'LLM', 'Agent',
  '180K', '200K',
  'Remote', 'Taipei',
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
  { title: 'Senior AI PM', salary: '180K', dots: 4, score: '4.6', band: 'rec' },
  { title: 'Growth PM',    salary: '150K', dots: 3, score: '3.8', band: 'cau' },
  { title: 'Platform PM',  salary: '120K', dots: 2, score: '2.9', band: 'skip' },
]

function shuffled(arr: readonly string[]): string[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function pickColumnGlyphs(colIdx: number, count: number): string[] {
  return shuffled(JO_COLUMN_POOLS[colIdx]).slice(0, count)
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
    const len = 5 + Math.floor(Math.random() * 3)
    const glyphs = pickColumnGlyphs(i, len)
    cols.push({
      x: JO_RAIN_LEFT + i * JO_COLUMN_W + JO_COLUMN_W / 2,
      glyphs,
      matchedIdx: collectMatched(glyphs),
      flashTimer: new Map(),
      speed: JO_RAIN_SPEED,
      offsetY: JO_RAIN_TOP,
    })
  }
  return cols
}

export function updateColumns(cols: JoColumn[], dt: number) {
  for (const col of cols) {
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

function drawPanelFramePlaceholder(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.strokeStyle = whiteA(0.22 * alpha)
  ctx.lineWidth = 1
  ctx.strokeRect(JO_PANEL_X + 0.5, JO_PANEL_Y + 0.5, JO_PANEL_W - 1, JO_PANEL_H - 1)

  ctx.strokeStyle = whiteA(0.14 * alpha)
  ctx.beginPath()
  ctx.moveTo(JO_PANEL_X, JO_PANEL_Y + 18)
  ctx.lineTo(JO_PANEL_X + JO_PANEL_W, JO_PANEL_Y + 18)
  ctx.stroke()

  ctx.fillStyle = whiteA(0.5 * alpha)
  ctx.font = 'bold 8px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('07:00 · DAILY DIGEST', JO_PANEL_X + 8, JO_PANEL_Y + 9)

  ctx.fillStyle = whiteA(0.4 * alpha)
  ctx.textAlign = 'right'
  ctx.fillText('— / — LISTINGS', JO_PANEL_X + JO_PANEL_W - 8, JO_PANEL_Y + 9)
  ctx.textBaseline = 'alphabetic'
}

function drawDigestRowPlaceholder(ctx: CanvasRenderingContext2D, y: number, alpha: number) {
  // Title bar
  ctx.fillStyle = whiteA(0.18 * alpha)
  ctx.fillRect(JO_PANEL_X + 10, y - 3, 110, 5)

  // Salary chip
  ctx.fillStyle = whiteA(0.14 * alpha)
  ctx.fillRect(JO_PANEL_X + 140, y - 3, 32, 5)

  // 5 hollow score dots
  ctx.strokeStyle = whiteA(0.25 * alpha)
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const cx = JO_PANEL_X + 195 + i * 9
    ctx.beginPath()
    ctx.arc(cx, y, 2.6, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Score number slot
  ctx.fillStyle = whiteA(0.16 * alpha)
  ctx.fillRect(JO_PANEL_X + JO_PANEL_W - 26, y - 3, 14, 5)
}

export function drawJobOpsStatic(ctx: CanvasRenderingContext2D) {
  const alpha = 0.5

  drawPanelFramePlaceholder(ctx, alpha)
  for (let i = 0; i < JO_DIGEST_ROWS.length; i++) {
    drawDigestRowPlaceholder(ctx, JO_ROW_START_Y + i * JO_ROW_HEIGHT, alpha)
  }

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
