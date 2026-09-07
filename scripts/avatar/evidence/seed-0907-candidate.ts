// Run: npx tsx scripts/avatar/evidence/seed-0907-candidate.ts <path-to.vrm>
//
// Everything a candidate second body has to answer before anyone measures it.
// Written after Seed-san failed the one property nobody had checked: it draws a
// 1.21m robot arm off 32 bones no humanoid entry claims, so it is outside the
// frame in bind pose and no honest clearance file exists for it under the
// site's compositions. The sideways guard measures humanoid JOINTS, which is
// why that never showed up until the crown (a vertex measure) read 2.2274.
import { readFileSync } from 'node:fs'
import * as THREE from 'three'

import { parseGlb, readAccessorRows, readHumanoid, type GltfJson } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'
import { buildRig } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'

const HALF_WIDTH = 0.7415 // the launcher/waist-up budget, measure-motions FRAMES

const file = process.argv[2]
if (!file) throw new Error('usage: seed-0907-candidate.ts <path-to.vrm>')
const raw = new Uint8Array(readFileSync(file))
const glb = parseGlb<GltfJson>(raw)
const json = glb.json

const vrm1 = json.extensions?.VRMC_vrm as
  | { specVersion?: string; meta?: Record<string, unknown>; humanoid?: { humanBones?: Record<string, unknown> }; expressions?: { preset?: Record<string, unknown> } }
  | undefined
const vrm0 = json.extensions?.VRM as { meta?: Record<string, unknown> } | undefined

console.log(`${file}\n  ${raw.byteLength.toLocaleString()} bytes, VRM ${vrm1 ? `1.0 (specVersion ${vrm1.specVersion})` : '0.x'}`)

const meta = (vrm1?.meta ?? vrm0?.meta ?? {}) as Record<string, unknown>
console.log('  meta:')
for (const key of ['name', 'authors', 'author', 'copyrightInformation', 'licenseUrl', 'avatarPermission',
  'allowRedistribution', 'modification', 'commercialUsage', 'creditNotation', 'allowedUserName',
  'violentUssageName', 'sexualUssageName', 'commercialUssageName', 'otherLicenseUrl']) {
  if (meta[key] !== undefined) console.log(`    ${key.padEnd(24)} ${JSON.stringify(meta[key])}`)
}

// The rig, through the same reader every producer uses.
const rig = buildRig(raw)
const humanoid = readHumanoid(json)
const bones = Object.keys(humanoid.bones)
const nonIdentity = bones.filter((b) => {
  const q = json.nodes[humanoid.bones[b]]?.rotation
  return q !== undefined && !(Math.abs(q[0]) < 1e-6 && Math.abs(q[1]) < 1e-6 && Math.abs(q[2]) < 1e-6)
})
console.log(`  humanoid: ${bones.length} bones, ${nonIdentity.length} with a non-identity rest rotation` +
  `${bones.includes('upperChest') ? '' : ', no upperChest'}${bones.includes('leftToes') ? '' : ', no toes'}`)

const springs = (json.extensions?.VRMC_springBone ?? (json.extensions?.VRM as { secondaryAnimation?: unknown } | undefined)?.secondaryAnimation) as
  | { springs?: unknown[]; colliders?: unknown[]; boneGroups?: unknown[]; colliderGroups?: unknown[] }
  | undefined
console.log(`  springs: ${(springs?.springs ?? springs?.boneGroups ?? []).length} chains, ` +
  `${(springs?.colliders ?? springs?.colliderGroups ?? []).length} colliders` +
  `   expressions: ${Object.keys(vrm1?.expressions?.preset ?? {}).length} presets`)

// Every drawn vertex, in bind pose. This is the check Seed-san failed.
const nodeOfMesh = new Map<number, number>()
json.nodes.forEach((n, i) => { if (n.mesh !== undefined) nodeOfMesh.set(n.mesh, i) })
let widest = { x: -Infinity, mesh: '' }
let top = -Infinity
let verts = 0
console.log('  meshes:')
for (const [mi, mesh] of (json.meshes ?? []).entries()) {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  let n = 0
  for (const prim of mesh.primitives) {
    const rows = readAccessorRows(glb as Parameters<typeof readAccessorRows>[0], prim.attributes.POSITION)
    const count = rows.data.length / rows.ncomp
    n += count
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = rows.data[i * rows.ncomp + k]
        if (v < lo[k]) lo[k] = v
        if (v > hi[k]) hi[k] = v
      }
    }
  }
  verts += n
  top = Math.max(top, hi[1])
  const name = json.nodes[nodeOfMesh.get(mi) ?? -1]?.name ?? mesh.name ?? `mesh${mi}`
  const wide = Math.max(Math.abs(lo[0]), hi[0])
  if (wide > widest.x) widest = { x: wide, mesh: name }
  console.log(`    ${name.slice(0, 24).padEnd(25)} ${String(n).padStart(6)} verts   ` +
    `x ${lo[0].toFixed(2)}…${hi[0].toFixed(2)}  y ${lo[1].toFixed(2)}…${hi[1].toFixed(2)}  z ${lo[2].toFixed(2)}…${hi[2].toFixed(2)}`)
}

// Bones no humanoid entry claims and no spring chain drives are bones nothing
// poses; geometry on them rides the humanoid parent rigidly.
const claimed = new Set(Object.values(humanoid.bones))
const unclaimed = json.nodes.filter((_, i) => !claimed.has(i) && json.nodes[i].name && json.skins?.some((s) => s.joints.includes(i)))
// A magnitude against a HALF width, so which edge it lands on (rigProbe.screenX)
// does not enter into it.
const screen = widest.x
console.log(`\n  height ${top.toFixed(4)}   ${verts.toLocaleString()} drawn vertices   ` +
  `${unclaimed.length} skinning joints outside the humanoid map`)
console.log(`  widest drawn vertex: ${widest.mesh} at |x| ${widest.x.toFixed(3)}m -> ${screen.toFixed(4)} screen units ` +
  `against a ${HALF_WIDTH} half-width budget: ${screen < HALF_WIDTH ? `FITS, ${((HALF_WIDTH - screen) * 1000).toFixed(0)}mm spare` : `OUT OF FRAME by ${((screen - HALF_WIDTH) * 1000).toFixed(0)}mm`}`)
console.log(`  rig version as the pipeline reads it: ${rig.version}`)
void THREE
