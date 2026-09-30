// What the /avatar page offers has to be what the files can do. A button for a
// face the body has no expression group for is a silent no-op in the engine,
// the worst kind of broken button: it lights up and nothing happens. And a
// face a body gained (a new export, a face transplant) should not stay hidden
// behind a stale entry. So UNSUPPORTED_EXPRESSIONS is held to the files here,
// both ways, by reading each offered body's expression groups.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMOTION_RECIPES } from '../chat/avatarMode'
import { OFFERED_VARIANTS, type OfferedVariantId } from '../chat/avatarVariants'
import type { GltfJson } from '../chat/vrmHumanoid'
import {
  DEFAULT_LIGHT,
  DEFAULT_SCENE,
  FIGURE_LIGHT,
  STAGE_EXPRESSIONS,
  STAGE_LIGHTS,
  STAGE_SCENES,
  UNSUPPORTED_EXPRESSIONS,
  expressionsFor,
  lookThumb,
  sceneById,
  sceneLight,
  type StageScene,
} from './stageContent'

const publicFile = (url: string) => path.join(process.cwd(), 'public', url.replace(/^\//, ''))

function gltfOf(url: string): GltfJson {
  const raw = readFileSync(publicFile(url))
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const jsonLength = view.getUint32(12, true)
  return JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLength))) as GltfJson
}

// three-vrm's names for the 0.x presets; any other group keeps its own name.
const V0_PRESETS: Record<string, string> = {
  a: 'aa',
  e: 'ee',
  i: 'ih',
  o: 'oh',
  u: 'ou',
  blink: 'blink',
  joy: 'happy',
  angry: 'angry',
  sorrow: 'sad',
  fun: 'relaxed',
  lookup: 'lookUp',
  lookdown: 'lookDown',
  lookleft: 'lookLeft',
  lookright: 'lookRight',
  blink_l: 'blinkLeft',
  blink_r: 'blinkRight',
  neutral: 'neutral',
}

/** The expression names the engine can drive on a file, as three-vrm registers them. */
function channelsOf(json: GltfJson): Set<string> {
  const ext = (json.extensions ?? {}) as {
    VRM?: { blendShapeMaster?: { blendShapeGroups?: { name: string; presetName?: string }[] } }
    VRMC_vrm?: { expressions?: { preset?: Record<string, unknown>; custom?: Record<string, unknown> } }
  }
  if (ext.VRM) {
    return new Set(
      (ext.VRM.blendShapeMaster?.blendShapeGroups ?? []).map((g) => V0_PRESETS[g.presetName ?? ''] ?? g.name),
    )
  }
  const expr = ext.VRMC_vrm?.expressions ?? {}
  return new Set([...Object.keys(expr.preset ?? {}), ...Object.keys(expr.custom ?? {})])
}

describe('stage expressions', () => {
  it('offers only faces the engine has a recipe for, each once', () => {
    expect(new Set(STAGE_EXPRESSIONS).size).toBe(STAGE_EXPRESSIONS.length)
    for (const e of STAGE_EXPRESSIONS) expect(EMOTION_RECIPES[e], e).toBeDefined()
  })

  for (const { id, url } of OFFERED_VARIANTS) {
    it(`lists exactly the faces ${id} can make`, () => {
      const channels = channelsOf(gltfOf(url))
      const cannot = STAGE_EXPRESSIONS.filter((e) =>
        EMOTION_RECIPES[e].channels.some(([ch]) => !channels.has(ch)),
      )
      expect([...(UNSUPPORTED_EXPRESSIONS[id as OfferedVariantId] ?? [])].sort()).toEqual([...cannot].sort())
      expect(expressionsFor(id)).toEqual(STAGE_EXPRESSIONS.filter((e) => !cannot.includes(e)))
    })
  }

  it('names only offered looks in the exceptions', () => {
    const offered = new Set<string>(OFFERED_VARIANTS.map((v) => v.id))
    for (const id of Object.keys(UNSUPPORTED_EXPRESSIONS)) expect(offered.has(id), id).toBe(true)
  })
})

