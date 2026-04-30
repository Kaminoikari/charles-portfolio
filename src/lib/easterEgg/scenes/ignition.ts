import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutCubic } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_phase;        // 0.0-0.5 = orbital strike, 0.5-1.0 = surface cracks
  uniform float u_beamFire;     // 0->1 strike intensity in phase 1
  uniform float u_crackSpread;  // 0->1 lava spread in phase 2
  uniform float u_cutFlash;     // 0->1 white flash during transition
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  // Cracks pattern: voronoi-like minus distance
  float cracks(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float minD = 10.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = vec2(hash(ip + g), hash(ip + g + 17.3));
        vec2 r = g + o - fp;
        minD = min(minD, dot(r, r));
      }
    }
    return sqrt(minD);
  }

  vec3 phaseOrbital(vec2 p) {
    // Deep space + planet arc at bottom
    vec3 col = vec3(0.005, 0.008, 0.020);
    float r = length(p - vec2(0.0, -1.05));
    float planetR = 0.85;
    float planetMask = smoothstep(planetR + 0.005, planetR, r);
    // Lit half (top): blue planet surface noise
    if (planetMask > 0.0) {
      vec3 surface = mix(vec3(0.05, 0.10, 0.30), vec3(0.20, 0.35, 0.65), fbm(p * 5.0));
      // Continent shadows
      surface *= 0.7 + 0.5 * fbm(p * 14.0 + 11.0);
      // Limb glow
      float limb = 1.0 - smoothstep(planetR - 0.04, planetR, r);
      vec3 atmoCol = vec3(0.45, 0.65, 1.0);
      col = mix(col, surface, planetMask) + atmoCol * (1.0 - limb) * 0.3 * planetMask;
    }

    // Vertical white light beam from top down to planet (target y ~ -0.15)
    float beamX = abs(p.x);
    float beamFire = u_beamFire;
    if (beamFire > 0.0) {
      float beamCore = exp(-pow(beamX / 0.006, 2.0));
      float beamHalo = exp(-pow(beamX / 0.04, 2.0)) * 0.4;
      float beamRange = step(p.y, 0.7) * step(-0.15, p.y);
      float beam = (beamCore + beamHalo) * beamRange;
      col += vec3(1.0, 0.98, 0.95) * beam * 1.6 * beamFire;

      // Impact flash at planet surface
      vec2 impact = p - vec2(0.0, -0.20);
      float impactGlow = exp(-length(impact) * 18.0) * pow(beamFire, 0.4);
      col += vec3(1.0, 0.85, 0.55) * impactGlow * 1.5;
    }

    // Stars
    float stars = step(0.997, fract(sin(dot(vUv * 1500.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.9, 0.95, 1.0) * stars * 0.5;

    return col;
  }

  vec3 phaseSurface(vec2 p) {
    // Equatorial close-up. Curved horizon line at y ~ 0.6 (planet surface arc).
    float horizon = 0.55 - p.x * p.x * 0.12;
    vec3 col = vec3(0.005, 0.005, 0.012);
    if (p.y > horizon) {
      // Sky / atmosphere
      col = mix(vec3(0.05, 0.08, 0.18), vec3(0.30, 0.20, 0.30), smoothstep(horizon, 0.95, p.y));
    } else {
      // Surface: dark rocky
      vec3 rock = vec3(0.04, 0.03, 0.04);
      rock *= 0.5 + 0.6 * fbm(p * 8.0 + 4.0);
      col = rock;

      // Lava cracks: voronoi distance threshold scaled by spread
      float ck = cracks(p * 4.0);
      float crackMask = smoothstep(0.04, 0.0, ck);
      // Spread radially from center (impact point)
      float impactDist = length(p);
      float spreadMask = smoothstep(u_crackSpread + 0.05, u_crackSpread - 0.05, impactDist);
      float lava = crackMask * spreadMask;
      vec3 lavaCol = mix(vec3(1.0, 0.30, 0.0), vec3(1.0, 0.85, 0.30), pow(lava, 0.6));
      col = mix(col, lavaCol, lava * 0.95);
      // Heat haze
      col += vec3(1.0, 0.55, 0.25) * lava * 0.6;
    }

    // Atmosphere top glow band
    col += vec3(0.5, 0.30, 0.4) * smoothstep(0.85, 0.95, p.y) * 0.4;
    return col;
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    vec3 col;
    if (u_phase < 0.5) col = phaseOrbital(p);
    else col = phaseSurface(p);

    // Cut flash: brief white overlay
    col = mix(col, vec3(1.0, 0.98, 0.92), u_cutFlash);

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createIgnition(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_phase: { value: 0 },
    u_beamFire: { value: 0 },
    u_crackSpread: { value: 0 },
    u_cutFlash: { value: 0 },
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
      // Phase 1 (orbital): 0.0-0.50, beam impact builds, peaks at 0.45
      // Phase 2 (surface): 0.50-1.00, cracks spread
      // Cut flash at 0.50
      if (lt < 0.50) {
        uniforms.u_phase.value = 0
        uniforms.u_beamFire.value = easeOutCubic(clamp01(lt / 0.40))
        uniforms.u_cutFlash.value = (lt > 0.46) ? (lt - 0.46) / 0.04 : 0
      } else {
        uniforms.u_phase.value = 1
        uniforms.u_cutFlash.value = (lt < 0.55) ? Math.max(0, 1 - (lt - 0.50) / 0.05) : 0
        uniforms.u_crackSpread.value = easeOutCubic(clamp01((lt - 0.55) / 0.40)) * 0.95
      }
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
