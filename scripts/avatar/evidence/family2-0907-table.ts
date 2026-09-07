// Run: npx tsx scripts/avatar/evidence/family2-0907-table.ts
//
// Every number in the "Why this body" table of
// docs/plans/avatar-family-vrm1-twist-sample.md, from the files themselves, so
// the table has a receipt instead of a recollection. It also covers Seed-san,
// whose measurements that document cites to argue why it is NOT the second
// family.
//
// The spring and collider counts are the ones worth reading carefully: VRM 0.x
// and 1.0 shape that extension differently, so "chains" and "colliders" have to
// be counted as the same thing on both sides or the column is comparing two
// different questions. Counted here:
//
//   chains     0.x `secondaryAnimation.boneGroups`, 1.0 `VRMC_springBone.springs`
//   colliders  the individual collider SHAPES, not the groups that hold them
//              (0.x colliderGroups[].colliders, 1.0 colliders[])
//   groups     the collider groups themselves, for both
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'

import { buildRig, deriveRestCrown, type Rig } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'
import { parseGlb, readAccessorRows, readHumanoid, rigOf, type GltfJson } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'
import { AVATAR_VARIANTS } from '/Users/charles/portfolio/src/components/chat/avatarVariants.ts'

// The frame's half width, the same number the sideways guard is read against.
const HALF_WIDTH = 0.7415

interface Row {
  label: string
  file: string
}

