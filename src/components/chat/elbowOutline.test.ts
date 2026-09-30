import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import { ELBOW_OUTLINE, elbowOutlineKeep, MTOON_OUTLINE_OFFSET, thinOutlinesAtElbows } from './elbowOutline'

// MToon's vertex shader as installed: the patch edits it by string, so an
// upgrade that rewrites the line would leave every outline untouched.
const MTOON_VERTEX = (() => {
  const lib = readFileSync(
    path.resolve(__dirname, '../../../node_modules/@pixiv/three-vrm-materials-mtoon/lib/three-vrm-materials-mtoon.module.js'),
    'utf8',
  )
  const literal = lib.match(/var mtoon_default = ("(?:[^"\\]|\\.)*");/)
  if (!literal) throw new Error('MToon vertex shader not found in the installed three-vrm')
  return JSON.parse(literal[1]) as string
})()

const count = (text: string, part: string) => text.split(part).length - 1

describe('the outline near her elbows', () => {
  const elbow = new THREE.Vector3(0.4, 1.3, 0)
  const at = (d: number) => [elbow.x + d, elbow.y, elbow.z]

  it('is gone at the joint, whole from ELBOW_OUTLINE.full out, and grows in between', () => {
    const ds = [0, 0.03, ELBOW_OUTLINE.none, 0.05, 0.06, ELBOW_OUTLINE.full, 0.2]
    const keep = elbowOutlineKeep(ds.flatMap(at), [elbow])
    expect(keep[0]).toBe(0)
    expect(keep[1]).toBe(0)
    expect(keep[2]).toBeCloseTo(0, 9)
    expect(keep[5]).toBe(1)
    expect(keep[6]).toBe(1)
    for (let i = 1; i < ds.length; i++) expect(keep[i]).toBeGreaterThanOrEqual(keep[i - 1])
    expect(keep[3]).toBeGreaterThan(0)
    expect(keep[3]).toBeLessThan(1)
  })

  it('is all but gone out to where the notch was, 4cm from the joint', () => {
    // On Gishin's waving elbow a taper from 2.5cm to 6cm, which kept 39% of
    // the outline at 4cm, still left a dotted trace of the notch.
    const [four] = elbowOutlineKeep(at(0.04), [elbow])
    expect(four).toBeLessThan(0.1)
  })

  it('measures from the nearer elbow', () => {
    const other = new THREE.Vector3(-0.4, 1.3, 0)
    const [near] = elbowOutlineKeep([-0.4, 1.3, 0.01], [elbow, other])
    expect(near).toBe(0)
  })

  it('patches the one line in MToon that pushes the hull out', () => {
    expect(count(MTOON_VERTEX, MTOON_OUTLINE_OFFSET)).toBe(1)
    expect(count(MTOON_VERTEX, 'void main() {')).toBe(1)
  })
})

describe('thinOutlinesAtElbows', () => {
  // A two-bone arm skinned in a bind pose that is not the identity, beside a
  // plain mesh drawn with the same outline material.
  function body() {
    const upper = new THREE.Bone()
    const fore = new THREE.Bone()
    upper.add(fore)
    fore.position.set(0.25, 0, 0)
    const root = new THREE.Group()
    root.position.set(0, 1.3, 0)
    root.add(upper)
    root.updateMatrixWorld(true)
    const skeleton = new THREE.Skeleton([upper, fore])
    const geo = new THREE.BufferGeometry()
    // Local x: at the elbow, 5cm past it, 20cm past it.
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0.25, 1.3, 0, 0.3, 1.3, 0, 0.45, 1.3, 0].map((v, i) => (i % 3 === 1 ? v - 1.3 : v)), 3))
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4))
    const skin = new THREE.MeshBasicMaterial()
    const outline = Object.assign(new THREE.MeshBasicMaterial(), { isOutline: true as const })
    let ownHookRan = false
    outline.onBeforeCompile = () => {
      ownHookRan = true
    }
    outline.customProgramCacheKey = () => 'mtoon'
    const arm = new THREE.SkinnedMesh(geo, [skin, outline])
    root.add(arm)
    arm.bind(skeleton, root.matrixWorld)
    const plainGeo = new THREE.BufferGeometry()
    plainGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.25, 0, 0, 0, 0, 0], 3))
    const plain = new THREE.Mesh(plainGeo, outline)
    root.add(plain)
    const vrm = {
      scene: root,
      humanoid: { getRawBoneNode: (b: string) => (b === 'leftLowerArm' ? fore : null) },
    } as unknown as VRM
    return { vrm, arm, plain, outline, ownHookRan: () => ownHookRan }
  }

  it('keeps each vertex its share of the outline by its distance from the elbow in the bind pose', () => {
    const { vrm, arm } = body()
    thinOutlinesAtElbows(vrm)
    const keep = arm.geometry.getAttribute('outlineKeep')
    expect(keep.getX(0)).toBe(0)
    expect(keep.getX(1)).toBeGreaterThan(0)
    expect(keep.getX(1)).toBeLessThan(1)
    expect(keep.getX(2)).toBe(1)
  })

  it('gives every mesh the material draws an outlineKeep, whole where no bone skins it', () => {
    const { vrm, plain } = body()
    thinOutlinesAtElbows(vrm)
    const keep = plain.geometry.getAttribute('outlineKeep')
    expect(keep.count).toBe(2)
    expect(Array.from(keep.array)).toEqual([1, 1])
  })

  it("scales the hull by it after MToon's own compile hook, under its own program key", () => {
    const { vrm, outline, ownHookRan } = body()
    thinOutlinesAtElbows(vrm)
    const shader = { vertexShader: MTOON_VERTEX, fragmentShader: '', uniforms: {} } as unknown as THREE.WebGLProgramParametersWithUniforms
    outline.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    expect(ownHookRan()).toBe(true)
    expect(shader.vertexShader).toContain('attribute float outlineKeep;')
    expect(shader.vertexShader).toContain('vec3 outlineOffset = outlineKeep * outlineWidthFactor * worldNormalLength * objectNormal;')
    expect(outline.customProgramCacheKey()).toBe('mtoon,elbowOutline')
  })
})
