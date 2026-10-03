import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { clipUnderLayers } from './handRest'

// A layer that turns a bone from where it stands, as restHand and
// limitRadialDeviation do.
const turnTen = (bone: THREE.Object3D) => bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(10)))
const angle = (bone: THREE.Object3D) => THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(bone.quaternion.w))))

describe('the clip under the layers', () => {
  it('turns a bone the mixer left alone this frame from the clip’s own turn, not last frame’s', () => {
    const bone = new THREE.Object3D()
    const layers = clipUnderLayers()
    // Frame 1: the mixer writes the clip's value (identity), the layer turns it.
    layers.begin([bone])
    turnTen(bone)
    layers.end()
    // Frames 2 and 3: the clip holds still, so three's mixer writes nothing.
    for (let i = 0; i < 2; i++) {
      layers.begin([bone])
      turnTen(bone)
      layers.end()
    }
    expect(angle(bone)).toBeCloseTo(10, 6)
  })

  it('keeps what the mixer wrote this frame', () => {
    const bone = new THREE.Object3D()
    const layers = clipUnderLayers()
    layers.begin([bone])
    turnTen(bone)
    layers.end()
    // The clip moves on: the mixer writes a new value, 30° about x.
    bone.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(30))
    const written = bone.quaternion.clone()
    layers.begin([bone])
    expect(bone.quaternion.equals(written)).toBe(true)
  })

  it('forgets every bone once cleared', () => {
    const bone = new THREE.Object3D()
    const layers = clipUnderLayers()
    layers.begin([bone])
    turnTen(bone)
    layers.end()
    layers.clear()
    // Whatever the bone now holds is the clip's, as far as the layers know.
    layers.begin([bone])
    expect(angle(bone)).toBeCloseTo(10, 6)
  })
})
