// Re-measure the bundled motion clips against a different body.
//
//     npx tsx scripts/measure-motions.ts <path-to.vrm>
//     npx tsx scripts/measure-motions.ts            # the shipped avatar
//
// WHY THIS EXISTS. The numbers in avatarMotions.ts are absolute world-space
// distances measured by retargeting the clips onto AvatarSample_B_webp.vrm.
// Swap the body and every one of them is a claim about a model that is no
// longer on screen: a taller avatar's raised hand leaves the frame that the
// shorter one fitted in, and a fingertip that cleared a skull by 3mm does not
// clear a wider one. The comment on AVATAR_MOTIONS says to re-measure when the
// model changes; this is the thing that does it.
//
// It is deliberately a REPORT, not a guard. The unit suite already asserts the
// shipped avatar's numbers, and duplicating those thresholds here would give
// two places to update and one of them would go stale. What this prints is the
// worst frame of each clip in each placement, beside the budget it has to fit
// in, so a person deciding whether a new body can keep the clip pack can see
// how much room is left rather than a pass/fail with no margin.
//
// NO BROWSER, NO GPU. rigProbe rebuilds three-vrm's normalized humanoid rig out
// of the glTF JSON chunk and runs forward kinematics in plain Node. That is not
// a convenience here: this machine's Playwright runs software WebGL, where
// rendered frames are unreliable and bone coordinates are not.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import * as THREE from 'three'

import {
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_COLUMN_ASPECT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarViewHalfWidth,
  avatarViewSpan,
} from '../src/components/chat/avatarMode'
import {
  AVATAR_MOTIONS,
  MAX_HIPS_SINK,
  motionPan,
  type AvatarMotionName,
  type MotionFrame,
} from '../src/components/chat/avatarMotions'
import {
  applyMotion,
  buildMotion,
  buildRig,
  handJoints,
  headPenetration,
  headVolume,
  resetRig,
  screenX,
  silhouetteJoints,
  SKIN_ABOVE_JOINT,
  type Motion,
  type Rig,
} from '../src/components/chat/rigProbe'

const SHIPPED = path.join('public', 'avatar', 'AvatarSample_B_webp.vrm')

const bytes = (p: string): Uint8Array => new Uint8Array(readFileSync(p))

// The same two compositions the engine plays clips in, and the same pan
// adjustment: a clip that slides the camera while it runs must be measured
// against the frame the visitor actually sees, not the resting one.
const FRAMES = {
  waistUp: {
    halfWidth: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    span: avatarViewSpan(AVATAR_FRAMING_DEFAULT),
  },
  column: {
    halfWidth: avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, { w: AVATAR_COLUMN_ASPECT, h: 1 }),
    span: avatarViewSpan(AVATAR_FRAMING_COLUMN),
  },
}

function frameFor(name: AvatarMotionName, placement: MotionFrame) {
  const frame = FRAMES[placement]
  const pan = motionPan(name, placement)
  return {
    halfWidth: frame.halfWidth,
    span: { top: frame.span.top + pan, bottom: frame.span.bottom + pan },
  }
}

interface Worst {
  /** Widest silhouette reach toward each screen side. */
  left: number
  right: number
  /** Top of her SKIN, not of the joint: clearing the bone still cuts the hand. */
  skinTop: number
  /** Lowest her hips go, and how far that is below her rest height. */
  hipsLow: number
  /**
   * Closest any hand joint comes to the centre of the face ellipsoid, as the
   * ellipsoid equation's value: below 1 is inside her face, 1 is on the
   * surface, above 1 is clear. Scale-free on purpose, so the same number reads
   * the same on a taller or wider head.
   */
  faceRatio: number
  faceRatioAt: number
  /** Hips at the clip's first and last frame, against her own rest height. */
  endSink: number
}

