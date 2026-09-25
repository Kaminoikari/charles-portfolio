import type * as THREE from 'three'

interface Sprung {
  scene: THREE.Object3D
  springBoneManager?: { setInitState(): void } | null
  humanoid?: { update(): void } | null
}

/**
 * Take the pose the body stands in now as every spring's rest, tails included.
 * Call it once the body is turned and posed and before the first update.
 * A pose written to the normalized rig reaches the raw bones the springs hang
 * from only in humanoid.update(), so that runs first.
 */
export function restSprings(vrm: Sprung): void {
  vrm.humanoid?.update()
  vrm.scene.updateMatrixWorld(true)
  vrm.springBoneManager?.setInitState()
}
