import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS, MIKA_MOUTH_URL, borrowedMouthOfUrl } from './avatarVariants'

// Why seven bodies wear Mika's mouth.
//
// VRoid lays one texture over the inside of the mouth: teeth top-left, tongue
// top-right, throat below. Mika's (and Milfy's and base's, the same 14KB PNG)
// paints the tongue quarter small and pale, so an open mouth reads as a plain
// pale mouth. Seven of the newer samples paint a full-size saturated tongue
// with a shaded rim, and MToon never puts the inside of the mouth in shadow, so
// every "aa" and "oh" showed a bright tongue filling the lips: it read as the
// tongue stuck out (the owner's report, 2026-09-25). Darkening that texture
// was tried first and still showed the tongue's outline; the owner asked for
// Mika's and Milfy's mouth, so these bodies get exactly that texture.

function publicFile(url: string): Buffer {
  return readFileSync(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
}

interface MouthGltf {
  materials: Array<{ name: string; pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }>
  textures: Array<{ source?: number; extensions?: { EXT_texture_webp?: { source: number } } }>
  images: Array<{ bufferView: number }>
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>
}

function glbOf(url: string): { doc: MouthGltf; bin: Buffer } {
  const raw = publicFile(url)
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const jsonLength = view.getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLength))) as MouthGltf
  return { doc, bin: raw.subarray(20 + jsonLength + 8) }
}

function mouthMaterials(doc: MouthGltf): MouthGltf['materials'] {
  return doc.materials.filter((m) => /FaceMouth/.test(m.name))
}

function mouthImageBytes(url: string): Buffer {
  const { doc, bin } = glbOf(url)
  const texture = doc.textures[mouthMaterials(doc)[0].pbrMetallicRoughness!.baseColorTexture!.index]
  const image = doc.images[texture.source ?? texture.extensions!.EXT_texture_webp!.source]
  const view = doc.bufferViews[image.bufferView]
  return bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
}

describe("Mika's mouth", () => {
  it('is the very image mika-pink-2 carries', () => {
    expect(publicFile(MIKA_MOUTH_URL).equals(mouthImageBytes('/avatar/mika-pink-2.vrm'))).toBe(true)
  })

  it('is the image Milfy carries too, which is why the owner could name both', () => {
    expect(publicFile(MIKA_MOUTH_URL).equals(mouthImageBytes('/avatar/mika-milfy-12.vrm'))).toBe(true)
  })
})

describe('which bodies borrow it', () => {
  it('leaves a body nobody declared as its file has it', () => {
    expect(borrowedMouthOfUrl('/avatar/some-fresh-build.vrm')).toBeNull()
  })

  it('leaves Mika and Milfy on their own', () => {
    expect(borrowedMouthOfUrl('/avatar/mika-pink-2.vrm')).toBeNull()
    expect(borrowedMouthOfUrl('/avatar/mika-milfy-12.vrm')).toBeNull()
  })

  it('hands the seven painted-tongue bodies her mouth', () => {
    expect(borrowedMouthOfUrl('/avatar/Victoria_Rubin_webp.vrm')).toBe(MIKA_MOUTH_URL)
  })

  // A borrowing body whose file has no FaceMouth material would keep its
  // bright tongue with nothing failing: the engine finds the material by name
  // and simply finds nothing to swap.
  it.each(AVATAR_VARIANTS.filter((v) => v.mouth === 'mika').map((v) => [v.id, v.url] as const))(
    '%s has one FaceMouth material with a texture to swap',
    (_id, url) => {
      const mouth = mouthMaterials(glbOf(url).doc)
      expect(mouth).toHaveLength(1)
      expect(mouth[0].pbrMetallicRoughness?.baseColorTexture).toBeDefined()
    },
  )
})

describe('engine wiring', () => {
  const SOURCE = readFileSync(
    path.join(process.cwd(), 'src', 'components', 'chat', 'avatarGuideEngine.ts'),
    'utf8',
  )
  const install = SOURCE.slice(SOURCE.indexOf('function installVrm('), SOURCE.indexOf('function uninstallVrm('))

  it('looks the mouth up by the url of the body being installed', () => {
    expect(install).toMatch(/borrowedMouthOfUrl\(url\)/)
    // The same name the registry test above checks each borrowing file for.
    expect(install).toMatch(/mouthUrl && \/FaceMouth\/\.test\(m\.name\)/)
  })

  it('swaps both textures MToon draws the mouth with', () => {
    expect(install).toMatch(/\[\s*\w+\.map,\s*\w+\.shadeMultiplyTexture\s*\]/)
    expect(install).toMatch(/\.image = \w+/)
  })

  // The image arrives after the body. A swap to another look in between must
  // not paint Mika's mouth onto textures that were just disposed.
  it('drops a mouth that lands after its body has left', () => {
    expect(install).toMatch(/if \(vrm !== loaded\) return/)
  })
})