describe('stage assets', () => {
  it('has a portrait for every offered look', () => {
    for (const { id } of OFFERED_VARIANTS) {
      expect(existsSync(publicFile(lookThumb(id))), `${lookThumb(id)}: run scripts/avatar-thumbs.mjs`).toBe(true)
    }
  })

  it('serves every picture and tile it lists, one per time of day', () => {
    expect(new Set(STAGE_SCENES.map((s) => s.id)).size).toBe(STAGE_SCENES.length)
    for (const s of STAGE_SCENES) {
      expect(new Set(s.lights.map((l) => l.id)).size, s.id).toBe(s.lights.length)
      for (const l of s.lights) {
        expect(existsSync(publicFile(l.src)), l.src).toBe(true)
        expect(existsSync(publicFile(l.thumb)), l.thumb).toBe(true)
      }
      expect(s.focusX, s.id).toBeGreaterThanOrEqual(0)
      expect(s.focusX, s.id).toBeLessThanOrEqual(100)
    }
    // Only `none` goes without a picture.
    expect(STAGE_SCENES.filter((s) => s.lights.length === 0).map((s) => s.id)).toEqual(['none'])
  })

  it('ships no picture it does not list', () => {
    const listed = new Set(STAGE_SCENES.flatMap((s) => s.lights.flatMap((l) => [l.src, l.thumb])))
    const dir = publicFile('/avatar/scenes')
    const served = [
      ...readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => `/avatar/scenes/${f}`),
      ...readdirSync(path.join(dir, 'thumbs')).map((f) => `/avatar/scenes/thumbs/${f}`),
    ]
    for (const f of served) expect(listed.has(f), `${f} is served but no scene lists it`).toBe(true)
  })

  it('plays every clip it lists, each with its first frame as the poster', () => {
    const clips = STAGE_SCENES.flatMap((s) => s.lights).filter((l) => l.video)
    expect(clips.length).toBeGreaterThan(0)
    for (const l of clips) expect(existsSync(publicFile(l.video!)), l.video).toBe(true)
  })

  it('ships no clip it does not list', () => {
    const listed = new Set(STAGE_SCENES.flatMap((s) => s.lights.flatMap((l) => (l.video ? [l.video] : []))))
    for (const f of readdirSync(publicFile('/avatar/scenes/video'))) {
      expect(listed.has(`/avatar/scenes/video/${f}`), `${f} is served but no scene lists it`).toBe(true)
    }
  })

  it('opens on a scene with a picture at the default time of day', () => {
    const light = sceneLight(sceneById(DEFAULT_SCENE), DEFAULT_LIGHT)
    expect(light?.id).toBe(DEFAULT_LIGHT)
  })
})

describe('sceneLight', () => {
  // No shipped scene has more than one time of day now, so the rule is held
  // on a scene built for it, out of the same parts the list uses.
  const relit: StageScene = {
    id: 'library',
    focusX: 50,
    lights: (['day', 'night'] as const).map((id) => ({ id, src: `/${id}.webp`, thumb: `/t-${id}.webp` })),
  }

  it('keeps the chosen time of day where the scene has it', () => {
    expect(sceneLight(relit, 'night')?.id).toBe('night')
    expect(sceneLight(relit, 'day')?.id).toBe('day')
  })

  it("falls back to the scene's own picture where it does not", () => {
    expect(sceneLight(relit, 'sunset')?.id).toBe('day')
    expect(sceneLight(sceneById('library'), 'day')?.id).toBe('night-lit')
    expect(sceneLight(sceneById('none'), 'day')).toBeNull()
  })

  it('has a figure filter for every time of day', () => {
    for (const id of STAGE_LIGHTS) expect(FIGURE_LIGHT[id], id).toBeTruthy()
  })
})
