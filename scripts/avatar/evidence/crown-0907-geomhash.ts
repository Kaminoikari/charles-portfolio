// Run: npx tsx scripts/avatar/evidence/crown-0907-geomhash.ts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseGlb, readAccessorRows, type GltfJson } from '/Users/charles/portfolio/src/components/chat/vrmHumanoid'
const geometry = (url: string): string => {
  const raw = readFileSync(path.join('/Users/charles/portfolio/public', url))
  const glb = parseGlb<GltfJson>(new Uint8Array(raw))
  const digest = createHash('sha256')
  for (const mesh of glb.json.meshes ?? []) for (const prim of mesh.primitives) {
    for (const key of Object.keys(prim.attributes).sort()) {
      const rows = readAccessorRows(glb as Parameters<typeof readAccessorRows>[0], prim.attributes[key])
      digest.update(key)
      digest.update(new Uint8Array(rows.data.buffer, rows.data.byteOffset, rows.data.byteLength))
    }
  }
  return digest.digest('hex').slice(0, 16)
}
for (const f of ['avatar/mika-pink.vrm', 'avatar/AvatarSample_B_webp.vrm', 'avatar/mika-milfy-12.vrm']) {
  console.log(`${f.padEnd(34)} ${geometry(f)}`)
}
