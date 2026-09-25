// A spring joint keeps its tail in world space, captured when the file loads.
// rotateVRM0 then turns a 0.x body round (and pinArms lowers the arms the
// sleeve springs hang from), so on the first update every tail sits on the
// far side of where its bone now points and the chain whips back across.
// 2026-09-25: HairSample_Female's and AvatarSample_A's breasts swung out
// through the blouse for the first second after load; Mika's did not show.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'
import { VRMSpringBoneJoint, VRMSpringBoneManager } from '@pixiv/three-vrm'
import { describe, expect, it } from 'vitest'

import { restSprings } from './springRest'

function body() {
  const scene = new THREE.Group()
  const chest = new THREE.Bone()
  chest.position.set(0, 1.2, 0)
  const bust = new THREE.Bone()
  bust.position.set(0.08, 0, 0.06)
  const tip = new THREE.Bone()
  tip.position.set(0, 0, 0.07)
  scene.add(chest)
  chest.add(bust)
  bust.add(tip)
  scene.updateMatrixWorld(true)
  const springBoneManager = new VRMSpringBoneManager()
  springBoneManager.addJoint(
    new VRMSpringBoneJoint(bust, tip, { stiffness: 0.75, dragForce: 0.05, gravityPower: 0, hitRadius: 0.02 }),
  )
  springBoneManager.setInitState()
  return { scene, springBoneManager, bust }
}

function swingAfterTurn(rest: boolean) {
  const vrm = body()
  vrm.scene.rotation.y = Math.PI // what VRMUtils.rotateVRM0 does to a 0.x body
  if (rest) restSprings(vrm)
  const before = vrm.bust.quaternion.clone()
  let most = 0
  for (let i = 0; i < 60; i++) {
    vrm.scene.updateMatrixWorld(true)
    vrm.springBoneManager.update(1 / 60)
    most = Math.max(most, vrm.bust.quaternion.angleTo(before))
  }
  return THREE.MathUtils.radToDeg(most)
}

// pinArms writes the normalized rig; three-vrm copies it onto the raw bones
// the springs hang from only in humanoid.update(), the first thing vrm.update()
// does. A sleeve spring under a raw arm still in its T-pose caught its tail
// there and whipped down on the first frame.
function sleeveAfterPin(rest: boolean) {
  const scene = new THREE.Group()
  const arm = new THREE.Bone()
  arm.position.set(0.2, 1.4, 0)
  const cuff = new THREE.Bone()
  cuff.position.set(0.25, 0, 0)
  const tip = new THREE.Bone()
  tip.position.set(0, -0.08, 0)
  scene.add(arm)
  arm.add(cuff)
  cuff.add(tip)
  scene.updateMatrixWorld(true)
  const springBoneManager = new VRMSpringBoneManager()
  springBoneManager.addJoint(
    new VRMSpringBoneJoint(cuff, tip, { stiffness: 0.75, dragForce: 0.05, gravityPower: 0, hitRadius: 0.02 }),
  )
  springBoneManager.setInitState()
  let pinned = false
  const humanoid = { update: () => { if (pinned) arm.rotation.z = -1.2 } }
  const vrm = { scene, springBoneManager, humanoid }
  pinned = true // pinArms: the normalized arm is down, the raw one not yet
  if (rest) restSprings(vrm)
  let most = 0
  for (let i = 0; i < 60; i++) {
    vrm.humanoid.update()
    vrm.scene.updateMatrixWorld(true)
    vrm.springBoneManager.update(1 / 60)
    most = Math.max(most, cuff.quaternion.angleTo(new THREE.Quaternion()))
  }
  return THREE.MathUtils.radToDeg(most)
}

describe('restSprings', () => {
  it('a sleeve under an arm pinned down has no swing left to play out', () => {
    expect(sleeveAfterPin(true)).toBeLessThan(0.5)
  })

  it('without it the pinned arm swings the sleeve (the premise)', () => {
    expect(sleeveAfterPin(false)).toBeGreaterThan(20)
  })

  it('a turned body has no swing left to play out', () => {
    expect(swingAfterTurn(true)).toBeLessThan(0.5)
  })

  it('without it the same turn swings the joint (the premise)', () => {
    expect(swingAfterTurn(false)).toBeGreaterThan(20)
  })

  it('the engine rests the springs after turning and posing the body', () => {
    const src = readFileSync(path.join(__dirname, 'avatarGuideEngine.ts'), 'utf8')
    const at = (s: string) => src.indexOf(s)
    expect(at('restSprings(loaded)')).toBeGreaterThan(at('VRMUtils.rotateVRM0(loaded)'))
    expect(at('restSprings(loaded)')).toBeGreaterThan(at('pinArms(loaded)'))
    expect(at('VRMUtils.rotateVRM0(loaded)')).toBeGreaterThan(0)
    expect(at('pinArms(loaded)')).toBeGreaterThan(0)
  })
})
