import { describe, expect, it } from 'vitest'
import { frameDelta } from './particleHero'

describe('frameDelta', () => {
  it('converts a normal frame gap to seconds', () => {
    expect(frameDelta(1016.7, 1000)).toBeCloseTo(0.0167, 4)
  })

  it('caps a long stall so the field cannot teleport', () => {
    // a backgrounded tab comes back with seconds on the clock
    expect(frameDelta(9000, 1000)).toBe(0.05)
  })

  it('never returns a negative delta', () => {
    // The render loop captures performance.now() and only then asks for a
    // frame, and the timestamp that callback receives is when the frame began —
    // which can predate the capture. Measured at -11.2ms on a local page load.
    expect(frameDelta(988.8, 1000)).toBe(0)
  })

  it('keeps a mote radius finite when a frame arrives out of order', () => {
    // The bug this guards: radius is CORE + reach * sqrt(age / life), so an age
    // pushed below zero makes every position NaN and three drops the motes with
    // "computeBoundingSphere(): Computed radius is NaN".
    const life = 3.27
    let age = 0
    age += frameDelta(988.8, 1000)
    expect(Number.isFinite(0.18 + 5.9 * Math.sqrt(age / life))).toBe(true)
  })
})
