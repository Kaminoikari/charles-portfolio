export const CANVAS_W = 400
export const CANVAS_H = 280

export const ACCENT_MARS_RGB = '232,101,43'
export function whiteA(a: number) { return `rgba(255,255,255,${a})` }
export function marsA(a: number) { return `rgba(${ACCENT_MARS_RGB},${a})` }

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function quadBezier(p0: number, cp: number, p1: number, t: number) {
  const inv = 1 - t
  return inv * inv * p0 + 2 * inv * t * cp + t * t * p1
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
