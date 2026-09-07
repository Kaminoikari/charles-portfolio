// Run: npx tsx scripts/avatar/evidence/sideways-0907-probe.ts
//
// What a sideways skin allowance would cost, before deciding its shape.
//
// measure-motions compares the bare silhouette JOINT against the frame's half
// width, while the vertical bound adds SKIN_ABOVE_JOINT for exactly the reason
// that applies here too: the frame has to clear the drawn limb, not its bone.
// This prints, per declared body, the skin radius of every silhouette bone and
// then re-runs the reach sweep with each joint carrying its own radius, against
// the budget that clip is actually filmed in.
//
// The question it answers is whether a per-bone allowance can be afforded at
// all: if the widest clips are already within a few millimetres of the frame,
// the honest allowance would put them outside it and the fix is a pan, a
// waiver or a narrower silhouette rather than a bigger number.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_COLUMN_ASPECT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarViewHalfWidth,
} from '/Users/charles/portfolio/src/components/chat/avatarMode.ts'
import { AVATAR_MOTIONS, type AvatarMotionName, type MotionFrame } from '/Users/charles/portfolio/src/components/chat/avatarMotions.ts'
import { AVATAR_VARIANTS, familyClearance } from '/Users/charles/portfolio/src/components/chat/avatarVariants.ts'
import { panOf } from '/Users/charles/portfolio/src/components/chat/clearance.ts'
import {
  applyMotion,
  buildMotion,
  buildRigFrom,
  deriveSilhouetteSkin,
  resetRig,
  screenX,
  silhouetteBones,
  worldPosition,
  type Rig,
} from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'
import { parseGlb } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'

const REPO = '/Users/charles/portfolio'
const HALF = {
  waistUp: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
  column: avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, { w: AVATAR_COLUMN_ASPECT, h: 1 }),
}
const mm = (v: number): string => `${(v * 1000).toFixed(1)}mm`

for (const variant of AVATAR_VARIANTS) {
  const file = path.join(REPO, 'public', variant.url.replace(/^\/+/, ''))
  const glb = parseGlb(new Uint8Array(readFileSync(file)))
  const rig: Rig = buildRigFrom(glb)
  const clearance = familyClearance(variant.family)
  const skin = deriveSilhouetteSkin(glb, rig)
  const bones = silhouetteBones(rig)

  console.log(`\n=== ${variant.id}  ${variant.label}  (${variant.family})`)
  // One side is enough to read: the two are mirrored to the micrometre or they
  // are not, and the max below is over both.
  const shown = bones.filter((b) => b.startsWith('left') || b === 'head')
  console.log(`  ${shown.length} bones on her left plus the head, radius:`)
  for (const bone of shown.sort((a, b) => skin[b] - skin[a]).slice(0, 8)) {
    console.log(`    ${bone.padEnd(22)} ${mm(skin[bone]).padStart(8)}`)
  }
  const widest = bones.reduce((a, b) => (skin[b] > skin[a] ? b : a))
  console.log(`  widest ${widest} ${mm(skin[widest])}, thinnest ${mm(Math.min(...bones.map((b) => skin[b])))}`)

  console.log('  clip            frame     bare    +skin    budget   spare(+skin)  worst bone')
  for (const [name, def] of Object.entries(AVATAR_MOTIONS) as [AvatarMotionName, (typeof AVATAR_MOTIONS)[AvatarMotionName]][]) {
    const motion = buildMotion(new Uint8Array(readFileSync(path.join(REPO, 'public', 'avatar', 'animations', `${name}.vrma`))))
    for (const placement of Object.keys(HALF) as MotionFrame[]) {
      if (!def.placements.includes(placement)) continue
      let bare = -Infinity
      let withSkin = -Infinity
      let worstBone = ''
      for (const time of motion.sampleTimes) {
        resetRig(rig)
        applyMotion(rig, motion, time)
        for (const bone of bones) {
          const x = worldPosition(rig, bone).x
          for (const edge of [-screenX(rig, x), screenX(rig, x)]) {
            bare = Math.max(bare, edge)
            if (edge + skin[bone] > withSkin) {
              withSkin = edge + skin[bone]
              worstBone = bone
            }
          }
        }
      }
      const budget = HALF[placement]
      void panOf(clearance, name, placement) // a pan slides the frame, not its width
      const spare = budget - withSkin
      console.log(
        `  ${name.padEnd(14)}  ${placement.padEnd(8)}  ${bare.toFixed(4)}  ${withSkin.toFixed(4)}  ` +
          `${budget.toFixed(4)}   ${(spare >= 0 ? ' ' : '') + mm(spare).padStart(9)}  ${worstBone}`,
      )
    }
  }
  resetRig(rig)
}
