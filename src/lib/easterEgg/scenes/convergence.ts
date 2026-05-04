import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeInOutCubic, easeOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_pull;
  uniform float u_cloudGrowth;
  uniform float u_cloudCollapse;
  uniform float u_pinpoint;
  uniform float u_filamentPull;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    p /= (1.0 + u_pull * 1.4);
    float r = length(p);
    float ang = atan(p.y, p.x);

    vec3 col = vec3(0.005, 0.008, 0.020);

    // Plasma cloud, slowly rotating fbm at multiple scales.
    float swirlAng = u_t * 0.18;
    mat2 rot = mat2(cos(swirlAng), -sin(swirlAng), sin(swirlAng), cos(swirlAng));
    vec2 cp = rot * p;

    float n1 = fbm(cp * 3.5 + u_t * 0.4);
    float n2 = fbm(cp * 7.0 - u_t * 0.6);
    float plasma = pow(n1 * 0.7 + n2 * 0.45, 1.4);

    float radius = 0.55 * u_cloudGrowth - 0.50 * u_cloudCollapse;
    radius = max(0.0, radius);
    float cloudMask = smoothstep(radius + 0.10, radius - 0.10, r);

    vec3 cloudA = vec3(0.55, 0.85, 1.0);
    vec3 cloudB = vec3(1.0, 0.85, 0.95);
    vec3 cloudC = vec3(0.60, 0.40, 0.85);
    vec3 cloudCol = mix(cloudA, cloudB, plasma);
    cloudCol += cloudC * pow(plasma, 3.0) * 0.4;
    col += cloudCol * cloudMask * plasma * 1.6;

    // Late-phase gravitational filaments: cloud matter streaming inward to the
    // forming pinpoint. Anisotropic noise stretched along the radial axis so
    // we read it as flow toward center rather than turbulence.
    if (u_filamentPull > 0.0) {
      float radialPhase = r * 9.0 - u_t * 1.6;
      float filDetail = pow(fbm(vec2(ang * 6.0, radialPhase)), 2.4);
      float filFalloff = exp(-r * 3.4) * (1.0 - smoothstep(0.0, 0.04, r));
      // Avoid over-bright pixel at exact center; carve the inner 0.04 out.
      float innerCarve = smoothstep(0.02, 0.08, r);
      float filaments = filDetail * exp(-r * 3.4) * innerCarve;
      col += vec3(0.92, 0.97, 1.0) * filaments * u_filamentPull * 1.2;
      col += vec3(1.0, 0.78, 0.45) * filFalloff * u_filamentPull * 0.18;
    }

    // White-hot pinpoint condensing at center. Sharp gaussian core plus a
    // wider warm halo so the handoff to the warp beat reads as a star, not a
    // spec of pixel noise.
    float pinCore = exp(-r * r * 2400.0);
    col += vec3(1.0, 0.98, 0.92) * pinCore * u_pinpoint * 9.0;
    float pinHalo = exp(-r * r * 50.0);
    col += vec3(1.0, 0.78, 0.45) * pinHalo * u_pinpoint * 0.55;

    // Stars revealed as cloud collapses.
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
    u_pinpoint: { value: 0 },
    u_filamentPull: { value: 0 },
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
      // Cloud grows 0.0-0.40, holds 0.40-0.60, collapses 0.60-1.0.
      uniforms.u_cloudGrowth.value = easeOutCubic(clamp01(lt / 0.40))
      uniforms.u_cloudCollapse.value = easeInOutCubic(clamp01((lt - 0.60) / 0.40))
      // Filaments stream inward 0.55-0.95 (peak around 0.80).
      const filT = clamp01((lt - 0.55) / 0.40)
      uniforms.u_filamentPull.value = filT * (1.0 - 0.4 * Math.max(0, (lt - 0.85) / 0.15))
      // Pinpoint forms 0.70-1.00, fully ignited by handoff so the warp beat
      // can take over the same bright dot at frame 0.
      uniforms.u_pinpoint.value = easeOutCubic(clamp01((lt - 0.70) / 0.30))
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
