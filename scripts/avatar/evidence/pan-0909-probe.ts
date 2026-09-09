// Every clip's derived pan for the dress-up family, through the shipped
// derivation (clearance.panRange / panFor), the way pan-0907-probe.ts does it.
import { CLEARANCE } from '../../../src/components/chat/clearance/vroid-studio-dressup'
import { panFor, panRange, crownWorst } from '../../../src/components/chat/clearance'
import { AVATAR_MOTIONS, PAN_POLICY } from '../../../src/components/chat/avatarMotions'

const f = CLEARANCE
const mm = (v: number): string => (v * 1000).toFixed(1).padStart(8)
console.log(`family ${f.family}  simulated on ${f.simulatedOn}  rest crown ${f.restCrownY}`)
console.log('clip/frame            declared   derived   policy    range (mm)        crown    hipsLow   waived')
for (const [clip, def] of Object.entries(AVATAR_MOTIONS)) {
  for (const frame of def.placements) {
    const policy = PAN_POLICY[frame]
    const { least, most } = panRange(f, clip, frame, f.restCrownY, def.placements)
    const got = panFor(f, clip, frame, f.restCrownY, policy, def.placements)
    const declared = CLEARANCE.pans[clip]?.[frame] ?? 0
    const waiver = f.clips[clip].waiver?.crownTop
    console.log(
      `${(clip + '/' + frame).padEnd(22)}` +
      `${declared.toFixed(2).padStart(6)}    ${got.toFixed(2).padStart(6)}   ${policy.padEnd(7)} ` +
      `${mm(least)}..${mm(most)}   ${crownWorst(f, clip, f.restCrownY, def.placements).toFixed(4)}   ` +
      `${f.clips[clip].hipsLow.toFixed(4)}   ${waiver === undefined ? '-' : waiver.toFixed(3)}` +
      `${declared === got ? '' : '   <<< DISAGREES'}`,
    )
  }
}
