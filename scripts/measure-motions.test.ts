/* eslint-disable no-irregular-whitespace, no-regex-spaces --
   The report is written in Chinese and aligns its columns with the ideographic
   space U+3000 and with runs of ordinary spaces. The patterns below match that
   output literally, so the "irregular" whitespace is the thing under test. */
// The report has to be able to say no.
//
// A tool that sweeps ten clips and prints "everything fits" is worthless unless
// something makes it print the opposite, and the shipped avatar can never
// provide that: the unit suite already holds it to zero violations, so running
// the report on it only ever produces the happy answer. So the negative case is
// built here — the same skeleton scaled up, with the clips untouched, which is
// exactly the situation the tool exists for: a motion pack measured against one
// body being asked to run on another.
//
// Both directions are asserted. The positive case is also a cross-check against
// numbers this file never chose: `dance` ships with a declared face waiver of
// 0.29, and the sweep has to land above it without anyone telling it so.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { beforeAll, describe, expect, it } from 'vitest'

import { CLEARANCE } from '../src/components/chat/clearance/vroid-sample-b'
import { measure, type Report } from './measure-motions'

const SHIPPED = path.join('public', 'avatar', 'AvatarSample_B_webp.vrm')

/**
 * The shipped body with every scene root scaled, written to a temp file.
 *
 * Only the glTF JSON chunk changes, and only the root scale: every humanoid
 * bone's rest position is derived from that chain, so the whole skeleton grows
 * and the binary chunk (meshes, textures) is copied through untouched.
 */
function scaledBody(factor: number): string {
  const raw = readFileSync(SHIPPED)
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const jsonLength = view.getUint32(12, true)
  const jsonKind = view.getUint32(16, true)
  const doc = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLength)))

  const scene = doc.scenes[doc.scene ?? 0]
  for (const index of scene.nodes) {
    const node = doc.nodes[index]
    const scale: number[] = node.scale ?? [1, 1, 1]
    node.scale = scale.map((v) => v * factor)
  }

  let blob = new TextEncoder().encode(JSON.stringify(doc))
  const pad = (4 - (blob.length % 4)) % 4
  if (pad) {
    const padded = new Uint8Array(blob.length + pad)
    padded.set(blob)
    padded.fill(0x20, blob.length)
    blob = padded
  }
  const rest = raw.subarray(20 + jsonLength)
  const out = new Uint8Array(12 + 8 + blob.length + rest.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, out.length, true)
  dv.setUint32(12, blob.length, true)
  dv.setUint32(16, jsonKind, true)
  out.set(blob, 20)
  out.set(rest, 20 + blob.length)

  const file = path.join(tmpdir(), `measure-motions-${factor}.vrm`)
  writeFileSync(file, out)
  return file
}

describe('measure-motions', () => {
  // Each report sweeps ten clips frame by frame. The result is a pure function
  // of the file, so both are computed once here: recomputing per test bought
  // nothing and put the suite over the default 5s timeout.
  //
  // The budget is 180s against a measured 24s for the two sweeps on an idle
  // machine. That looks generous until the pool is busy: at 60s this hook blew
  // its budget on a loaded machine, and vitest reports that as a failed FILE
  // with its five tests marked skipped — a run that says "302 passed" while
  // these never executed. Nothing here asserts speed, so the budget's only job
  // is to still catch a hang.
  let shipped: Report
  let taller: Report

  beforeAll(() => {
    shipped = measure(SHIPPED, CLEARANCE)
    taller = measure(scaledBody(1.35), CLEARANCE)
  }, 180_000)

  it('reports the shipped body as fitting, waiver and all', () => {
    expect(shipped.tight, shipped.lines.join('\n')).toBe(0)
    expect(shipped.lines.join('\n')).toContain('全部動作在這具身體上都待在預算內')
  })

  it('recognises the face waiver dance already ships with', () => {
    // 0.197 measured against a declared floor of 0.19. It read 0.299 until
    // 2026-09-06, when the face box began to be read off the mesh instead of
    // the 2026-08-19 hand measurement (0.300, the two boxes differ by 0.3mm at
    // the edges), and 0.197 later the same day, when the sweep stopped
    // sampling the clip's keyframes only and started walking it at 60 Hz as
    // well (rigProbe.ts SAMPLE_HZ). Neither number is chosen here: the
    // measurement comes out of the sweep and the floor out of the clearance
    // file, so this fails if either drifts from the other.
    const line = shipped.lines.find((l) => l.includes('放行範圍內'))
    expect(line, '找不到 dance 的放行說明').toBeDefined()
    expect(line).toMatch(/0\.19[5-9].*下限 0\.190/)
  })

  it('reports the face box and the finger skin it read off the body', () => {
    // Written after the derivation landed, so its red evidence is the
    // mutation table (evidence/mutations-0906-retarget.md M1, M2, R9), not
    // the red log. 18.0mm is the shipped body's reading
    // (evidence/retarget-0906-measure.log); a report that printed the 12mm
    // constant instead would still match a looser pattern.
    const text = shipped.lines.join('\n')
    expect(text).toMatch(/臉部盒　x -0\.09\d…0\.09\d　y 1\.287…1\.503/)
    expect(text).toMatch(/指尖皮厚　18\.\dmm/)
    // A taller body's box scales with it: derived, not carried.
    expect(taller.lines.join('\n')).toMatch(/臉部盒　x -0\.12\d…0\.12\d　y 1\.73\d…2\.0[23]\d/)
  })

  it('says no when the same clips are asked to run on a taller body', () => {
    const report = taller
    const text = report.lines.join('\n')
    expect(report.tight, text).toBeGreaterThan(0)
    // Not merely a count: the point of the report is that a person can see WHICH
    // clip, WHICH composition and WHICH direction, so the failing rows have to
    // carry a negative slack rather than a summary line at the bottom.
    expect(text).toMatch(/餘裕 -\d/)
    expect(text).toContain('項超出預算')
  })

  it('counts exactly the violations it printed', () => {
    // The summary number and the rows have to describe the same thing. `tight`
    // is incremented at four separate places (three budget rows, the hips
    // bottom edge, the face floor, the end-of-clip sink), so a count that is
    // merely "greater than zero" stays true when one of them stops counting
    // and the reader is told a smaller number than the page shows.
    const report = taller
    const printed = report.lines.filter(
      (l) => /餘裕 -\d/.test(l) || l.includes('⚠'),
    ).length
    expect(report.tight, report.lines.join('\n')).toBe(printed)
  })

  it('reports the derived crown against the top edge', () => {
    // The reconstructed rig has no spring bones, so the crown cannot be swept
    // here. What can be derived is the transfer: the clearance file carries
    // how far each clip throws the hair above the simulated body's resting
    // crown (springsim), plus the browser's translucent fringe, and this body
    // contributes its own bind-pose crown. Until 2026-09-06 this row was a
    // disclaimer ("這個數字推導不出來"), which is how a body whose hair
    // leaves the frame would have passed the whole report.
    const shippedText = shipped.lines.join('\n')
    // dance in the column: derived crown against the panned top edge
    // (1.602 + 0.13), with room to spare on the shipped body.
    expect(shippedText).toMatch(/column\s+髮頂　1\.7\d{3}　上緣 1\.7320.*餘裕  \d/)
    expect(shippedText).not.toContain('推導不出來')
    // A 35% taller body carries its crown up with it; the frame does not move.
    const tallerText = taller.lines.join('\n')
    expect(tallerText).toMatch(/髮頂　2\.\d{4}　上緣 1\.7320.*餘裕 -\d/)
  })
})