const ROWS: Row[] = [
  ...AVATAR_VARIANTS.map((v) => ({
    label: `${v.id} (${v.family})`,
    file: path.join('/Users/charles/portfolio/public', v.url.replace(/^\//, '')),
  })),
  { label: 'seed-san (fixture, not a variant)', file: '/Users/charles/portfolio/scripts/avatar/fixtures/seed-san.vrm' },
]

for (const row of ROWS) {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(readFileSync(row.file))
  } catch {
    console.log(`\n=== ${row.label}\n  ABSENT: ${row.file}`)
    continue
  }
  const glb = parseGlb<GltfJson>(bytes)
  const json = glb.json
  const ext = json.extensions ?? {}
  const humanoid = readHumanoid(json)
  const rig: Rig = buildRig(bytes)

  console.log(`\n=== ${row.label}`)
  console.log(`  file            ${row.file}`)
  console.log(`  size            ${statSync(row.file).size.toLocaleString()} bytes`)
  console.log(`  sha256          ${createHash('sha256').update(bytes).digest('hex')}`)
  console.log(`  rigSha          ${createHash('sha256').update(rigOf(json)).digest('hex')}`)
  console.log(`  VRM version     ${humanoid.version}   forwardZ ${humanoid.forwardZ}`)

  // Humanoid bones, and how many of them rest somewhere other than identity.
  // This is what makes a rig a different FAMILY rather than a recolour: a clip
  // retargeted onto it lands elsewhere.
  //
  // Measured as an ANGLE, not as "does the rotation array differ from
  // [0,0,0,1]". Files carry identity quaternions written with float noise (w a
  // hair over 1, xyz at 1e-9), and comparing the array counted 26 of those on
  // this body as rotated. The angle separates cleanly instead: on the twist
  // body the same 28 bones are over 0°, over 0.1° and over 1°, with nothing
  // in between.
  const bones = Object.entries(humanoid.bones)
  const degrees: number[] = []
  for (const [, node] of bones) {
    const r = json.nodes?.[node]?.rotation
    const q = r ? new THREE.Quaternion(r[0], r[1], r[2], r[3]) : new THREE.Quaternion()
    degrees.push(THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(q.w)))))
  }
  degrees.sort((a, b) => b - a)
  const over = (t: number): number => degrees.filter((d) => d > t).length
  console.log(
    `  humanoid bones  ${bones.length}   rest rotation over 0deg/0.1deg/1deg/5deg: ` +
      `${over(0)}/${over(0.1)}/${over(1)}/${over(5)}   max ${degrees[0].toFixed(2)}deg`,
  )

  // Springs, counted as the same thing on both versions (see the header).
  let chains = 0
  let colliders = 0
  let groups = 0
  if (ext.VRM?.secondaryAnimation) {
    const sa = ext.VRM.secondaryAnimation as {
      boneGroups?: unknown[]
      colliderGroups?: { colliders?: unknown[] }[]
    }
    chains = sa.boneGroups?.length ?? 0
    groups = sa.colliderGroups?.length ?? 0
    colliders = (sa.colliderGroups ?? []).reduce((n, g) => n + (g.colliders?.length ?? 0), 0)
  } else if (ext.VRMC_springBone) {
    const sb = ext.VRMC_springBone as {
      springs?: unknown[]
      colliders?: unknown[]
      colliderGroups?: unknown[]
    }
    chains = sb.springs?.length ?? 0
    colliders = sb.colliders?.length ?? 0
    groups = sb.colliderGroups?.length ?? 0
  }
  console.log(`  spring chains   ${chains}   collider shapes ${colliders}   collider groups ${groups}`)

  // Expressions, under whichever name the version gives them.
  const v0 = (ext.VRM?.blendShapeMaster as { blendShapeGroups?: unknown[] } | undefined)?.blendShapeGroups
  const v1 = (ext.VRMC_vrm?.expressions as { preset?: Record<string, unknown> } | undefined)?.preset
  console.log(
    `  expressions     ${v0 ? `${v0.length} VRM0 blendShapeGroups` : ''}${v1 ? `${Object.keys(v1).length} VRM1 presets` : ''}`,
  )

  console.log(`  resting crown   ${deriveRestCrown(glb, rig).toFixed(4)}`)

  // The widest DRAWN vertex, in bind pose, against the frame's half width. The
  // sideways guard measures humanoid JOINTS, so geometry hanging off bones no
  // humanoid entry claims is invisible to it; this is the check that is not.
  let widest = { x: -Infinity, mesh: '' }
  const nodeOfMesh = new Map<number, number>()
  ;(json.nodes ?? []).forEach((n, i) => {
    if (typeof n.mesh === 'number') nodeOfMesh.set(n.mesh, i)
  })
  let drawn = 0
  for (const [mi, mesh] of (json.meshes ?? []).entries()) {
    for (const prim of mesh.primitives) {
      const rowsAcc = readAccessorRows(glb as Parameters<typeof readAccessorRows>[0], prim.attributes.POSITION)
      const count = rowsAcc.data.length / rowsAcc.ncomp
      drawn += count
      for (let i = 0; i < count; i++) {
        const x = Math.abs(rowsAcc.data[i * rowsAcc.ncomp])
        if (x > widest.x) {
          widest = { x, mesh: json.nodes?.[nodeOfMesh.get(mi) ?? -1]?.name ?? `mesh${mi}` }
        }
      }
    }
  }
  const spare = (HALF_WIDTH - widest.x) * 1000
  console.log(
    `  widest vertex   ${widest.x.toFixed(4)} on ${widest.mesh} (${drawn.toLocaleString()} drawn) ` +
      `vs ${HALF_WIDTH} half width: ${spare >= 0 ? `${spare.toFixed(0)}mm spare` : `${(-spare).toFixed(0)}mm OUTSIDE`}`,
  )

  // Skinning joints no humanoid entry claims: geometry on them rides its
  // humanoid parent rigidly and no retarget ever poses it.
  const claimed = new Set(Object.values(humanoid.bones))
  const skinned = new Set<number>()
  for (const skin of json.skins ?? []) for (const j of skin.joints) skinned.add(j)
  const unclaimed = [...skinned].filter((j) => !claimed.has(j))
  console.log(`  skins           ${(json.skins ?? []).length}   joints outside the humanoid map: ${unclaimed.length}`)
  void THREE
}
