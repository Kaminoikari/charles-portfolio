import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutQuart } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_collapse;     // cloud→point 0->1
  uniform float u_haloFade;     // halo fade-in 0->1
  uniform float u_finalFade;    // overall alpha→0
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    float r = length(p);

    vec3 col = vec3(0.005, 0.008, 0.020);

    // Stars
    float stars = step(0.997, fract(sin(dot(vUv * 1700.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.85, 0.92, 1.0) * stars * 0.55;

    // Collapsing point: cloud shrinks 0.30 → 0.0, then halo expands.
    float cloudR = max(0.001, 0.30 * (1.0 - u_collapse));
    float cloudMask = smoothstep(cloudR + 0.05, cloudR - 0.02, r);
    float plasma = pow(fbm(p * 6.0 + u_t * 0.6), 1.4);
    col += vec3(0.65, 0.85, 1.0) * cloudMask * plasma * 1.4;

    // Bright pinprick at center as collapse completes
    float pin = exp(-r * r * 1500.0) * u_collapse;
    col += vec3(1.0, 0.95, 0.85) * pin * 1.8;

    // Hero halo emerging — orange ring (mimics existing accretion disk)
    float ringR = 0.22;
    float ring = exp(-pow((r - ringR) * 18.0, 2.0));
    col += vec3(1.0, 0.55, 0.20) * ring * u_haloFade * 1.4;
    // Inner soft glow
    col += vec3(1.0, 0.45, 0.12) * exp(-r * 5.0) * u_haloFade * 0.5;

    col *= u_finalFade;
    gl_FragColor = vec4(col, u_finalFade);
  }
`

export function createSnap(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_collapse: { value: 0 },
    u_haloFade: { value: 0 },
    u_finalFade: { value: 1 },
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
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      mesh = new THREE.Mesh(geom, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = -10
      ctx.scene.add(mesh)
    },
    enter(_t: number) {},
    update(t: number, localT: number) {
      const lt = clamp01(localT)
      uniforms.u_t.value = t
      uniforms.u_collapse.value = easeOutQuart(clamp01(lt / 0.35))
      // Halo fades in 0.30-0.65, holds 0.65-0.85, fades out via finalFade
      uniforms.u_haloFade.value = clamp01((lt - 0.30) / 0.35) *
        (lt > 0.85 ? Math.max(0, 1 - (lt - 0.85) / 0.15) : 1)
      uniforms.u_finalFade.value = lt < 0.85 ? 1 : easeOutQuart(Math.max(0, 1 - (lt - 0.85) / 0.15))
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
