import { whiteA, marsA, quadBezier, easeInOutCubic } from './shared'

// ─── Product Playbook: Spec Assembly Animation ───
const PB_FRAMEWORKS = [
  { label: 'JTBD', y: 45, targetSection: 0 },
  { label: 'Persona', y: 108, targetSection: 1 },
  { label: 'RICE', y: 162, targetSection: 2 },
  { label: 'PRD', y: 218, targetSection: 3 },
]
const PB_BADGE_X = 45
const PB_DOC_X = 180
const PB_DOC_Y = 20
const PB_DOC_W = 195
const PB_DOC_H = 240
const PB_SECTIONS = [
  { label: 'Overview', y: 52, lines: 2 },
  { label: 'User Stories', y: 102, lines: 3 },
  { label: 'Architecture', y: 152, lines: 2 },
  { label: 'Dev Handoff', y: 202, lines: 2 },
]

export const PB_ENTRANCE_DURATION = 0.8
export const PB_SECTION_FILL_DURATION = 1.2
export const PB_PAUSE_DURATION = 1.5
export const PB_FADE_DURATION = 0.5

export type PbMetrics = { tw: number; bw: number }[]

export function computePbMetrics(ctx: CanvasRenderingContext2D): PbMetrics {
  ctx.font = 'bold 9px monospace'
  return PB_FRAMEWORKS.map(fw => {
    const tw = ctx.measureText(fw.label).width
    return { tw, bw: tw + 14 }
  })
}

export function drawPlaybookStatic(ctx: CanvasRenderingContext2D, metrics: PbMetrics) {
  ctx.font = 'bold 9px monospace'
  PB_FRAMEWORKS.forEach((fw, fi) => {
    const { tw, bw } = metrics[fi]
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = whiteA(0.35)
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.roundRect(PB_BADGE_X - bw / 2, fw.y - 9, bw, 18, 3)
    ctx.stroke()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = whiteA(0.85)
    ctx.fillText(fw.label, PB_BADGE_X - tw / 2, fw.y + 3)

    const sec = PB_SECTIONS[fw.targetSection]
    const startX = PB_BADGE_X + bw / 2 + 4
    const endX = PB_DOC_X
    const cpX = (startX + endX) / 2 + 10
    const cpY = (fw.y + sec.y) / 2
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = whiteA(0.3)
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    for (let s = 0; s <= 20; s++) {
      const t = s / 20
      const x = quadBezier(startX, cpX, endX, t)
      const y = quadBezier(fw.y, cpY, sec.y, t)
      if (s === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
    }
    ctx.stroke()
    ctx.setLineDash([])
  })

  ctx.globalAlpha = 0.25
  ctx.strokeStyle = whiteA(0.45)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X, PB_DOC_Y, PB_DOC_W, PB_DOC_H, 4)
  ctx.stroke()

  ctx.globalAlpha = 0.08
  ctx.fillStyle = whiteA(1)
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X, PB_DOC_Y, PB_DOC_W, 22, [4, 4, 0, 0])
  ctx.fill()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = whiteA(0.9)
  ctx.font = 'bold 8px monospace'
  ctx.fillText('SPEC.md', PB_DOC_X + 8, PB_DOC_Y + 14)

  PB_SECTIONS.forEach((sec) => {
    ctx.globalAlpha = 0.18
    ctx.fillStyle = whiteA(0.7)
    ctx.font = 'bold 9px monospace'
    ctx.fillText(sec.label, PB_DOC_X + 12, sec.y)
    for (let i = 0; i < sec.lines; i++) {
      ctx.globalAlpha = 0.08
      ctx.fillStyle = whiteA(0.5)
      ctx.beginPath()
      ctx.roundRect(PB_DOC_X + 12, sec.y + 6 + i * 12, PB_DOC_W - 30 - (i % 2) * 20, 4, 2)
      ctx.fill()
    }
  })
  ctx.globalAlpha = 1
}

