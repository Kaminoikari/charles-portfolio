// Re-measure the bundled motion clips against a different body, and write
// what was measured as the family's clearance.
//
//     npx tsx scripts/measure-motions.ts <path-to.vrm> [--family=<family>]
//     npx tsx scripts/measure-motions.ts            # the shipped avatar
//     npx tsx scripts/measure-motions.ts <path-to.vrm> --write src/components/chat/clearance/<family>.measured.gen.ts --family=<family>
//
// WHY THIS EXISTS. The numbers in the clearance file (src/components/chat/
// clearance/) are absolute world-space distances measured by retargeting the
// clips onto one body. Swap the body and every one of them is a claim about a
// model that is no longer on screen: a taller avatar's raised hand leaves the
// frame that the shorter one fitted in, and a fingertip that cleared a skull
// by 3mm does not clear a wider one. This is the thing that re-measures, and
// with --write it is the producer of the clearance's measured half (the spring
// half is scripts/avatar/springsim.ts --clearance).
//
// The report is deliberately a REPORT, not a guard. The unit suite already
// asserts the shipped avatar's numbers, and duplicating those thresholds here
// would give two places to update and one of them would go stale. What this
// prints is the worst frame of each clip in each placement, beside the budget
// it has to fit in, so a person deciding whether a new body can keep the clip
// pack can see how much room is left rather than a pass/fail with no margin.
//
// NO BROWSER, NO GPU. rigProbe builds three-vrm's own VRMHumanoid on the glTF
// node tree and runs forward kinematics in plain Node. That is not a
// convenience here: this machine's Playwright runs software WebGL, where
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
  crownBound,
  type ClearanceFile,
  type ClearanceMeasured,
  type ClipMeasured,
} from '../src/components/chat/clearance'
import {
  applyMotion,
  buildMotion,
  buildRigFrom,
  deriveFingerSkinRadius,
  deriveRestCrown,
  handJoints,
  headPenetration,
  headVolume,
  probeHand,
  resetRig,
  screenX,
  silhouetteJoints,
  SKIN_ABOVE_JOINT,
  type Motion,
  type Rig,
} from '../src/components/chat/rigProbe'
import { parseGlb, type Glb } from '../src/components/chat/vrmHumanoid'
import { producedAt, rigSha, servedPath, writeGenerated } from './avatar/clearance'

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
  /** Hips sideways offset at the clip's ends. */
  hipsDrift: number
  /** Highest wrist at the clip's ends. */
  endWrist: number
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
    hipsDrift: 0,
    endWrist: -Infinity,
  }
  // Only the ends. A clip that goes down in the middle is a clip that goes
  // down — squat is the whole reason this is not a per-frame check. What a
  // retargeting offset looks like is a body that does not START at its own
  // height, and the guard for the middle is the frame's bottom edge below.
  // The same two frames are where the engine's fade has to start and finish
  // from a standing pose: hips centred, arms hanging (rigProbe.test.ts).
  const times = motion.sampleTimes
  for (const time of [times[0], times[times.length - 1]]) {
    applyMotion(rig, motion, time)
    const hips = new THREE.Vector3().setFromMatrixPosition(rig.bones.hips.matrixWorld)
    w.endSink = Math.max(w.endSink, restHipsY - hips.y)
    w.hipsDrift = Math.max(w.hipsDrift, Math.abs(hips.x))
    for (const side of ['left', 'right'] as const) {
      w.endWrist = Math.max(w.endWrist, probeHand(rig, side).wrist.y)
    }
  }
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
  /** What --write records: everything above that is a property of this body under the clips. */
  measured: Omit<ClearanceMeasured, 'family' | 'rigSha' | 'measuredOn' | 'producedBy'>
}

const round = (v: number, places: number): number => Math.round(v * 10 ** places) / 10 ** places
const triple = (v: THREE.Vector3): [number, number, number] => [round(v.x, 4), round(v.y, 4), round(v.z, 4)]

/**
 * The report for one body. `clearance` is the family's file, which carries
 * the waivers and the simulated crown the rows below are read against; null
 * while producing it (--write), when there is nothing to read against yet.
 */
