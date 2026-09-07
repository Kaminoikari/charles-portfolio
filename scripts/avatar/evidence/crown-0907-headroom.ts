// Run: npx tsx scripts/avatar/evidence/crown-0907-headroom.ts
//
// How much room is there above the crown, per clip and framing, and how much of
// it did wiring the VRoid body's own simulation in eat?
//
// The body matters. `crownOn` transfers the simulated body's screen crown onto
// whatever body you hand it via `restCrownY`, and rigProbe.test hands it
// `deriveRestCrown(AvatarSample_B)` = the VRoid body, not the simulated Milfy
// body. Reading the file's own `restCrownY` back into it cancels the transfer
// and prints numbers no guard ever sees, which is what an earlier version of
// this probe did. This one asks the same question rigProbe.test asks.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { CLEARANCE } from '/Users/charles/portfolio/src/components/chat/clearance/vroid-sample-b.ts'
import { crownBound, crownOn } from '/Users/charles/portfolio/src/components/chat/clearance.ts'
import { AVATAR_MOTIONS } from '/Users/charles/portfolio/src/components/chat/avatarMotions.ts'
import { avatarViewSpan } from '/Users/charles/portfolio/src/components/chat/avatarMode.ts'
import { buildRig, deriveRestCrown } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'
import { parseGlb } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'

const asset = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(path.join('/Users/charles/portfolio/public/avatar', name)))

const body = asset('AvatarSample_B_webp.vrm')
const restCrownY = deriveRestCrown(parseGlb(body), buildRig(body))

const f = CLEARANCE
const mm = (v: number) => (v * 1000).toFixed(1).padStart(8)
console.log(`family ${f.family}  file restCrownY ${f.restCrownY}  this body ${restCrownY.toFixed(4)}  fringe ${f.crownFringe}`)
console.log('clip/frame              pan   transfer  +browser  +VRoid sim  top edge  waived to  headroom')
for (const [clip, def] of Object.entries(AVATAR_MOTIONS)) {
  for (const frame of def.placements) {
    const pan = f.pans[clip]?.[frame] ?? 0
    const view = avatarViewSpan(f.framings.frames[frame], f.framings.fov)
    // A clip may declare a crownTop waiver: the height it is ALLOWED to reach
    // past the frame's top edge. panRange honours it, so headroom must too.
    const waiver = f.clips[clip].waiver?.crownTop
    const ceiling = Math.max(view.top, waiver ?? -Infinity) + pan
    const transfer = crownOn(f, clip, frame, restCrownY)
    // What the guard read before alsoSimulated existed, and what it reads now.
    const wasBound = Math.max(transfer, f.crownSeen[clip]?.[frame] ?? -Infinity)
    const bound = crownBound(f, clip, frame, restCrownY)
    console.log(
      `${(clip + '/' + frame).padEnd(22)}${pan.toFixed(2).padStart(6)}  ` +
      `${transfer.toFixed(4)}    ${wasBound.toFixed(4)}      ${bound.toFixed(4)}    ` +
      `${(view.top + pan).toFixed(4)}   ` +
      `${waiver === undefined ? '        -' : ceiling.toFixed(4).padStart(9)}  ${mm(ceiling - bound)}mm`,
    )
  }
}
