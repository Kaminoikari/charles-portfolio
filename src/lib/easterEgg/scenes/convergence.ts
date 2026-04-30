import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeInOutCubic, easeOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_pull;       // dolly-out 0->1
  uniform float u_cloudGrowth;
  uniform float u_cloudCollapse;
  uniform float u_crescentReveal;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    // Pull-back zooms field outward
    p /= (1.0 + u_pull * 1.4);
    float r = length(p);

    vec3 col = vec3(0.005, 0.008, 0.020);

    // Plasma cloud — fbm at multiple scales, rotating slowly.
    float ang = u_t * 0.18;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 cp = rot * p;

    float n1 = fbm(cp * 3.5 + u_t * 0.4);
    float n2 = fbm(cp * 7.0 - u_t * 0.6);
    float plasma = pow(n1 * 0.7 + n2 * 0.45, 1.4);

    // Radial mask: cloud grows then collapses
    float radius = 0.55 * u_cloudGrowth - 0.50 * u_cloudCollapse;
    radius = max(0.0, radius);
    float cloudMask = smoothstep(radius + 0.10, radius - 0.10, r);

    // Cloud color: blue-white with magenta filaments
    vec3 cloudA = vec3(0.55, 0.85, 1.0);
    vec3 cloudB = vec3(1.0, 0.85, 0.95);
    vec3 cloudC = vec3(0.60, 0.40, 0.85);
    vec3 cloudCol = mix(cloudA, cloudB, plasma);
    cloudCol += cloudC * pow(plasma, 3.0) * 0.4;
    col += cloudCol * cloudMask * plasma * 1.6;

    // Sharp dark "wedge" in cloud center (per Image #26): triangle pointing down
    float wedgeY = -p.y;
    float wedgeMask = smoothstep(0.20, 0.05, abs(p.x) - wedgeY * 0.4);
    wedgeMask *= smoothstep(0.0, 0.20, wedgeY);
    wedgeMask *= cloudMask;
    col *= 1.0 - wedgeMask * 0.85;

    // Crescent silhouette emerging late (Image #27)
    if (u_crescentReveal > 0.0) {
      vec2 cp2 = p - vec2(0.0, 0.05);
      float d = length(cp2);
      float crescent = smoothstep(0.13, 0.11, d) * (1.0 - smoothstep(0.10, 0.085, d - cp2.x * 0.4));
      vec3 crCol = vec3(0.85, 0.92, 1.0);
      col = mix(col, crCol * 1.4, crescent * u_crescentReveal);
      // Soft halo
      col += crCol * 0.4 * exp(-d * 14.0) * u_crescentReveal;
    }

    // Stars revealed as cloud collapses
    float stars = step(0.998, fract(sin(dot(vUv * 1900.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.85, 0.92, 1.0) * stars * (0.4 + 0.6 * u_cloudCollapse);

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createConvergence(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_pull: { value: 0 },
    u_cloudGrowth: { value: 0 },
    u_cloudCollapse: { value: 0 },
    u_crescentReveal: { value: 0 },
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
    update(t: number, localT: number) {
      const lt = clamp01(localT)
      uniforms.u_t.value = t
      uniforms.u_pull.value = easeOutCubic(lt) * 0.85
      // Cloud grows 0.0-0.45, holds 0.45-0.65, collapses 0.65-1.0
      uniforms.u_cloudGrowth.value = easeOutCubic(clamp01(lt / 0.40))
      uniforms.u_cloudCollapse.value = easeInOutCubic(clamp01((lt - 0.65) / 0.35))
      // Crescent reveals 0.55-0.85
      uniforms.u_crescentReveal.value = clamp01((lt - 0.55) / 0.30) *
        (lt > 0.85 ? Math.max(0, 1 - (lt - 0.85) / 0.15) : 1)
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
