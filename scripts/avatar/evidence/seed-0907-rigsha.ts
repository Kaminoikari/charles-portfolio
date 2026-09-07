// Run: npx tsx scripts/avatar/evidence/seed-0907-rigsha.ts <path-to.vrm> [...]
//
// A family IS its rigSha. A candidate second body is only a second family if
// rigOf() hashes to something the registry does not already hold, so this is
// the one fact to check before measuring anything.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { parseGlb, rigOf, type GltfJson } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'
import { AVATAR_FAMILIES } from '/Users/charles/portfolio/src/components/chat/avatarVariants.ts'

const known = new Map(Object.entries(AVATAR_FAMILIES).map(([id, f]) => [f.rigSha, id]))
for (const [id, f] of Object.entries(AVATAR_FAMILIES)) console.log(`declared  ${f.rigSha.slice(0, 16)}  ${id}`)
for (const file of process.argv.slice(2)) {
  const sha = createHash('sha256')
    .update(rigOf(parseGlb<GltfJson>(new Uint8Array(readFileSync(file))).json))
    .digest('hex')
  console.log(`candidate ${sha.slice(0, 16)}  ${file}  -> ${known.get(sha) ?? 'A NEW FAMILY'}`)
}
