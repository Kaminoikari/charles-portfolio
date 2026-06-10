import { useEffect, useRef } from 'react'

// The loading mark: a small glowing Mobius band slowly tumbling on black,
// rendered live as a parametric surface on a 2D canvas so the glow stays
// crisp on retina screens.

const BAND_RADIUS = 1
const BAND_HALF_WIDTH = 0.34
const BAND_STRANDS = 7          // longitudinal curves that suggest the band surface
const EDGE_SEGMENTS = 240       // samples along the full (4π) boundary loop
const CAMERA_DISTANCE = 3.2
const SPIN_SPEED_X = 0.45       // rad/s
const SPIN_SPEED_Y = 0.7        // rad/s

type Vec3 = [number, number, number]

function mobiusPoint(u: number, v: number): Vec3 {
  const r = BAND_RADIUS + v * Math.cos(u / 2)
  return [r * Math.cos(u), r * Math.sin(u), v * Math.sin(u / 2)]
}

function rotated(p: Vec3, ax: number, ay: number): Vec3 {
  const [x0, y0, z0] = p
  const cy = Math.cos(ay), sy = Math.sin(ay)
  const x1 = x0 * cy + z0 * sy
  const z1 = -x0 * sy + z0 * cy
  const cx = Math.cos(ax), sx = Math.sin(ax)
  const y2 = y0 * cx - z1 * sx
  const z2 = y0 * sx + z1 * cx
  return [x1, y2, z2]
}

export default function MobiusLoader({ size = 100 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return   // jsdom and very old browsers; the gate copy still communicates loading

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const half = size * dpr * 0.5
    const scale = half * 0.62

    const drawStrand = (v: number, ax: number, ay: number) => {
      // v = ±half-width follows the single boundary edge (period 4π); inner strands
      // use the same period so each polyline closes on itself.
      ctx.beginPath()
      for (let i = 0; i <= EDGE_SEGMENTS; i++) {
        const u = (i / EDGE_SEGMENTS) * Math.PI * 4
        const p = rotated(mobiusPoint(u, v), ax, ay)
        const persp = CAMERA_DISTANCE / (CAMERA_DISTANCE - p[2])
        const x = half + p[0] * scale * persp
        const y = half + p[1] * scale * persp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    const render = (timeMs: number) => {
      const t = timeMs / 1000
      const ax = t * SPIN_SPEED_X
      const ay = t * SPIN_SPEED_Y
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineJoin = 'round'
      ctx.shadowColor = 'rgba(255,255,255,0.9)'
      for (let s = 0; s < BAND_STRANDS; s++) {
        const v = (s / (BAND_STRANDS - 1) * 2 - 1) * BAND_HALF_WIDTH
        const isEdge = s === 0 || s === BAND_STRANDS - 1
        ctx.strokeStyle = isEdge ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.18)'
        ctx.lineWidth = (isEdge ? 1.4 : 0.8) * dpr
        ctx.shadowBlur = (isEdge ? 9 : 4) * dpr
        drawStrand(v, ax, ay)
      }
    }

    if (reduced) {
      render(1400)   // a fixed, visually balanced pose instead of motion
      return
    }

    let raf = 0
    const loop = (timeMs: number) => {
      render(timeMs)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      data-testid="mobius-loader"
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  )
}
