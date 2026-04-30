import * as THREE from 'three'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  width: number
  height: number
  audio: AudioBus
  isMobile: boolean
  reducedMotion: boolean
}

export interface BeatScene {
  init(ctx: SceneContext): void
  enter(globalT: number): void
  update(globalT: number, localT: number, dt: number): void
  exit(): void
  dispose(): void
}

export interface Beat {
  name: string
  start: number
  end: number
  factory: () => BeatScene
}

export interface AudioBus {
  ctx: AudioContext
  master: GainNode
  reverbSend: GainNode
  reverb: ConvolverNode
}
