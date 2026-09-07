// Every clip's derived pan against the one declared on it, through the SHIPPED
// derivation (clearance.panRange / panFor), not a re-implementation of it.
//
//     npx tsx scripts/avatar/evidence/pan-0907-probe.ts
//
// The first version of this probe measured the crown of the frame being panned
// and ignored the crownTop waivers, which is the derivation the commit rejected:
// it gives the dance's waist-up -0.09 instead of -0.08, and hands spin, squat,
// scratchHead, playFingers and idleLoop a pan each. What it prints now is what
// rigProbe.test.ts asserts, plus the range each answer sits in, so the numbers
// behind a passing test can be read rather than inferred.
import { CLEARANCE } from '../../../src/components/chat/clearance/vroid-sample-b'
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
