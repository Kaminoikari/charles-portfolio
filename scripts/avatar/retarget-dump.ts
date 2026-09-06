// What three-vrm's humanoid does with a clip, as numbers Python can check.
//
//     npx tsx scripts/avatar/retarget-dump.ts model.vrm [--twin]
//         --clips=a.vrma,b.vrma --times='{"a":[0.5,1.2],"b":[...]}'
//
// Prints one JSON document: for the shipped body (and, with --twin, the same
// body rewritten as a VRM 1.0 export) every requested clip and time, and at
// each the raw world rotation (xyzw) of every humanoid bone plus the hips'
// world position. retarget_parity_test.py holds motion.py's retarget to this
// within half a degree per bone, so the numpy copy the build gates run cannot
// drift from what the browser plays.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import * as THREE from 'three'

import { applyMotion, buildMotion, buildRigFrom, type Rig } from '../../src/components/chat/rigProbe'
import { parseGlb, readHumanoid, type Glb, type GltfJson } from '../../src/components/chat/vrmHumanoid'

type Doc = GltfJson & { extensions: NonNullable<GltfJson['extensions']> }

// A 1.0 export spells the thumb joints Metacarpal/Proximal/Distal where 0.x
// spells them Proximal/Intermediate/Distal (the same three joints).
const THUMB_VRM0_TO_VRM1: Record<string, string> = {
  leftThumbProximal: 'leftThumbMetacarpal',
  leftThumbIntermediate: 'leftThumbProximal',
  rightThumbProximal: 'rightThumbMetacarpal',
  rightThumbIntermediate: 'rightThumbProximal',
}

/** The body as a 1.0 export: map under VRMC_vrm with 1.0 thumb names, no VRM block, scene turned π about Y. */
function vrm1Twin(glb: Glb): Glb {
  const doc = JSON.parse(JSON.stringify(glb.json)) as Doc
  const { bones } = readHumanoid(doc)
  const record: Record<string, { node: number }> = {}
  for (const [bone, node] of Object.entries(bones)) record[THUMB_VRM0_TO_VRM1[bone] ?? bone] = { node }
  delete doc.extensions.VRM
  doc.extensions.VRMC_vrm = { specVersion: '1.0', humanoid: { humanBones: record } }
  doc.extensionsUsed = [...(doc.extensionsUsed ?? []).filter((e) => e !== 'VRM'), 'VRMC_vrm']
  const scene = doc.scenes![doc.scene ?? 0]
  doc.nodes.push({ name: 'vrm1-root', rotation: [0, 1, 0, 0], children: scene.nodes })
  scene.nodes = [doc.nodes.length - 1]
  return { json: doc, bin: glb.bin }
}

interface Frame {
  t: number
  bones: Record<string, [number, number, number, number]>
  hips: [number, number, number]
}

function dump(rig: Rig, clips: string[], times: Record<string, number[]>): Record<string, Frame[]> {
  const out: Record<string, Frame[]> = {}
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  for (const clip of clips) {
    const name = path.basename(clip, '.vrma')
    const motion = buildMotion(new Uint8Array(readFileSync(clip)))
    out[name] = (times[name] ?? []).map((t) => {
      applyMotion(rig, motion, t)
      const bones: Frame['bones'] = {}
      for (const bone of Object.keys(rig.bones)) {
        if (bone.endsWith('Tip')) continue
        const raw = rig.humanoid.getRawBoneNode(bone as never)
        if (!raw) continue
        raw.getWorldQuaternion(q)
        bones[bone] = [q.x, q.y, q.z, q.w]
      }
      rig.humanoid.getRawBoneNode('hips')!.getWorldPosition(p)
      return { t, bones, hips: [p.x, p.y, p.z] }
    })
  }
  return out
}

function main(): void {
  const argv = process.argv.slice(2)
  const model = argv.find((a) => !a.startsWith('--'))
  if (!model) throw new Error('usage: retarget-dump.ts model.vrm [--twin] --clips=a,b --times=json')
  const arg = (key: string): string | undefined => argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3)
  const clips = (arg('clips') ?? '').split(',').filter(Boolean)
  const times = JSON.parse(arg('times') ?? '{}') as Record<string, number[]>
  const glb = parseGlb(new Uint8Array(readFileSync(model)))
  const result: Record<string, unknown> = { model, shipped: dump(buildRigFrom(glb), clips, times) }
  if (argv.includes('--twin')) result.twin = dump(buildRigFrom(vrm1Twin(glb)), clips, times)
  process.stdout.write(JSON.stringify(result))
}

main()
