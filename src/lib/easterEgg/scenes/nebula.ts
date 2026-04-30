import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_bloom;     // 0 -> 1 over the beat
  uniform float u_zoom;      // 0.3 -> 0.7 vis ratio
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  // 2D rotation
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    // Camera push-in: shrink p (make scene look bigger)
    p /= u_zoom;
    float r = length(p);
    float ang = atan(p.y, p.x);

    // Spiral coordinates: combine angle with log radius for arms
    float spiralAng = ang + log(r + 1e-3) * 1.7 + u_t * 0.55;
    vec2 sp = vec2(r, spiralAng);

    // Spiral fbm density along the swirl
    float swirl = fbm(vec2(spiralAng * 1.3, r * 4.0 + u_t * 0.6));
    float armMask = pow(swirl, 1.4);

    // Radial decay
    float radDecay = exp(-r * r * 5.5);
    float density = armMask * radDecay * u_bloom;

    // Three-tone palette: pink -> magenta -> gold core
    vec3 cPink = vec3(1.0, 0.40, 0.55);
    vec3 cMag  = vec3(0.85, 0.30, 0.95);
    vec3 cGold = vec3(1.0, 0.78, 0.30);

    float coreT = 1.0 - smoothstep(0.0, 0.45, r);
    vec3 baseCol = mix(cPink, cMag, smoothstep(0.0, 0.5, swirl));
    baseCol = mix(baseCol, cGold, coreT * 0.9);

    // Filament golden firelines pulled into core
    float fil = pow(fbm(vec2(spiralAng * 4.0, r * 14.0 - u_t * 1.2)), 3.0);
    vec3 filCol = cGold * fil * coreT * 1.6;

    vec3 col = baseCol * density * 1.6 + filCol * u_bloom;

    // Singularity hint at very centre — small black core surrounded by hot rim
    float sing = smoothstep(0.05, 0.02, r);
    col *= 1.0 - sing;
    float rim = exp(-pow((r - 0.05) * 36.0, 2.0));
    col += vec3(1.0, 0.65, 0.25) * rim * u_bloom * 1.2;

    // Background star sparkle
    float stars = step(0.9985, fract(sin(dot(vUv * 1500.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.85, 0.9, 1.0) * stars * 0.4;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createNebula(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_bloom: { value: 0 },
    u_zoom: { value: 0.3 },
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
      uniforms.u_t.value = t
      const lt = clamp01(localT)
      uniforms.u_bloom.value = easeOutCubic(Math.min(1, lt * 1.4))
      uniforms.u_zoom.value = 0.3 + (0.7 - 0.3) * easeOutCubic(lt)
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
