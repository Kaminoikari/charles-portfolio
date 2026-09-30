// The outline at her elbows.
//
// MToon draws its outline as an inverted hull: every vertex pushed out along
// its normal by the outline width, drawn back faces only. Where a bent elbow
// folds her skin through itself, the hull of the skin underneath comes out
// through the skin on top, and the back faces show as a short black notch at
// the point of the elbow. Measured on Gishin in the wave (elbow bent 125°,
// outline 0.8mm): hiding the outline takes the notch away and so does zeroing
// the arm's own outline, rolls or no rolls (2026-09-30). Thinning only the
// vertices the upper arm and forearm share did not: the skin that folds
// through belongs to one bone or the other, farther from the joint than a
// taper to 2.5cm reaches (the radii below bound it; it was not measured).
//
// So the outline tapers to nothing near each elbow, by distance in the bind
// pose. At ELBOW_OUTLINE.full and beyond it is untouched. Inside
// ELBOW_OUTLINE.none it is gone. Rendered on the same elbow: a taper from
// 1.5cm to 4cm left the notch, one from 2.5cm to 6cm left it as a dotted
// trace (a hull even a few percent wide still comes through), and 3.5cm to
// 7cm and 4cm to 8cm both left clean skin.
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'

/** Metres from the elbow joint, in the bind pose: no outline inside `none`, all of it past `full`. */
export const ELBOW_OUTLINE = { none: 0.035, full: 0.07 } as const

/** The line in MToon's vertex shader that sets the hull offset; the patch scales it. */
export const MTOON_OUTLINE_OFFSET = 'vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;'

/** How much of the outline each vertex keeps, from its bind-pose position and the elbows'. */
export function elbowOutlineKeep(positions: ArrayLike<number>, elbows: readonly THREE.Vector3[]): Float32Array {
  const keep = new Float32Array(positions.length / 3).fill(1)
  if (elbows.length === 0) return keep
  const p = new THREE.Vector3()
  for (let i = 0; i < keep.length; i++) {
    p.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
    let d = Infinity
    for (const e of elbows) d = Math.min(d, e.distanceTo(p))
    keep[i] = THREE.MathUtils.smoothstep(d, ELBOW_OUTLINE.none, ELBOW_OUTLINE.full)
  }
  return keep
}

interface OutlineMaterial extends THREE.Material {
  isOutline: true
}

function isOutline(m: THREE.Material): m is OutlineMaterial {
  return (m as Partial<OutlineMaterial>).isOutline === true
}

/**
 * Thins every outline near her elbows. Each mesh drawn with an outline gets an
 * `outlineKeep` attribute (1 where no elbow is near, and on a mesh no bone
 * skins), and each outline material scales its hull by it. The attribute goes
 * on every mesh an outline material draws, not only the skinned ones: a
 * material patched here reads 0 from a mesh without it, and that mesh would
 * lose its outline whole.
 */
export function thinOutlinesAtElbows(vrm: VRM): void {
  const elbowNodes = (['leftLowerArm', 'rightLowerArm'] as const)
    .map((b) => vrm.humanoid?.getRawBoneNode(b))
    .filter((n): n is THREE.Object3D => !!n)
  const patched = new Set<THREE.Material>()
  vrm.scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const outlines = [mesh.material].flat().filter(isOutline)
    if (outlines.length === 0) return
    const position = mesh.geometry.getAttribute('position')
    let keep: Float32Array = new Float32Array(position.count).fill(1)
    const skinned = mesh as THREE.SkinnedMesh
    if (skinned.isSkinnedMesh) {
      const elbows: THREE.Vector3[] = []
      for (const node of elbowNodes) {
        const i = skinned.skeleton.bones.indexOf(node as THREE.Bone)
        if (i >= 0) elbows.push(new THREE.Vector3().setFromMatrixPosition(skinned.skeleton.boneInverses[i].clone().invert()))
      }
      const bind = new Float32Array(position.count * 3)
      const p = new THREE.Vector3()
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).applyMatrix4(skinned.bindMatrix)
        bind.set([p.x, p.y, p.z], 3 * i)
      }
      keep = elbowOutlineKeep(bind, elbows)
    }
    mesh.geometry.setAttribute('outlineKeep', new THREE.BufferAttribute(keep, 1))
    for (const m of outlines) patched.add(m)
  })
  for (const m of patched) patchOutline(m)
}

function patchOutline(m: THREE.Material): void {
  const compile = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey.bind(m)
  m.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float outlineKeep;\nvoid main() {')
      .replace(MTOON_OUTLINE_OFFSET, MTOON_OUTLINE_OFFSET.replace('= ', '= outlineKeep * '))
  }
  m.customProgramCacheKey = () => `${key()},elbowOutline`
  m.needsUpdate = true
}
