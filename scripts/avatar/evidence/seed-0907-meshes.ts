// Run: npx tsx scripts/avatar/evidence/seed-0907-meshes.ts
//
// What geometry is actually in Seed-san, and where does it sit in bind pose?
// The clearance producer read a column crown projection of 2.2274 on a body
// 1.5800 tall, and the furthest-forward node above head height during `spin` is
// `robo_f_pinky.03.L` at z=1.547 -- a bone that is not part of the humanoid
// rig. If drawn geometry hangs off bones like that, every measurement taken on
// this file is measuring more than the avatar.
import { readFileSync } from 'node:fs'
import { parseGlb, readAccessorRows, type GltfJson } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid.ts'

// The fixture moved out of public/avatar into scripts/avatar/fixtures after
// these were written, so the path is taken as given (absolute, or relative to
// the repo root) rather than assembled from a directory that no longer holds it.
const resolve = (p: string): string =>
  p.startsWith('/') ? p : `/Users/charles/portfolio/${p}`
const BODY = process.argv[2] ?? 'scripts/avatar/fixtures/seed-san.vrm'
const raw = new Uint8Array(readFileSync(resolve(BODY)))
const glb = parseGlb<GltfJson>(raw)
const json = glb.json

const nodeOfMesh = new Map<number, number>()
json.nodes.forEach((n, i) => {
  if (n.mesh !== undefined) nodeOfMesh.set(n.mesh, i)
})

console.log(`meshes=${json.meshes?.length ?? 0}  nodes=${json.nodes.length}  skins=${json.skins?.length ?? 0}`)
console.log('mesh                              prims   verts    x range         y range         z range')
for (const [mi, mesh] of (json.meshes ?? []).entries()) {
  let n = 0
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
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
  const nodeIndex = nodeOfMesh.get(mi)
  const name = json.nodes[nodeIndex ?? -1]?.name ?? mesh.name ?? `mesh${mi}`
  const r = (k: number) => `${lo[k].toFixed(2)}…${hi[k].toFixed(2)}`.padEnd(15)
  console.log(`${name.slice(0, 32).padEnd(33)} ${String(mesh.primitives.length).padStart(4)} ${String(n).padStart(7)}   ${r(0)} ${r(1)} ${r(2)}`)
}

// The bones no humanoid entry claims: these are what a retarget never poses.
const humanoid = ((json.extensions?.VRMC_vrm ?? json.extensions?.VRM) as { humanoid?: { humanBones?: Record<string, { node: number }> } } | undefined)?.humanoid
const claimed = new Set(Object.values(humanoid?.humanBones ?? {}).map((b) => b.node))
const robo = json.nodes.map((n, i) => [i, n.name ?? ''] as const).filter(([, name]) => name.startsWith('robo'))
console.log(`\nhumanoid bones: ${claimed.size}   nodes named robo*: ${robo.length}` +
  `   of those in the humanoid map: ${robo.filter(([i]) => claimed.has(i)).length}`)

// The sideways guard measures humanoid JOINTS (rigProbe.silhouetteJoints). On a
// body whose widest geometry hangs off bones no humanoid entry claims, that
// proxy stops describing the silhouette. Both numbers, in the frame's own
// screen units, so they compare with the 0.7415 half-width budget. The budget is
// a HALF width and this is a magnitude, so rigProbe.screenX -- which only decides
// which of the two edges a point lands on -- has nothing to say about it.
let widest = { x: -Infinity, mesh: '' }
for (const [mi, mesh] of (json.meshes ?? []).entries()) {
  for (const prim of mesh.primitives) {
    const rows = readAccessorRows(glb as Parameters<typeof readAccessorRows>[0], prim.attributes.POSITION)
    const count = rows.data.length / rows.ncomp
    for (let i = 0; i < count; i++) {
      const x = Math.abs(rows.data[i * rows.ncomp])
      if (x > widest.x) {
        widest = { x, mesh: json.nodes[nodeOfMesh.get(mi) ?? -1]?.name ?? `mesh${mi}` }
      }
    }
  }
}
console.log(`\nwidest drawn vertex in bind pose: ${widest.mesh} at |x| ${widest.x.toFixed(3)}m` +
  `  -> ${widest.x.toFixed(4)} in screen units, against a 0.7415 half-width budget`)