export function drawPlaybookAnimated(
  ctx: CanvasRenderingContext2D,
  progress: number,
  fadeAlpha: number,
  time: number,
  entranceProgress: number,
  metrics: PbMetrics,
) {
  const totalSections = PB_SECTIONS.length
  const activeSectionIndex = Math.min(Math.floor(progress * totalSections), totalSections - 1)
  const sectionLocalProgress = progress * totalSections - activeSectionIndex

  const docEntrance = Math.min(1, Math.max(0, (entranceProgress - 0.3) / 0.4))

  // ── Framework badges ──
  ctx.font = 'bold 9px monospace'
  PB_FRAMEWORKS.forEach((fw, fi) => {
    const { tw, bw } = metrics[fi]

    const badgeEntrance = Math.min(1, Math.max(0, (entranceProgress - fi * 0.12) / 0.2))
    const offsetY = (1 - badgeEntrance) * 6
    const byAdj = fw.y + offsetY

    const badgeActive = progress > 0 && fi <= activeSectionIndex + (sectionLocalProgress > 0.1 ? 1 : 0)
    const pulse = badgeActive ? 0.6 + 0.3 * Math.sin(time * 2.5 + fi * 1.2) : 0
    const baseAlpha = badgeActive ? 0.55 + pulse * 0.25 : 0.35
    const alpha = baseAlpha * fadeAlpha * badgeEntrance

    ctx.globalAlpha = alpha
    ctx.strokeStyle = badgeActive ? marsA(0.5 + pulse * 0.3) : whiteA(0.4)
    ctx.lineWidth = badgeActive ? 1 : 0.8
    ctx.beginPath()
    ctx.roundRect(PB_BADGE_X - bw / 2, byAdj - 9, bw, 18, 3)
    ctx.stroke()

    if (badgeActive) {
      ctx.globalAlpha = 0.06 * fadeAlpha * badgeEntrance
      ctx.fillStyle = marsA(1)
      ctx.beginPath()
      ctx.roundRect(PB_BADGE_X - bw / 2, byAdj - 9, bw, 18, 3)
      ctx.fill()
    }

    ctx.globalAlpha = (badgeActive ? 0.9 : 0.4) * fadeAlpha * badgeEntrance
    ctx.fillStyle = badgeActive ? whiteA(0.95) : whiteA(0.7)
    ctx.fillText(fw.label, PB_BADGE_X - tw / 2, byAdj + 3)

    if (badgeActive && badgeEntrance >= 1) {
      const sec = PB_SECTIONS[fw.targetSection]
      const lineProgress = fi < activeSectionIndex ? 1
        : fi === activeSectionIndex ? Math.min(1, sectionLocalProgress * 1.5)
        : Math.min(1, Math.max(0, sectionLocalProgress - 0.5) * 3)

      if (lineProgress > 0) {
        const startX = PB_BADGE_X + bw / 2 + 4
        const endX = PB_DOC_X
        const cpX = (startX + endX) / 2 + 10
        const cpY = (fw.y + sec.y) / 2

        ctx.globalAlpha = 0.3 * fadeAlpha * lineProgress
        ctx.strokeStyle = marsA(0.6)
        ctx.lineWidth = 0.7
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        const steps = 20
        const exactEnd = steps * lineProgress
        const drawSteps = Math.floor(exactEnd)
        for (let s = 0; s <= drawSteps; s++) {
          const t = s / steps
          const x = quadBezier(startX, cpX, endX, t)
          const y = quadBezier(fw.y, cpY, sec.y, t)
          if (s === 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
        }
        if (exactEnd - drawSteps > 0.01 && drawSteps < steps) {
          const t = exactEnd / steps
          ctx.lineTo(quadBezier(startX, cpX, endX, t), quadBezier(fw.y, cpY, sec.y, t))
        }
        ctx.stroke()
        ctx.setLineDash([])

        if (lineProgress > 0.8) {
          const dotT = lineProgress
          const dotX = quadBezier(startX, cpX, endX, dotT)
          const dotY = quadBezier(fw.y, cpY, sec.y, dotT)
          ctx.globalAlpha = 0.5 * fadeAlpha
          ctx.fillStyle = marsA(0.8)
          ctx.beginPath()
          ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  })

  // ── Document ──
  const da = docEntrance * fadeAlpha

  ctx.globalAlpha = 0.4 * da
  ctx.strokeStyle = whiteA(0.5)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X, PB_DOC_Y, PB_DOC_W, PB_DOC_H, 4)
  ctx.stroke()

  ctx.globalAlpha = 0.08 * da
  ctx.fillStyle = whiteA(1)
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X, PB_DOC_Y, PB_DOC_W, 22, [4, 4, 0, 0])
  ctx.fill()

  ctx.globalAlpha = 0.55 * da
  ctx.fillStyle = whiteA(0.9)
  ctx.font = 'bold 8px monospace'
  ctx.fillText('SPEC.md', PB_DOC_X + 8, PB_DOC_Y + 14)

  for (let d = 0; d < 3; d++) {
    ctx.globalAlpha = 0.35 * da
    ctx.fillStyle = d === 0 ? marsA(0.6) : whiteA(0.4)
    ctx.beginPath()
    ctx.arc(PB_DOC_X + PB_DOC_W - 12 - d * 10, PB_DOC_Y + 11, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Sections ──
  PB_SECTIONS.forEach((sec, si) => {
    const isComplete = si < activeSectionIndex
    const isActive = si === activeSectionIndex && progress > 0
    const sProgress = isComplete ? 1 : isActive ? sectionLocalProgress : 0

    const headerAlpha = isComplete ? 0.75 : isActive ? 0.35 + sProgress * 0.45 : 0.12
    ctx.globalAlpha = headerAlpha * da
    ctx.fillStyle = isComplete ? marsA(0.85) : whiteA(0.8)
    ctx.font = 'bold 9px monospace'
    ctx.fillText(sec.label, PB_DOC_X + 12, sec.y)

    if (isComplete) {
      ctx.globalAlpha = 0.85 * da
      ctx.strokeStyle = marsA(0.9)
      ctx.lineWidth = 1.5
      const cx = PB_DOC_X + PB_DOC_W - 20
      const cy = sec.y - 4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + 3, cy + 4)
      ctx.lineTo(cx + 8, cy - 3)
      ctx.stroke()
    }

    for (let i = 0; i < sec.lines; i++) {
      const lineT = i / sec.lines
      const lineProgress = isComplete ? 1 : isActive ? Math.max(0, (sProgress - lineT) * sec.lines) : 0
      const clampedProgress = Math.min(1, lineProgress)
      const fullW = PB_DOC_W - 30 - (i % 2) * 20
      const w = fullW * clampedProgress
      const ly = sec.y + 6 + i * 12

      ctx.globalAlpha = 0.05 * da
      ctx.fillStyle = whiteA(0.5)
      ctx.beginPath()
      ctx.roundRect(PB_DOC_X + 12, ly, fullW, 4, 2)
      ctx.fill()

      if (clampedProgress > 0) {
        ctx.globalAlpha = (0.18 + clampedProgress * 0.28) * da
        ctx.fillStyle = marsA(0.6)
        ctx.beginPath()
        ctx.roundRect(PB_DOC_X + 12, ly, w, 4, 2)
        ctx.fill()
      }

      if (isActive && clampedProgress > 0 && clampedProgress < 1) {
        if (Math.sin(time * 3.7) > 0) {
          ctx.globalAlpha = 0.75 * da
          ctx.fillStyle = marsA(0.9)
          ctx.beginPath()
          ctx.rect(PB_DOC_X + 12 + w, ly - 1, 1.5, 6)
          ctx.fill()
        }
      }
    }
  })

  // ── Progress bar (eased) ──
  const barY = PB_DOC_Y + PB_DOC_H - 8
  const barW = PB_DOC_W - 24
  ctx.globalAlpha = 0.08 * da
  ctx.fillStyle = whiteA(0.5)
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X + 12, barY, barW, 3, 1.5)
  ctx.fill()

  const easedProgress = easeInOutCubic(progress)
  ctx.globalAlpha = 0.55 * da
  ctx.fillStyle = marsA(0.7)
  ctx.beginPath()
  ctx.roundRect(PB_DOC_X + 12, barY, barW * easedProgress, 3, 1.5)
  ctx.fill()

  ctx.globalAlpha = 1
}