export function measure(target: string, clearance: ClearanceFile | null): Report {
  const lines: string[] = []
  const say = (s: string): void => void lines.push(s)
  let rig: Rig
  let glb: Glb
  try {
    glb = parseGlb(bytes(target))
    rig = buildRigFrom(glb)
  } catch (e) {
    throw new Error(`讀不了 ${target}：${e instanceof Error ? e.message : e}`)
  }
  resetRig(rig)
  const restHipsY = rig.restPosition.hips.y
  const restHeadY = rig.restPosition.head.y
  // All read off THIS body's mesh (rigProbe.deriveFaceBox / deriveFingerSkinRadius /
  // deriveRestCrown), beside the 12mm margin the frame still reserves by constant.
  const box = rig.faceBox
  const fingerSkin = deriveFingerSkinRadius(glb, rig)
  const restCrown = deriveRestCrown(glb, rig)
  const measured: Report['measured'] = {
    faceBox: { min: triple(box.min), max: triple(box.max) },
    handSkinPastTip: round(fingerSkin, 4),
    restCrownY: round(restCrown, 4),
    clips: {},
  }

  say(`模型　　${target}`)
  say(`靜止姿勢　hips ${restHipsY.toFixed(4)}　head ${restHeadY.toFixed(4)}　最高頂點 ${restCrown.toFixed(4)}`)
  say(
    `臉部盒　x ${box.min.x.toFixed(3)}…${box.max.x.toFixed(3)}　y ${box.min.y.toFixed(3)}…${box.max.y.toFixed(3)}` +
      `　z ${box.min.z.toFixed(3)}…${box.max.z.toFixed(3)}（從表情會動的 mesh 推導）`,
  )
  say(`指尖皮厚　${mm(fingerSkin)}（掃過所有帶皮的 mesh；畫面預留的是 SKIN_ABOVE_JOINT ${mm(SKIN_ABOVE_JOINT)}）`)
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
    const waiver = clearance?.clips[name]?.waiver
    say(`── ${name}　（${def.placements.join('、')}）`)
    for (const placement of def.placements) {
      resetRig(rig)
      const w = sweep(rig, motion, restHipsY)
      const frame = frameFor(name, placement)
      // A waiver is a violation the shipped body already accepts, so it is
      // shown as the budget rather than hidden: on a new body the question is
      // not "does it fit the frame" but "is it worse than what already ships".
      const rows: [string, number, number, number | undefined][] = [
        ['往畫面左邊伸', w.left, frame.halfWidth, waiver?.reach],
        ['往畫面右邊伸', w.right, frame.halfWidth, waiver?.reach],
        ['手的皮膚頂端', w.skinTop, frame.span.top, waiver?.handTop],
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
      // The hair. The reconstructed rig has no spring bones, so the top of her
      // hair is not in it; what the clearance file carries is how far the
      // spring solver threw it above the SIMULATED body's resting crown, plus
      // the fringe the browser draws past the topmost vertex, and this body
      // contributes its own resting crown (clearance.ts crownOn). Where a
      // browser sweep, or another body of the family simulated in its own
      // right, reaches higher still, that number wins (crownBound).
      if (clearance) {
        const crown = crownBound(clearance, name, placement, restCrown)
        // A waiver raises this frame's edge and never lowers it. The waivers on
        // the shipped family were all decided watching the column camera, whose
        // edge is 1.6020; read as a replacement they would put the waist-up
        // ceiling 252mm BELOW its own 1.8722 edge (spin's 1.6200, the tightest
        // of the three that remain) and report negative slack for a clip with a
        // quarter of a metre to spare (clearance.ts panRange).
        const crownLimit = Math.max(frame.span.top, waiver?.crownTop ?? -Infinity)
        const crownSlack = crownLimit - crown
        if (crownSlack < 0) tight += 1
        say(
          `   ${placement.padEnd(8)} 髮頂　${crown.toFixed(4)}　上緣 ${frame.span.top.toFixed(4)}` +
            `${waiver?.crownTop !== undefined ? `（已放行到 ${waiver.crownTop.toFixed(4)}）` : ''}` +
            `　餘裕 ${crownSlack >= 0 ? ' ' : ''}${mm(crownSlack)}` +
            `（模擬投影 ${clearance.clips[name].crownScreen[placement].toFixed(4)}` +
            `，換到這具身體 ${mm(restCrown - clearance.restCrownY)}，瀏覽器邊緣 ${mm(clearance.crownFringe)}）`,
        )
      } else {
        tight += 1
        say(`   ${placement.padEnd(8)} ⚠ 髮頂沒有量：沒有 clearance 檔可以對上緣`)
      }
    }
    // The next two are properties of the clip on this body, not of the frame it
    // is played in, so they are measured once rather than per placement.
    resetRig(rig)
    const w = sweep(rig, motion, restHipsY)
    measured.clips[name] = {
      reach: { left: round(w.left, 4), right: round(w.right, 4) },
      skinTop: round(w.skinTop, 4),
      hipsLow: round(w.hipsLow, 4),
      faceRatio: round(w.faceRatio, 4),
      faceRatioAt: round(w.faceRatioAt, 2),
      endSink: round(w.endSink, 4),
      hipsDrift: round(w.hipsDrift, 4),
      endWrist: round(w.endWrist, 4),
    } satisfies ClipMeasured
    // Lower is deeper, so the waiver is a FLOOR: the measurement has to stay
    // above it, and above 1 when there is none.
    const faceFloor = waiver?.handInHead ?? 1
    if (w.faceRatio < faceFloor) {
      tight += 1
      say(
        `   ⚠ 手伸進臉裡：橢球值 ${w.faceRatio.toFixed(3)}，` +
          `下限 ${faceFloor.toFixed(3)}${waiver?.handInHead !== undefined ? '（已放行）' : ''}` +
          `，最深的一幀在 t=${w.faceRatioAt.toFixed(2)}s`,
      )
    } else if (waiver?.handInHead !== undefined) {
      say(
        `   手在臉裡但在放行範圍內　${w.faceRatio.toFixed(3)}` +
          `（下限 ${faceFloor.toFixed(3)}，t=${w.faceRatioAt.toFixed(2)}s）`,
      )
    } else {
      say(`   手沒進到臉裡　最近一次 ${w.faceRatio.toFixed(3)}（要大於 1）`)
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
  return { lines, tight, measured }
}

/** Write the measured half of a clearance file for this body. */
export function writeMeasured(target: string, family: string, file: string, report: Report): void {
  const value: ClearanceMeasured = {
    family,
    rigSha: rigSha(parseGlb(bytes(target)).json),
    measuredOn: servedPath(target),
    producedBy: producedAt(),
    ...report.measured,
  }
  writeGenerated(
    file,
    {
      exportName: 'MEASURED',
      typeName: 'ClearanceMeasured',
      typeFrom: '../clearance',
      producer: 'scripts/measure-motions.ts --write',
      note: [
        `Body ${servedPath(target)} under every clip in AVATAR_MOTIONS, by forward kinematics on`,
        "three-vrm's VRMHumanoid (rigProbe.ts): the worst frame of each clip, and what the mesh",
        'says about the face, the finger skin and the resting crown. Regenerate:',
        `  npx tsx scripts/measure-motions.ts ${path.relative(process.cwd(), target)} --write ${path.relative(process.cwd(), file)} --family=${family}`,
      ],
    },
    value,
  )
}

interface Cli {
  target: string
  family: string
  write: string | null
}

export function parseCli(argv: string[]): Cli {
  const cli: Cli = { target: SHIPPED, family: 'vroid-sample-b', write: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--write') cli.write = path.resolve(argv[++i] ?? '')
    else if (a.startsWith('--family=')) cli.family = a.slice(9)
    else if (!a.startsWith('--')) cli.target = a
  }
  if (cli.write === '' || cli.write === path.resolve('')) throw new Error('--write needs a file path')
  return cli
}

// Only when run directly, so the test can import `measure` without the process
// exiting out from under it.
if (process.argv[1]?.endsWith('measure-motions.ts')) {
  const run = async (): Promise<void> => {
    const cli = parseCli(process.argv.slice(2))
    if (cli.write) {
      // Producing: nothing to read against yet.
      const report = measure(cli.target, null)
      writeMeasured(cli.target, cli.family, cli.write, report)
      console.log(`wrote ${path.relative(process.cwd(), cli.write)}`)
      return
    }
    // The extension is in the static part on purpose: without it vite's
    // dynamic-import-vars plugin warns on every vitest run that transforms
    // this file, and tsx resolves the explicit .ts.
    const { CLEARANCE } = (await import(`../src/components/chat/clearance/${cli.family}.ts`)) as {
      CLEARANCE: ClearanceFile
    }
    const report = measure(cli.target, CLEARANCE)
    for (const line of report.lines) console.log(line)
  }
  run().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
