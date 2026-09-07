// Run: npx tsx scripts/avatar/evidence/family2-0907-pans.ts [family]
//
// What panFor derives for a family, against what that family declares. This is
// the producer's other half: springsim writes the crowns, and the pan is
// arithmetic on them, so a new family's pans are read off this rather than
// dialled in. Run it, paste what it says into the family's `pans`, re-run
// springsim (a pan changes the projection the pan was derived from), and run it
// again.
//
// How many passes that takes belongs to the family. The VRoid family settled in
// one; the twist family took three, because two of its pans moved a centimetre
// on the second pass (spin's column 0.07 -> 0.05, stretch's waist-up 0.08 ->
// 0.07) and moving them moved the crowns they were solved against. Keep going
// until a pass changes nothing.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { panFor, panRange } from '/Users/charles/portfolio/src/components/chat/clearance.ts'
import { AVATAR_MOTIONS, PAN_POLICY } from '/Users/charles/portfolio/src/components/chat/avatarMotions.ts'
import { AVATAR_FAMILIES, AVATAR_VARIANTS, type AvatarFamilyId } from '/Users/charles/portfolio/src/components/chat/avatarVariants.ts'
import { buildRig, deriveRestCrown } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'
import { parseGlb } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'

const family = (process.argv[2] ?? 'vrm1-twist-sample') as AvatarFamilyId
const file = AVATAR_FAMILIES[family]
if (!file) throw new Error(`no family ${family}; declared: ${Object.keys(AVATAR_FAMILIES).join(', ')}`)

// The body the guards evaluate on: crownOn anchors the transfer on a real
// body's resting crown, and reading the file's own back into it cancels it.
const body = AVATAR_VARIANTS.find((v) => v.family === family)
if (!body) throw new Error(`family ${family} has no declared body`)
const bytes = new Uint8Array(readFileSync(path.join('/Users/charles/portfolio/public', body.url.replace(/^\//, ''))))
const restCrownY = deriveRestCrown(parseGlb(bytes), buildRig(bytes))

console.log(`${family}  on ${body.url}  resting crown ${restCrownY.toFixed(4)}  fringe ${file.crownFringe}`)
console.log('clip/frame              declared   derived    range [least, most]   verdict')
const wanted: Record<string, Record<string, number>> = {}
for (const [clip, def] of Object.entries(AVATAR_MOTIONS)) {
  for (const frame of def.placements) {
    const declared = file.pans[clip]?.[frame] ?? 0
    const r = panRange(file, clip, frame, restCrownY, def.placements)
    const fits = r.least <= r.most
    const derived = fits ? panFor(file, clip, frame, restCrownY, PAN_POLICY[frame], def.placements) : NaN
    if (fits && derived !== 0) (wanted[clip] ??= {})[frame] = derived
    console.log(
      `${(clip + '/' + frame).padEnd(22)}${declared.toFixed(2).padStart(7)}  ` +
      `${fits ? derived.toFixed(2).padStart(8) : '     n/a'}    ` +
      `[${r.least.toFixed(3)}, ${r.most.toFixed(3)}]`.padEnd(22) +
      (!fits
        ? 'NO PAN FITS: the clip is taller than the frame, so it belongs in `excluded`'
        : derived === declared
          ? 'agrees'
          : `declare ${derived.toFixed(2)}`),
    )
  }
}
console.log('\npans to declare:')
console.log(JSON.stringify(wanted, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:'))