function sweep(rig: Rig, motion: Motion, restHipsY: number): Worst {
  const volume = headVolume(rig)
  const w: Worst = {
    left: -Infinity,
    right: -Infinity,
    skinTop: -Infinity,
    hipsLow: Infinity,
    faceRatio: Infinity,
    faceRatioAt: -1,
    endSink: 0,
  }
  const hipsAt = (time: number): number => {
    applyMotion(rig, motion, time)
    return new THREE.Vector3().setFromMatrixPosition(rig.bones.hips.matrixWorld).y
  }
  // Only the ends. A clip that goes down in the middle is a clip that goes
  // down — squat is the whole reason this is not a per-frame check. What a
  // retargeting offset looks like is a body that does not START at its own
  // height, and the guard for the middle is the frame's bottom edge below.
  const times = motion.sampleTimes
  w.endSink = Math.max(
    restHipsY - hipsAt(times[0]),
    restHipsY - hipsAt(times[times.length - 1]),
  )
  for (const time of motion.sampleTimes) {
    applyMotion(rig, motion, time)
    for (const joint of silhouetteJoints(rig)) {
      w.left = Math.max(w.left, -screenX(joint.x))
      w.right = Math.max(w.right, screenX(joint.x))
    }
    for (const side of ['left', 'right'] as const) {
      for (const joint of handJoints(rig, side)) {
        w.skinTop = Math.max(w.skinTop, joint.y + SKIN_ABOVE_JOINT)
        // headVolume is read from the REST pose on purpose: the guard asks
        // whether a hand enters the skull, and a head that moves with the clip
        // would let a nodding frame excuse a fingertip inside it.
        const ratio = headPenetration(rig, volume, joint)
        if (ratio < w.faceRatio) {
          w.faceRatio = ratio
          w.faceRatioAt = time
        }
      }
    }
    // bones are Object3D, so a live position comes off matrixWorld; only the
    // rest pose is available as a plain vector.
    const hips = new THREE.Vector3().setFromMatrixPosition(rig.bones.hips.matrixWorld)
    w.hipsLow = Math.min(w.hipsLow, hips.y)
  }
  return w
}

function mm(metres: number): string {
  return `${(metres * 1000).toFixed(1)}mm`
}

export interface Report {
  lines: string[]
  /** How many measurements sit outside the budget the shipped body accepts. */
  tight: number
}

