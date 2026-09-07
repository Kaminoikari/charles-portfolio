// Where does Seed-san's `spin` put things, in world space, and which node is
// nearest the column camera at head height? The clearance producer reports a
// column crown projection of 2.2274 against a world crown of 1.6115, which
// implies a drawn vertex ~1.24m in front of the body. Bones move meshes, so if
// anything is out there a bone is out there too.
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { buildRig, buildMotion, applyMotion } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'

// The clips are served from public/avatar; the bodies are not both there any
// more, because the fixture moved into scripts/avatar/fixtures after this was
// written. So a clip is looked up under the served directory and a body is
// named by its path from the repo root.
const asset = (p: string) => new Uint8Array(readFileSync(`/Users/charles/portfolio/public/avatar/${p}`))
const body = (p: string) => new Uint8Array(readFileSync(`/Users/charles/portfolio/${p}`))

for (const bodyPath of [
  'scripts/avatar/fixtures/seed-san.vrm',
  'public/avatar/AvatarSample_B_webp.vrm',
]) {
  const body_ = bodyPath
  const rig = buildRig(body(body_))
  console.log(`\n${body_}  version=${rig.version}  raw nodes=${rig.raw.length}`)
  for (const clip of ['spin', 'dance']) {
    const motion = buildMotion(asset(`animations/${clip}.vrma`))
    let far = { z: -Infinity, name: '', y: 0, t: 0 }
    let hips = { z: -Infinity, t: 0 }
    for (const t of motion.sampleTimes) {
      applyMotion(rig, motion, t)
      const hp = new THREE.Vector3().setFromMatrixPosition(rig.bones.hips.matrixWorld)
      if (hp.z > hips.z) hips = { z: hp.z, t }
      for (const node of rig.raw) {
        const p = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld)
        // Only what could be the crown: within 35cm below the head, which is
        // the band FrameCamera.top scans (REACH_BELOW).
        if (p.y < 1.25) continue
        if (p.z > far.z) far = { z: p.z, name: node.name || '(unnamed)', y: p.y, t }
      }
    }
    console.log(
      `  ${clip.padEnd(6)} furthest +z node above y=1.25: ${far.name} at z=${far.z.toFixed(3)} y=${far.y.toFixed(3)} t=${far.t.toFixed(2)}s` +
      `   hips max z ${hips.z.toFixed(3)} at ${hips.t.toFixed(2)}s`,
    )
  }
}
