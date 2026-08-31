import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { RIM_FALLBACK, rimBase } from './avatarGuideEngine'

// Who owns the rim colour.
//
// The widget used to paint every body with one site accent (mars orange), which
// is right for the body it was picked against and wrong for any other: on a
// near-white blouse and a near-black cardigan the same accent is a rust glow
// down every fold. So the hue moved to the model, which states it in MToon's
// `_RimColor`, and the site now only decides how hard it burns.
//
// None of this is visible to the pipeline's own renders: the numpy gate
// renderer is unlit and draws neither rim nor outline, so a wrong rim survives
// every gate and shows up only in a browser. That is why the fallback rule gets
// a test of its own rather than a comment.
const SOURCE = readFileSync(
  path.join(process.cwd(), 'src', 'components', 'chat', 'avatarGuideEngine.ts'),
  'utf8',
)

describe('rim colour ownership', () => {
  it('draws a body in the colour it states', () => {
    const mint = new THREE.Color(0x85c7c7)
    expect(rimBase(mint).getHex()).toBe(mint.getHex())
  })

  it('hands black back to the site rather than reading it as "no rim"', () => {
    // three-vrm imports an absent VRM0 `_RimColor` as black, so black is the
    // one value that cannot mean a choice. Treating it as a stated colour is
    // what would silently un-rim every body that predates this field.
    expect(rimBase(new THREE.Color(0x000000)).getHex()).toBe(RIM_FALLBACK)
    expect(rimBase(undefined).getHex()).toBe(RIM_FALLBACK)
  })

  it('returns a copy, so the per-frame scale cannot eat the base', () => {
    // The loop writes `base * strength` back into the material every frame. If
    // the base aliased the material's own factor, frame two would scale the
    // already-scaled colour and she would fade to black over a second or two.
    const stated = new THREE.Color(0x85c7c7)
    const captured = rimBase(stated)
    captured.multiplyScalar(0.22)
    expect(stated.getHex()).toBe(0x85c7c7)
  })

  it('asks the model, rather than capturing a constant', () => {
    // Structural, and deliberately so: the capture runs inside the GLTF load
    // callback of an engine that builds a WebGLRenderer in its first lines, so
    // jsdom cannot reach it. Reintroducing `base: SOME_CONSTANT.clone()` here
    // leaves every other test in this file green.
    expect(SOURCE, 'the captured base must come from the material').toMatch(
      /base:\s*rimBase\(mtoon\.parametricRimColorFactor\)/,
    )
  })

  it('scales each material by its own base in the frame loop', () => {
    // The other half of the same wiring: capturing per material is pointless if
    // the loop then writes one shared colour over all of them.
    expect(SOURCE, 'the frame loop must scale the per-material base').toMatch(
      /for \(const \{ m, base \} of mtoons\)[\s\S]{0,160}rimScratch\.copy\(base\)\.multiplyScalar\(rimScale\)/,
    )
  })
})
