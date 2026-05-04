import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeInOutCubic, easeOutCubic, easeOutQuart } from './shared'

// Snap-home: 4-phase finale that bridges Convergence's bright pinpoint back
// to the homepage black-hole shader.
//   A 0.00-0.20  Warp transit through the pinpoint (radial streaks, white burst)
//   B 0.20-0.55  Galaxy reveal (vast spiral fills the frame as we exit hyperspace)
//   C 0.55-0.85  Dolly toward galactic core, bulge resolves into accretion disk
//   D 0.85-1.00  Match homepage lens-ring composition; overlay opacity fades to 0
const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_warpStreak;
  uniform float u_centerBurst;
  uniform float u_galaxyReveal;
  uniform float u_galaxyHold;
  uniform float u_galaxyScale;
  uniform float u_diskForm;
  uniform float u_homeMatch;
  uniform float u_finalFade;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

  // Quantized radial streaks. Each angular bucket holds a single star moving
  // outward at its own speed; streak length scales with intensity so we get a
  // smooth ramp into and out of warp without popping artifacts.
  float warpStreaks(vec2 p, float t, float intensity) {
    float r = length(p);
    if (r < 0.005 || intensity <= 0.0) return 0.0;
    float ang = atan(p.y, p.x);
    float bucket = floor(ang * 110.0 / 6.28318);
    float h = hash1(bucket * 17.3 + 4.7);
    if (h < 0.45) return 0.0;
    float angCenter = (bucket + 0.5) * 6.28318 / 110.0;
    float angDiff = ang - angCenter;
    angDiff = mod(angDiff + 3.14159, 6.28318) - 3.14159;
    float speed = 0.7 + h * 1.6;
    float headR = fract(h * 11.0 + t * speed) * 1.5;
    float len = 0.18 + 0.55 * intensity;
    float along = headR - r;
    if (along < 0.0 || along > len) return 0.0;
    float radProfile = (1.0 - along / len) * intensity;
    float angProfile = exp(-pow(angDiff * r * 70.0, 2.0));
    return radProfile * angProfile * 1.6;
  }

  // Spiral galaxy with two prominent arms, dust lanes, HII bright spots, and
  // a luminous core. The whole field rotates slowly so it feels alive during
  // the reveal. galaxyScale lets the runner dolly toward the core.
  vec3 galaxy(vec2 p, float t, float reveal) {
    if (reveal <= 0.0) return vec3(0.0);
    float r = length(p);
    float ang = atan(p.y, p.x);
    // Logarithmic spiral coordinate for two-arm structure.
    float spiralAng = ang + log(r + 0.02) * 2.55 + t * 0.05;
    float armPhase = mod(spiralAng + 1.5708, 3.14159);
    float armBand = exp(-pow((armPhase - 1.5708) * 1.7, 2.0));
    float detail = fbm(vec2(spiralAng * 1.6, r * 8.5));
    float armDensity = armBand * pow(detail, 1.15);
    // Dust lanes: thin dark streaks along the arms.
    float dust = pow(fbm(vec2(spiralAng * 4.5, r * 28.0)), 2.6);
    // HII regions: rare bright pink/blue knots embedded in the arms.
    float hiiSeed = hash1(floor(spiralAng * 12.0) + floor(r * 18.0) * 41.0);
    float hii = step(0.93, hiiSeed) * exp(-pow((fract(spiralAng * 12.0) - 0.5) * 6.0, 2.0));
    float radial = exp(-r * r * 3.6);
    vec3 cCore = vec3(1.0, 0.86, 0.55);
    vec3 cArm = vec3(0.55, 0.78, 1.0);
    vec3 cDust = vec3(0.80, 0.45, 0.60);
    vec3 cHii = vec3(1.0, 0.55, 0.85);
    float coreMix = exp(-r * r * 60.0);
    vec3 baseCol = mix(cArm, cCore, coreMix * 0.85);
    baseCol += cDust * armDensity * 0.18;
    vec3 result = baseCol * armDensity * radial * 1.4;
    // HII glow.
    result += cHii * hii * armDensity * 0.6;
    // Galactic bulge.
    result += cCore * exp(-r * r * 220.0) * 3.4;
    // Dust dimming.
    result *= 1.0 - dust * armDensity * 0.55;
    return result * reveal;
  }

  // Accretion disk that reads as the homepage black-hole's lens at idle.
  // Same warm orange palette and similar ring radius so the cross-fade lands.
  vec3 accretionDisk(vec2 p, float t, float intensity) {
    if (intensity <= 0.0) return vec3(0.0);
    float r = length(p);
    float ang = atan(p.y, p.x);
    float ringR = 0.22;
    float ring = exp(-pow((r - ringR) * 16.0, 2.0));
    float doppler = 0.75 + 0.55 * (cos(ang + t * 0.6) * 0.5 + 0.5);
    float fil = pow(fbm(vec2(ang * 6.0 + t * 1.4, r * 22.0)), 1.4);
    vec3 ringCol = vec3(1.0, 0.55, 0.20) * ring * doppler * (0.55 + fil * 0.65);
    vec3 glow = vec3(1.0, 0.45, 0.12) * exp(-r * 5.0) * 0.55;
    float dark = smoothstep(0.06, 0.0, r);
    return (ringCol + glow) * intensity * (1.0 - dark);
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    vec3 col = vec3(0.005, 0.008, 0.020);

    // Star field. Stretches anisotropically while warp is active so even the
    // background reads as motion. Streched coord goes to identity by phase B.
    float starStretch = 1.0 + u_warpStreak * 6.0;
    vec2 starP = vec2(p.x / starStretch, p.y);
    float stars = step(0.9982, fract(sin(dot((starP * 1.6 + 0.5) * 1700.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.85, 0.92, 1.0) * stars * (0.55 + u_galaxyReveal * 0.35);

    // Warp streaks (phase A).
    float streakI = warpStreaks(p, u_t, u_warpStreak);
    col += vec3(0.85, 0.95, 1.0) * streakI;

    // Center burst: handoff from convergence's pinpoint, blooms then decays.
    float r = length(p);
    float burstCore = exp(-r * r * 380.0);
    col += vec3(1.0, 0.97, 0.88) * burstCore * u_centerBurst * 5.0;
    float burstHalo = exp(-r * r * 22.0);
    col += vec3(1.0, 0.85, 0.62) * burstHalo * u_centerBurst * 0.85;

    // Galaxy view, scaled by dolly factor (smaller scale = we are further away
    // and galaxy fills less of the frame; bigger scale = closer to the core).
    vec2 gp = p / max(0.001, u_galaxyScale);
    col += galaxy(gp, u_t, u_galaxyReveal * u_galaxyHold);

    // Accretion disk fades in as we land on the black-hole composition.
    col += accretionDisk(p, u_t, u_diskForm);

    // Homepage match: bright thin lens ring + soft warm halo. Cross-fades on
    // top of the disk so the final frame reads as the homepage lens.
    if (u_homeMatch > 0.0) {
      float lensR = 0.22;
      float lensCore = exp(-pow((r - lensR) * 22.0, 2.0));
      vec3 lensCol = vec3(1.0, 0.78, 0.42) * lensCore * 1.7;
      float swirl = pow(fbm(p * 6.0 + u_t * 0.3), 1.6);
      lensCol += vec3(1.0, 0.55, 0.20) * swirl * exp(-r * 4.0) * 0.5;
      // Inner darkness so the lens reads as a hole in space.
      lensCol *= 1.0 - smoothstep(0.06, 0.0, r);
      col = mix(col, lensCol, u_homeMatch);
    }

    col *= u_finalFade;
    gl_FragColor = vec4(col, u_finalFade);
  }
`

export function createSnap(): BeatScene {
  let mesh: THREE.Mesh | null = null
  let overlayEl: HTMLElement | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_warpStreak: { value: 0 },
    u_centerBurst: { value: 1 },
    u_galaxyReveal: { value: 0 },
    u_galaxyHold: { value: 1 },
    u_galaxyScale: { value: 0.45 },
    u_diskForm: { value: 0 },
    u_homeMatch: { value: 0 },
    u_finalFade: { value: 1 },
    u_resolution: { value: new THREE.Vector2(1, 1) },
  }

  return {
    init(ctx: SceneContext) {
      uniforms.u_resolution.value.set(ctx.width, ctx.height)
      // Locate the easter-egg overlay so we can crossfade its opacity into
      // the homepage in the final 250ms instead of dropping to black first.
      // Disable the runner's 0.18s transition; we drive opacity directly per
      // frame so it tracks the shader phase without lag.
      overlayEl = document.querySelector('[data-easter-egg="true"]') as HTMLElement | null
      if (overlayEl) overlayEl.style.transition = 'none'
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

      // Phase A: warp streaks 0.00-0.30, peak at 0.10 then decay.
      uniforms.u_warpStreak.value =
        lt < 0.10 ? easeOutQuart(lt / 0.10) : Math.max(0, 1 - (lt - 0.10) / 0.20)

      // Center burst: starts hot (handoff from convergence pinpoint), decays
      // through phase A so the galaxy can take over.
      uniforms.u_centerBurst.value =
        lt < 0.04
          ? 1.0 + lt / 0.04 * 0.4 // brief flare on entry
          : Math.max(0, 1.4 - (lt - 0.04) / 0.28)

      // Galaxy reveals once warp settles. Holds visible across mid-section.
      const galRev = clamp01((lt - 0.18) / 0.30)
      uniforms.u_galaxyReveal.value = easeOutCubic(galRev)
      uniforms.u_galaxyHold.value =
        lt < 0.70 ? 1.0 : Math.max(0, 1 - (lt - 0.70) / 0.18)

      // Dolly toward the galactic core: galaxy emerges at near-full frame
      // size (vast) and the camera then pushes deeper toward the bulge so the
      // accretion disk handoff happens against an over-scaled core.
      uniforms.u_galaxyScale.value =
        lt < 0.55
          ? 0.85 + 0.20 * easeOutCubic(clamp01((lt - 0.20) / 0.35))
          : 1.05 + 1.10 * easeInOutCubic(clamp01((lt - 0.55) / 0.30))

      // Accretion disk forms 0.55-0.85, taking the role the galactic core
      // played a moment ago.
      uniforms.u_diskForm.value = easeOutCubic(clamp01((lt - 0.55) / 0.30))

      // Final homepage lens-match composition lays in over the disk.
      uniforms.u_homeMatch.value = easeInOutCubic(clamp01((lt - 0.78) / 0.20))

      // Hold the rendered scene at full intensity through the very end so the
      // overlay opacity crossfade carries the visual continuity into the
      // homepage. Gentle sub-tail in the last 6% just to soften any edge.
      uniforms.u_finalFade.value = lt < 0.94 ? 1 : Math.max(0.55, 1 - (lt - 0.94) / 0.06 * 0.45)

      // Crossfade the overlay element into the page during the last 250ms so
      // the homepage lens shader bleeds through underneath the matched composition.
      if (overlayEl) {
        const fade = lt < 0.78 ? 1 : Math.max(0, 1 - (lt - 0.78) / 0.22)
        overlayEl.style.opacity = String(fade)
      }
    },
    exit() {
      if (overlayEl) {
        overlayEl.style.opacity = '0'
      }
    },
    dispose() {
      if (mesh) {
        mesh.parent?.remove(mesh)
        disposeMesh(mesh)
        mesh = null
      }
      overlayEl = null
    },
  }
}
