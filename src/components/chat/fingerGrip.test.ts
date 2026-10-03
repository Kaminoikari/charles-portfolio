import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { AVATAR_MOTIONS } from './avatarMotions'
import { fingerGrip, HIP_GRIP } from './idlePose'
import { buildRigFrom, resetRig, syncRig } from './rigProbe'
import { parseGlb } from './vrmHumanoid'

// A finger rests running out along her side, palm down, in both versions'
// normalized space; a 0.x body faces -Z, a 1.0 body +Z, so her left is +X on
// one and -X on the other.
const out = (version: '0' | '1', side: 'left' | 'right') => new THREE.Vector3((side === 'left' ? 1 : -1) * (version === '0' ? -1 : 1), 0, 0)

describe('fingerGrip', () => {
  for (const version of ['0', '1'] as const) {
    for (const side of ['left', 'right'] as const) {
      it(`curls every finger toward the palm, at every joint, on a ${version}.x ${side} hand`, () => {
        const grip = fingerGrip(version, side, HIP_GRIP)
        for (const finger of ['Index', 'Middle', 'Ring', 'Little']) {
          let dir = out(version, side)
          for (const seg of ['Proximal', 'Intermediate', 'Distal']) {
            const q = grip.get(`${side}${finger}${seg}`)!
            const next = dir.clone().applyQuaternion(q)
            // Down, toward the palm, and by more at every joint.
            expect(next.y, `${finger}${seg}`).toBeLessThan(dir.y)
            dir = next
          }
        }
      })

      it(`fans the little finger away from the index on a ${version}.x ${side} hand`, () => {
        const grip = fingerGrip(version, side, HIP_GRIP)
        const forward = new THREE.Vector3(0, 0, version === '0' ? -1 : 1)
        const index = out(version, side).applyQuaternion(grip.get(`${side}IndexProximal`)!).dot(forward)
        const little = out(version, side).applyQuaternion(grip.get(`${side}LittleProximal`)!).dot(forward)
        // The index finger is the forward one on a hand hanging palm down.
        expect(index).toBeGreaterThan(little)
      })
    }
  }

  it('holds akimbo’s fingers in the hip grip', () => {
    expect(AVATAR_MOTIONS.akimbo.fingers).toBe(HIP_GRIP)
  })

  // On real skeletons, one of each version: a spread takes the index and
  // little fingertips apart. Until 2026-10-03 a 0.x hand squeezed them
  // together instead (50mm to 20mm on milfy at 20°).
  for (const file of ['mika-milfy-13.vrm', 'vrm1-twist-sample.vrm']) {
    it(`fans the fingers apart on ${file}`, () => {
      const glb = parseGlb(new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', file))))
      const rig = buildRigFrom(glb)
      for (const side of ['left', 'right'] as const) {
        const apart = () => {
          syncRig(rig)
          const at = (b: string) => rig.humanoid.getRawBoneNode(b as never)!.getWorldPosition(new THREE.Vector3())
          return at(`${side}IndexDistal`).distanceTo(at(`${side}LittleDistal`))
        }
        resetRig(rig)
        const rest = apart()
        for (const [bone, q] of fingerGrip(rig.version as '0' | '1', side, { curl: [0, 0, 0], thumb: 0, spread: [-20, 0, 20, 20] })) rig.bones[bone].quaternion.copy(q)
        expect(apart(), `${side}: ${(rest * 1000).toFixed(0)}mm at rest`).toBeGreaterThan(rest * 1.3)
      }
    })
  }
})
