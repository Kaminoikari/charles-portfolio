// Derive a family's `pans` the way rigProbe.test.ts holds them: panFor over the
// family's own crown and hips, under the frame's PAN_POLICY.
//
//   npx tsx scripts/derive-pans.ts <family-id> <path-to-body.vrm>
//
// A pan changes the projection it was derived from, so one pass is not the
// answer: springsim projects each crown through the frame's camera WITH the
// declared pan applied. Run this, write the result into the family's decisions
// file, re-run springsim, and run this again; the family has settled when a
// pass changes nothing. vroid-sample-b settled on its first pass, the VRM1
// sample on its third (clearance.ts, ClearanceDecisions.pans).
import { readFileSync } from 'node:fs'
import { panFor, type ClearanceFile } from '../src/components/chat/clearance'
import { AVATAR_MOTIONS, PAN_POLICY } from '../src/components/chat/avatarMotions'
import { familyClearance } from '../src/components/chat/avatarVariants'
import { buildRigFrom, deriveRestCrown } from '../src/components/chat/rigProbe'
import { parseGlb } from '../src/components/chat/vrmHumanoid'

const [family, body] = process.argv.slice(2)
if (!family || !body) throw new Error('usage: derive-pans.ts <family-id> <body.vrm>')

const file: ClearanceFile | null = familyClearance(family)
if (!file) throw new Error(`family ${family} is not registered in AVATAR_FAMILIES yet`)

const glb = parseGlb(readFileSync(body))
const restCrown = deriveRestCrown(glb, buildRigFrom(glb))

const out: Record<string, Record<string, number>> = {}
const unfittable: string[] = []
let changed = 0
for (const [name, def] of Object.entries(AVATAR_MOTIONS)) {
  for (const frame of def.placements) {
    // A clip whose crown cannot be brought into frame before its hips leave it
    // is not a pan that needs finding, it is a clip this body cannot wear. Only
    // `excluded` can answer that, and a throw here would hide every later clip,
    // so it is collected and the pass continues. Anything else still throws.
    let want: number
    try {
      want = panFor(file, name, frame, restCrown, PAN_POLICY[frame], def.placements)
    } catch (e) {
      const msg = (e as Error).message
      if (!msg.includes('does not fit')) throw e
      unfittable.push(`${name}/${frame}: ${msg.slice(msg.indexOf('(') + 1, -1)}`)
      continue
    }
    const have = file.pans[name]?.[frame] ?? 0
    if (want !== have) changed += 1
    if (want !== 0) (out[name] ??= {})[frame] = want
  }
}
console.log(`// ${family}: restCrown ${restCrown.toFixed(4)}, ${changed} pan(s) differ from what is declared`)
console.log('  pans: {')
for (const [clip, frames] of Object.entries(out)) {
  const line = Object.entries(frames).map(([f, v]) => `${f}: ${v}`).join(', ')
  console.log(`    ${clip}: { ${line} },`)
}
console.log('  },')
for (const u of unfittable) console.log(`// CANNOT FIT ${u}`)
if (changed === 0 && unfittable.length === 0) console.log('// SETTLED: this pass changed nothing.')
if (changed === 0 && unfittable.length > 0) {
  console.log(`// SETTLED on pans, but ${unfittable.length} clip/frame(s) above need excluding.`)
}
