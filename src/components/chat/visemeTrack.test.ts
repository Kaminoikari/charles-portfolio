import { describe, expect, it } from 'vitest'
import { sampleViseme } from './visemeTrack'
import { VOICE_VISEMES } from './voiceVisemes.gen'
import { VOICE_LINES, VOICE_LINES_EN } from './avatarVoice'

const TRACK = [
  [0.1, 0],
  [0.4, 2],
  [0.9, -1],
  [1.2, 3],
  [1.8, -1],
] as const

describe('sampleViseme', () => {
  it('returns closed before the first segment and after the sentinel', () => {
    expect(sampleViseme(TRACK, 0)).toBe(-1)
    expect(sampleViseme(TRACK, 0.05)).toBe(-1)
    expect(sampleViseme(TRACK, 1.8)).toBe(-1)
    expect(sampleViseme(TRACK, 99)).toBe(-1)
  })

  it('returns the active segment viseme at and between step times', () => {
    expect(sampleViseme(TRACK, 0.1)).toBe(0)
    expect(sampleViseme(TRACK, 0.39)).toBe(0)
    expect(sampleViseme(TRACK, 0.4)).toBe(2)
    expect(sampleViseme(TRACK, 1.0)).toBe(-1)
    expect(sampleViseme(TRACK, 1.5)).toBe(3)
  })
})

describe('VOICE_VISEMES catalogue lockstep', () => {
  const clipKey = (path: string) => path.split('/').pop()!.replace(/\.m4a$/, '')

  it('has a track for every shipped clip in both locale catalogues', () => {
    for (const table of [VOICE_LINES, VOICE_LINES_EN]) {
      for (const clips of Object.values(table)) {
        for (const clip of clips) {
          expect(VOICE_VISEMES[clipKey(clip)], `missing track for ${clip}`).toBeDefined()
        }
      }
    }
  })

  it('every track is time-ascending and ends closed', () => {
    for (const [key, track] of Object.entries(VOICE_VISEMES)) {
      for (let i = 1; i < track.length; i++) {
        expect(track[i][0], `${key} step ${i} not ascending`).toBeGreaterThan(track[i - 1][0])
      }
      expect(track[track.length - 1][1], `${key} must end closed`).toBe(-1)
    }
  })
})
