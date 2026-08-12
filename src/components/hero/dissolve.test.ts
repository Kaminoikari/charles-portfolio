import { describe, it, expect } from 'vitest'

import { scrollDissolveTarget, dissolveAliveEdge, effectiveDissolveTarget } from './faceHero'

// Scroll-out disintegration: as the visitor scrolls past the hero the head erodes
// into the dust field, and reassembles on the way back. These lock the two pure
// pieces — the scroll→progress mapping and the per-vertex aliveness/front-glow —
// that both the CPU colour path and the shaders build on.
describe('scrollDissolveTarget', () => {
  const H = 900 // a hero viewport height in px

  it('is 0 at rest and within the small-scroll dead zone', () => {
    expect(scrollDissolveTarget(0, H)).toBe(0)
    expect(scrollDissolveTarget(0.08 * H, H)).toBe(0)
  })

  it('reaches 1 while the hero is still partially visible, and stays there', () => {
    expect(scrollDissolveTarget(0.7 * H, H)).toBe(1)
    expect(scrollDissolveTarget(1.5 * H, H)).toBe(1)
  })

  it('rises monotonically through the transition band', () => {
    let prev = -1
    for (let f = 0.15; f <= 0.55; f += 0.05) {
      const v = scrollDissolveTarget(f * H, H)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
    expect(scrollDissolveTarget(0.2 * H, H)).toBeGreaterThan(0)
    expect(scrollDissolveTarget(0.55 * H, H)).toBeLessThan(1)
  })

  it('is clamped to [0,1] and guards a degenerate hero height', () => {
    expect(scrollDissolveTarget(-50, H)).toBe(0)
    expect(scrollDissolveTarget(0.4 * H, 0)).toBe(0)
  })
})

describe('dissolveAliveEdge', () => {
  it('keeps every vertex fully alive with no front glow at progress 0', () => {
    for (const ny of [0, 0.3, 0.7, 1]) {
      for (const rand of [0, 0.5, 1]) {
        const { alive, edge } = dissolveAliveEdge(ny, rand, 0)
        expect(alive).toBe(1)
        expect(edge).toBe(0)
      }
    }
  })

  it('kills every vertex at progress 1', () => {
    for (const ny of [0, 0.3, 0.7, 1]) {
      for (const rand of [0, 0.5, 1]) {
        expect(dissolveAliveEdge(ny, rand, 1).alive).toBeLessThan(0.02)
      }
    }
  })

  it('erodes the top of the head before the bottom', () => {
    const top = dissolveAliveEdge(0.9, 0.5, 0.4).alive
    const bottom = dissolveAliveEdge(0.1, 0.5, 0.4).alive
    expect(top).toBeLessThan(bottom)
  })

  it('fades each vertex monotonically as progress advances', () => {
    for (const ny of [0.2, 0.5, 0.8]) {
      let prev = 2
      for (let dis = 0; dis <= 1.001; dis += 0.05) {
        const { alive } = dissolveAliveEdge(ny, 0.5, dis)
        expect(alive).toBeLessThanOrEqual(prev + 1e-9)
        prev = alive
      }
    }
  })

  it('extinguishes the front glow everywhere once fully dissolved', () => {
    // regression: the noisiest bottom vertices (highest death key) used to keep a
    // permanent cyan residue at progress 1 because the gaussian tail never closed
    for (const ny of [0, 0.05, 0.3, 0.7, 1]) {
      for (const rand of [0, 0.5, 1]) {
        expect(dissolveAliveEdge(ny, rand, 1).edge).toBeLessThan(0.02)
      }
    }
    // the end-gate must not eat the mid-dissolve flash: a low vertex still gets
    // a strong glow at its own death front (key ≈ 0.725 for ny 0.1 / rand 0.5)
    expect(dissolveAliveEdge(0.1, 0.5, 0.76).edge).toBeGreaterThan(0.8)
  })

  it('peaks the front glow where the vertex is actively dying, not before or after', () => {
    // sample one mid-head vertex across the whole progress range: the glow must
    // rise to a clear peak strictly inside (0,1) and be near-dark far from it,
    // and that peak must sit where the vertex is mid-death (alive ≈ 0.5).
    const ny = 0.5, rand = 0.5
    let peakDis = 0, peakEdge = -1
    for (let dis = 0; dis <= 1.001; dis += 0.01) {
      const { edge } = dissolveAliveEdge(ny, rand, dis)
      expect(edge).toBeGreaterThanOrEqual(0)
      expect(edge).toBeLessThanOrEqual(1)
      if (edge > peakEdge) { peakEdge = edge; peakDis = dis }
    }
    expect(peakEdge).toBeGreaterThan(0.8)
    expect(peakDis).toBeGreaterThan(0.05)
    expect(peakDis).toBeLessThan(0.95)
    const aliveAtPeak = dissolveAliveEdge(ny, rand, peakDis).alive
    expect(aliveAtPeak).toBeGreaterThan(0.05)
    expect(aliveAtPeak).toBeLessThan(0.95)
    expect(dissolveAliveEdge(ny, rand, Math.min(1, peakDis + 0.4)).edge).toBeLessThan(0.05)
  })
})

describe('effectiveDissolveTarget', () => {
  const H = 900

  it('is always 0 under reduced motion, at any scroll depth', () => {
    for (const f of [0, 0.2, 0.4, 0.62, 1.5]) {
      expect(effectiveDissolveTarget(true, f * H, H)).toBe(0)
    }
  })

  it('matches the scroll mapping when motion is allowed', () => {
    for (const f of [0, 0.2, 0.4, 0.62, 1.5]) {
      expect(effectiveDissolveTarget(false, f * H, H)).toBe(scrollDissolveTarget(f * H, H))
    }
    expect(effectiveDissolveTarget(false, 0.4 * H, H)).toBeGreaterThan(0)
  })
})
