// The two populations SPRING_DOMINATED sits between, measured rather than recalled.
//
//     npx tsx scripts/avatar/evidence/springshare-0907-probe.ts
//
// springsim's SPRING_DOMINATED (0.4) decides which primitives are "hair that
// moves" when no build wrote a manifest. Its justification is a measurement on
// the one body whose manifest IS the truth: the shipped Milfy build. That
// measurement had no saved receipt until this probe, which is what it prints.
//
// It computes the spring-driven share the way deriveManifest does -- per vertex,
// the joint carrying the largest weight, tested against every node at or under a
// spring joint -- off the same readers (vrmHumanoid). It then asks deriveManifest
// itself what role each primitive landed in, so a share printed here that
// disagreed with the shipped classifier would show up as a mismatch line rather
// than as a number nobody checks.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { AVATAR_VARIANTS } from '../../../src/components/chat/avatarVariants'
import {
  parseGlb,
  readAccessorRows,
  readSprings,
  type GltfJson,
} from '../../../src/components/chat/vrmHumanoid'
import { deriveManifest } from '../springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
const MODEL = path.resolve('public', milfy.url.replace(/^\//, ''))

type Glb = Parameters<typeof deriveManifest>[0]
const raw = readFileSync(MODEL)
const parsed = parseGlb<Glb['json']>(new Uint8Array(raw))
if (!parsed.bin) throw new Error('no BIN chunk')
const glb: Glb = { json: parsed.json, bin: parsed.bin }
const json = glb.json as unknown as GltfJson

// Every node at or under a spring joint, both VRM versions.
const spring = new Set<number>()
const walk = (i: number): void => {
  if (spring.has(i)) return
  spring.add(i)
  for (const c of json.nodes[i].children ?? []) walk(c)
}
const source = readSprings(json)
if (source.kind === 'vrm0') {
  for (const g of source.secondaryAnimation.boneGroups ?? []) for (const b of g.bones ?? []) walk(b)
} else {
  for (const s of source.springBone.springs ?? []) for (const j of s.joints ?? []) walk(j.node)
}

// What the BUILD calls each primitive: the truth this threshold is fitted to.
const truth = JSON.parse(readFileSync(MODEL.replace(/\.vrm$/, '.parts.json'), 'utf8')) as {
  parts: Record<string, { mesh: string; primitives: number[] }>
}
const builtRole = new Map<string, string>()
for (const [name, part] of Object.entries(truth.parts)) {
  for (const pi of part.primitives) builtRole.set(`${part.mesh}[${pi}]`, name)
}

// And what the shipped derivation calls it, so the shares below are tied to the
// classifier they justify instead of to a re-implementation of it.
const derivedRole = new Map<string, string>()
for (const [name, part] of Object.entries(deriveManifest(glb).parts)) {
  for (const pi of part.primitives) derivedRole.set(`${part.mesh}[${pi}]`, name)
}

const rows: { key: string; share: number; verts: number; built: string; derived: string }[] = []
for (const node of glb.json.nodes) {
  if (node.mesh === undefined || node.skin === undefined) continue
  const mesh = glb.json.meshes[node.mesh]
  const skin = glb.json.skins[node.skin]
  mesh.primitives.forEach((prim, pi) => {
    const { JOINTS_0, WEIGHTS_0 } = prim.attributes
    if (JOINTS_0 === undefined || WEIGHTS_0 === undefined) return
    const jo = readAccessorRows(glb, JOINTS_0)
    const we = readAccessorRows(glb, WEIGHTS_0)
    const n = jo.data.length / jo.ncomp
    if (n === 0) return
    let driven = 0
    for (let v = 0; v < n; v++) {
      let best = 0
      for (let k = 1; k < we.ncomp; k++) {
        if (we.data[v * we.ncomp + k] > we.data[v * we.ncomp + best]) best = k
      }
      if (spring.has(skin.joints[jo.data[v * jo.ncomp + best]])) driven += 1
    }
    const key = `${mesh.name}[${pi}]`
    rows.push({
      key,
      share: driven / n,
      verts: n,
      built: builtRole.get(key) ?? '(not in the build manifest)',
      derived: derivedRole.get(key) ?? '(not derived)',
    })
  })
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`
const isHair = (name: string): boolean => name.startsWith('Hair_')
const builtHair = rows.filter((r) => isHair(r.built))
const others = rows.filter((r) => !isHair(r.built))
const movingHair = builtHair.filter((r) => r.share > 0)

console.log(`model ${path.basename(MODEL)}`)
console.log(`${rows.length} skinned primitives: ${builtHair.length} the build calls Hair_*, ${others.length} it calls something else`)
console.log('')
console.log('primitive                                    verts    spring-driven   build says            derived says')
for (const r of [...rows].sort((a, b) => b.share - a.share)) {
  console.log(
    `${r.key.padEnd(42)} ${String(r.verts).padStart(7)}   ${pct(r.share).padStart(12)}   ` +
    `${r.built.padEnd(21)} ${r.derived}`,
  )
}

const range = (xs: number[]): string =>
  xs.length === 0 ? '(none)' : `${pct(Math.min(...xs))}–${pct(Math.max(...xs))}`
console.log('')
console.log(`Hair_* with any spring share at all (${movingHair.length} of ${builtHair.length}): ${range(movingHair.map((r) => r.share))}`)
console.log(`Hair_* reading exactly 0% (bangs and scalp cap, skinned to the head bone): ${builtHair.length - movingHair.length}`)
console.log(`highest share among everything the build does NOT call hair: ${pct(Math.max(...others.map((r) => r.share)))}` +
  `  (${others.reduce((a, b) => (b.share > a.share ? b : a)).key})`)
console.log('')

// The gap the threshold sits in, and a check that this probe and the shipped
// classifier agree on every primitive.
const SPRING_DOMINATED = 0.4
const mismatches = rows.filter((r) => (r.share >= SPRING_DOMINATED) !== isHair(r.derived))
console.log(`threshold ${SPRING_DOMINATED}: ${rows.filter((r) => r.share >= SPRING_DOMINATED).length} primitives at or above it`)
console.log(mismatches.length === 0
  ? 'every primitive this probe puts above/below the threshold is the one deriveManifest calls hair/not-hair'
  : `MISMATCH on ${mismatches.length}: ${mismatches.map((r) => r.key).join(', ')}`)
