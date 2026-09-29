// What the /avatar page offers has to be what the files can do. A button for a
// face the body has no expression group for is a silent no-op in the engine,
// the worst kind of broken button: it lights up and nothing happens. And a
// face a body gained (a new export, a face transplant) should not stay hidden
// behind a stale entry. So UNSUPPORTED_EXPRESSIONS is held to the files here,
// both ways, by reading each offered body's expression groups.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EMOTION_RECIPES } from '../chat/avatarMode'
import { OFFERED_VARIANTS, type OfferedVariantId } from '../chat/avatarVariants'
import type { GltfJson } from '../chat/vrmHumanoid'
import {
  DEFAULT_SCENE,
  STAGE_EXPRESSIONS,
  STAGE_SCENES,
  UNSUPPORTED_EXPRESSIONS,
  expressionsFor,
  lookThumb,
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

  it('serves every scene it lists and defaults to one of them', () => {
    expect(new Set(STAGE_SCENES.map((s) => s.id)).size).toBe(STAGE_SCENES.length)
    expect(STAGE_SCENES.some((s) => s.id === DEFAULT_SCENE)).toBe(true)
    for (const s of STAGE_SCENES) if (s.src) expect(existsSync(publicFile(s.src)), s.src).toBe(true)
  })
})
