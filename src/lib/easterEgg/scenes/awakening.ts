import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeInOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_pushIn;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    float r = length(p);
    float zoom = 1.0 - 0.06 * u_pushIn;
    p /= zoom;
    r = length(p);

    // Star core
    float core = exp(-r * r * 220.0) * 1.4;
    float halo = exp(-r * r * 14.0) * 0.18;
    float bigGlow = exp(-r * r * 2.4) * 0.04;

    // Subtle dust noise
    float dust = fbm(p * 6.0 + vec2(u_t * 0.05, 0.0));
    float dustField = pow(dust, 2.0) * 0.04;

    // Pale tint
    vec3 starCol = vec3(1.0, 0.94, 0.86) * (core + halo);
    vec3 dustCol = vec3(0.30, 0.38, 0.55) * dustField + vec3(0.45, 0.30, 0.42) * dustField * 0.4;
    vec3 col = starCol + vec3(1.0, 0.95, 0.88) * bigGlow + dustCol;

    // Faint stars
    float stars = step(0.9985, fract(sin(dot(vUv * 1500.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.9, 0.95, 1.0) * stars * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createAwakening(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_pushIn: { value: 0 },
    u_resolution: { value: new THREE.Vector2(1, 1) },
  }

  return {
    init(ctx: SceneContext) {
      uniforms.u_resolution.value.set(ctx.width, ctx.height)
      const geom = new THREE.PlaneGeometry(2, 2)
      const mat = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: FRAG,
        uniforms,
        depthTest: false,
        depthWrite: false,
      })
      mesh = new THREE.Mesh(geom, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = -10
      ctx.scene.add(mesh)
    },
    enter(_t: number) {},
    update(_t: number, localT: number) {
      uniforms.u_t.value = _t
      uniforms.u_pushIn.value = easeInOutCubic(clamp01(localT))
    },
    exit() {},
    dispose() {
      if (mesh) {
        mesh.parent?.remove(mesh)
        disposeMesh(mesh)
        mesh = null
      }
    },
  }
}
