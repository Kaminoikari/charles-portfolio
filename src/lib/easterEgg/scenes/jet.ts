import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_burst;     // 0 -> 1 quick attack
  uniform float u_pan;       // -0.15 -> 0.15 sideways drift
  uniform float u_tilt;      // small fov hint
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    p.x += u_pan;

    float r = length(p);
    float ang = atan(p.y, p.x);

    // Background spiral residue (faded continuation of nebula)
    float swirl = fbm(vec2(ang * 1.5 + u_t * 0.4, r * 5.0));
    vec3 nebTint = mix(vec3(0.50, 0.16, 0.28), vec3(0.32, 0.12, 0.42), swirl);
    vec3 col = nebTint * exp(-r * 4.0) * 0.5;

    // Bipolar jets: vertical channels above and below center.
    // jetMask favors |x|<thin and |y|>0.05
    float vert = abs(p.x);
    float along = abs(p.y);
    float channelWidth = 0.018 + 0.04 * (1.0 - u_burst);
    float jetMask = smoothstep(channelWidth + 0.02, channelWidth, vert);
    // Flow noise stretched along y
    float flow = fbm(vec2(p.x * 30.0, p.y * 8.0 - u_t * 4.5));
    float energy = pow(flow, 2.2);
    // Length grows with burst
    float lengthMask = smoothstep(0.45 * u_burst + 0.05, 0.0, along - 0.05);
    float jet = jetMask * energy * lengthMask * (along > 0.04 ? 1.0 : 0.0);

    vec3 jetCol = mix(vec3(0.80, 0.92, 1.0), vec3(1.0, 0.55, 0.78), 1.0 - lengthMask);
    col += jetCol * jet * 1.7 * u_burst;

    // Bright accretion disk band across centre (horizontal)
    float diskMask = exp(-pow(p.y / 0.04, 2.0)) * smoothstep(0.45, 0.0, abs(p.x));
    float diskFlicker = 0.7 + 0.3 * sin(u_t * 14.0 + p.x * 30.0);
    vec3 diskCol = vec3(1.0, 0.85, 0.55) * diskMask * diskFlicker * u_burst * 1.4;
    col += diskCol;

    // Central hot core
    float core = exp(-r * r * 60.0) * u_burst * 1.2;
    col += vec3(1.0, 0.92, 0.72) * core;

    // Black singularity at r<0.012
    col *= 1.0 - smoothstep(0.018, 0.008, r);

    // Tilt = subtle vignetting on top/bottom
    col *= 1.0 - smoothstep(0.55, 0.85, abs(p.y) - u_tilt * 0.5) * 0.3;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createJet(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_burst: { value: 0 },
    u_pan: { value: 0 },
    u_tilt: { value: 0 },
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
      // Burst attack: ramp 0->1 over 0.25 then hold
      uniforms.u_burst.value = easeOutCubic(Math.min(1, lt * 4.0))
      // Sideways pan
      uniforms.u_pan.value = (lt - 0.5) * 0.18
      uniforms.u_tilt.value = lt * 0.15
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
