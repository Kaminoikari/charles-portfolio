// Which way the procedural bow actually carries her, on each family's own body.
//
// Its own file rather than a block in rigProbe.test.ts, because it needs
// `avatarGuideEngine`, and that module pulls GLTFLoader and three-vrm-animation
// in at import time: a 269-test file about rigs should not carry the engine's
// loader graph to ask one question. avatarPitch.test.ts, added the same day,
// covers the rest of the same class the same way: the other three gestures, and
// then the mode-driven gaze they all ride on. `bow` stays here because it
// has a browser pass of its own, from the commit that fixed it
// (evidence/bow-0910-browser.log); the other three share a later one
// (evidence/pitch-0910-browser.log).
//
// It was first written as a block in that file and moved here on a suspicion
// that the import was costing the suite real time. That suspicion did not
// survive measurement. Over the seven runs of the same 595 tests, this
// arrangement averaged 180.69s and the block-inside-rigProbe one 189.96s, so
// the split measured FASTER, and that is not a finding either: four runs of
// this arrangement on one checkout took 128.45s, 173.22s, 174.58s and 246.50s,
// a factor of 1.92 with nothing changed between them. Every full-suite run is in
// scripts/avatar/evidence/bow-0910-timing.log. The file stands on where the
// import belongs, not on a speed claim.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildRig, resetRig, type Rig } from './rigProbe'
import { facingSign } from './avatarMode'
import { gestureOffsets, type GestureName } from './avatarGuideEngine'
import { AVATAR_FAMILIES, type AvatarFamilyId } from './avatarVariants'

const asset = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', ...parts)))

// The same shape rigProbe.test.ts uses: every registered family, measured on
// the body its own clearance file says it was measured on.
interface Family {
  id: AvatarFamilyId
  body: string
}
const FAMILIES: readonly Family[] = Object.entries(AVATAR_FAMILIES).map(([id, clearance]) => ({
  id: id as AvatarFamilyId,
  body: clearance.measuredOn.replace(/^\/avatar\//, ''),
}))

const rigCache = new Map<string, Rig>()
function rigOfBody(body: string): Rig {
  let r = rigCache.get(body)
  if (!r) {
    r = buildRig(asset(body))
    rigCache.set(body, r)
  }
  resetRig(r)
  return r
}

// The procedural bow, on every registered family's own body.
//
// `bow` writes a POSITIVE pitch on spine and head, and a normalized bone's
// local axes follow the MODEL's, so that rotation carries her head toward the
// model's +Z whichever way the model faces. The two VRM versions face opposite
// ways along Z, so the one gesture leans a 0.x body AWAY from the viewer and
// bows a 1.0 body toward it. Every look this site offers is 0.x, so `bye` bowed
// backwards on screen (evidence/pitch-0909.log, armrest-0909.md).
//
// `bow` is the version-aware one. `leanBack` is that original curve under the
// name of what it does, unchanged, and pinned here too so the corrected gesture
// cannot quietly become an edit to the motion that already shipped.
describe.each(FAMILIES)('the procedural bow on $id', (fam: Family) => {
  /** How far this gesture carries her head along the way her eyes point. */
  function towardFace(name: GestureName): number {
    const r = rigOfBody(fam.body)
    const head = (): THREE.Vector3 =>
      new THREE.Vector3().setFromMatrixPosition(r.bones.head.matrixWorld)
    const head0 = head()
    const eye0 = new THREE.Vector3().setFromMatrixPosition(r.bones.leftEye.matrixWorld)
    const faceZ = Math.sign(eye0.z - head0.z)
    // Peak envelope, which is where the pose is deepest.
    const o = gestureOffsets(name, 0.5, 1, 1, facingSign(r.version))
    r.bones.spine.rotation.x = o.sx
    r.bones.head.rotation.x = o.hp
    r.root.updateMatrixWorld(true)
    return (head().z - head0.z) * faceZ
  }

  it('bow carries her head toward the viewer', () => {
    expect(towardFace('bow')).toBeGreaterThan(0.05)
  })

  // The test above cannot see the head term at all. It reads the HEAD bone's
  // own world position, and rotating a bone does not move its own origin, so
  // every millimetre it reports comes from `sx` on the spine. Dropping the
  // version term from `hp` alone left it, and every other test here, green.
  // So this one writes the head pitch and nothing else, and reads the EYE,
  // which sits about 57mm above the head pivot and therefore does swing.
  it('bow tips her face toward the viewer too, not just her torso', () => {
    const r = rigOfBody(fam.body)
    const eye = (): THREE.Vector3 =>
      new THREE.Vector3().setFromMatrixPosition(r.bones.leftEye.matrixWorld)
    const head = new THREE.Vector3().setFromMatrixPosition(r.bones.head.matrixWorld)
    const eye0 = eye()
    const faceZ = Math.sign(eye0.z - head.z)
    r.bones.head.rotation.x = gestureOffsets('bow', 0.5, 1, 1, facingSign(r.version)).hp
    r.root.updateMatrixWorld(true)
    // 0.18 rad about a pivot 57mm below the eye is roughly 10mm of swing, so
    // 5mm separates the right sign from the wrong one with room to spare.
    expect((eye().z - eye0.z) * faceZ).toBeGreaterThan(0.005)
  })

  it('leaves leanBack pitching toward the model own +Z, as bow always did', () => {
    // Not "toward her face": that IS what it does wrong, and pinning it here is
    // what stops the corrected gesture becoming a silent edit to this one.
    const want = rigOfBody(fam.body).version === '0' ? -1 : 1
    expect(Math.sign(towardFace('leanBack'))).toBe(want)
    expect(Math.abs(towardFace('leanBack'))).toBeGreaterThan(0.05)
  })
})