export function measure(target: string): Report {
  const lines: string[] = []
  const say = (s: string): void => void lines.push(s)
  let rig: Rig
  try {
    rig = buildRig(bytes(target))
  } catch (e) {
    throw new Error(`讀不了 ${target}：${e instanceof Error ? e.message : e}`)
  }
  resetRig(rig)
  const restHipsY = rig.restPosition.hips.y
  const restHeadY = rig.restPosition.head.y

  say(`模型　　${target}`)
  say(`靜止姿勢　hips ${restHipsY.toFixed(4)}　head ${restHeadY.toFixed(4)}`)
  say(
    '\n每一列是那支動作最糟的一幀，跟它必須待在裡面的預算並排。' +
      '\n餘裕是負的就代表這具身體上那支動作會被切到或會穿模。\n',
  )

  const names = Object.keys(AVATAR_MOTIONS) as AvatarMotionName[]
  let tight = 0
  for (const name of names) {
    let motion: Motion
    try {
      motion = buildMotion(bytes(path.join('public', 'avatar', 'animations', `${name}.vrma`)))
    } catch (e) {
      say(`✗ ${name}　讀不了動作檔：${e instanceof Error ? e.message : e}\n`)
      tight += 1
      continue
    }
    const def = AVATAR_MOTIONS[name]
    say(`── ${name}　（${def.placements.join('、')}）`)
    for (const placement of def.placements) {
      resetRig(rig)
      const w = sweep(rig, motion, restHipsY)
      const frame = frameFor(name, placement)
      // A waiver is a violation the shipped body already accepts, so it is
      // shown as the budget rather than hidden: on a new body the question is
      // not "does it fit the frame" but "is it worse than what already ships".
      const rows: [string, number, number, number | undefined][] = [
        ['往畫面左邊伸', w.left, frame.halfWidth, def.waiver?.reach],
        ['往畫面右邊伸', w.right, frame.halfWidth, def.waiver?.reach],
        ['手的皮膚頂端', w.skinTop, frame.span.top, def.waiver?.handTop],
      ]
      for (const [label, got, budget, waived] of rows) {
        const limit = waived ?? budget
        const slack = limit - got
        if (slack < 0) tight += 1
        const note = waived !== undefined ? `（已放行到 ${waived.toFixed(4)}）` : ''
        say(
          `   ${placement.padEnd(8)} ${label}　${got.toFixed(4)}　預算 ${budget.toFixed(4)}` +
            `${note}　餘裕 ${slack >= 0 ? ' ' : ''}${mm(slack)}`,
        )
      }
      const bottom = frame.span.bottom
      const hipsSlack = w.hipsLow - bottom
      if (hipsSlack < 0) tight += 1
      say(
        `   ${placement.padEnd(8)} 髖部最低　　${w.hipsLow.toFixed(4)}　下緣 ${bottom.toFixed(4)}` +
          `　餘裕 ${hipsSlack >= 0 ? ' ' : ''}${mm(hipsSlack)}`,
      )
    }
    // The next two are properties of the clip on this body, not of the frame it
    // is played in, so they are measured once rather than per placement.
    resetRig(rig)
    const w = sweep(rig, motion, restHipsY)
    // Lower is deeper, so the waiver is a FLOOR: the measurement has to stay
    // above it, and above 1 when there is none.
    const faceFloor = def.waiver?.handInHead ?? 1
    if (w.faceRatio < faceFloor) {
      tight += 1
      say(
        `   ⚠ 手伸進臉裡：橢球值 ${w.faceRatio.toFixed(3)}，` +
          `下限 ${faceFloor.toFixed(3)}${def.waiver?.handInHead !== undefined ? '（已放行）' : ''}` +
          `，最深的一幀在 t=${w.faceRatioAt.toFixed(2)}s`,
      )
    } else if (def.waiver?.handInHead !== undefined) {
      say(
        `   手在臉裡但在放行範圍內　${w.faceRatio.toFixed(3)}` +
          `（下限 ${faceFloor.toFixed(3)}，t=${w.faceRatioAt.toFixed(2)}s）`,
      )
    } else {
      say(`   手沒進到臉裡　最近一次 ${w.faceRatio.toFixed(3)}（要大於 1）`)
    }
    // Hair is the one thing this cannot answer. The reconstructed rig has no
    // spring bones, so the top of her hair is not in it; the number carried on
    // the clip was read off a render of the SHIPPED body and means nothing about
    // a different one. Saying so is the point: silently skipping it is how a
    // body whose hair leaves the frame would pass this whole report.
    if (def.crown !== undefined) {
      const worstTop = Math.min(...def.placements.map((pl) => frameFor(name, pl).span.top))
      say(
        `   ⓘ 髮頂 ${def.crown.toFixed(4)}（對舊身體量的，上緣 ${worstTop.toFixed(4)}）。` +
          '這個數字推導不出來，換身體要在瀏覽器裡重量一次。',
      )
    }
    if (w.endSink > MAX_HIPS_SINK) {
      tight += 1
      say(
        `   ⚠ 頭尾沒有站在自己的高度上：髖部低了 ${mm(w.endSink)}，` +
          `上限 ${mm(MAX_HIPS_SINK)}。這是重定向偏移，不是動作本身。`,
      )
    } else {
      say(`   頭尾站得住　髖部偏移 ${mm(w.endSink)}（上限 ${mm(MAX_HIPS_SINK)}）`)
    }
    say('')
  }

  if (tight) {
    say(`${tight} 項超出預算。上面每一列都指名是哪支動作、哪個構圖、哪個方向。`)
    say('這不代表動作壞了，代表這具身體跟現有的構圖數字不相容：')
    say('要嘛調構圖（avatarMode.ts 的 framing），要嘛那支動作不給這具身體用。')
  } else {
    say('全部動作在這具身體上都待在預算內，可以直接沿用。')
  }
  return { lines, tight }
}

// Only when run directly, so the test can import `measure` without the process
// exiting out from under it.
if (process.argv[1]?.endsWith('measure-motions.ts')) {
  try {
    const report = measure(process.argv[2] ?? SHIPPED)
    for (const line of report.lines) console.log(line)
    process.exit(0)
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
}
