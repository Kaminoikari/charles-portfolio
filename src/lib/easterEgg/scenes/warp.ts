import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeInOutCubic } from './shared'

// 2D approximation of Gargantua-style gravitational lensing.
// Strategy:
//   • Treat the disk as a 2D ring in equatorial plane.
//   • For each pixel, the "view ray" curves around the black hole.
//   • Approximate by sampling the disk at TWO angles per pixel:
//     - one going "above" the BH (top half of ∞)
//     - one going "below" (bottom half of ∞)
//   • Combine and apply Doppler tinting.
const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_zoom;       // 1.0 -> ~1.4 (camera pulled in)
  uniform float u_warp;       // 0 -> 1 (lensing intensity ramp on entry)
  uniform float u_appear;     // 0 -> 1 (overall scene fade-in)
  uniform float u_horizonAlpha;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  // SDF helpers
  float ringSample(float dist, float diskInner, float diskOuter, float angle) {
    if (dist < diskInner || dist > diskOuter) return 0.0;
    // Density falls off with radius and has filaments.
    float radial = smoothstep(diskInner, diskInner + 0.04, dist) * smoothstep(diskOuter, diskOuter - 0.10, dist);
    float fil = pow(fbm(vec2(angle * 4.0 + u_t * 1.6, dist * 16.0)), 1.6);
    return radial * fil;
  }

  vec3 diskColor(float radial) {
    // Gold core blending to deep orange, then to magenta at outer edges.
    vec3 cInner = vec3(1.0, 0.92, 0.55);
    vec3 cMid   = vec3(1.0, 0.55, 0.18);
    vec3 cOuter = vec3(0.9, 0.30, 0.50);
    return mix(cMid, cInner, smoothstep(0.0, 0.6, radial)) + cOuter * 0.15 * (1.0 - radial);
  }

  void main() {
    vec2 p = (vUv - 0.5);
    p.x *= u_resolution.x / u_resolution.y;
    p /= u_zoom;

    float r = length(p);
    float ang = atan(p.y, p.x);

    // Background dim + faint nebula echo
    vec3 col = vec3(0.010, 0.012, 0.020);
    col += vec3(0.05, 0.05, 0.10) * pow(fbm(p * 2.0 + u_t * 0.05), 2.0) * 0.5;

    // Black hole shadow at origin (event horizon disc)
    float horizonR = 0.10;
    float horizonMask = smoothstep(horizonR + 0.005, horizonR, r);
    // Photon ring (Einstein ring) thin bright halo at ~1.5 horizon
    float photon = exp(-pow((r - horizonR * 1.5) * 90.0, 2.0)) * 0.85;
    col += vec3(1.0, 0.85, 0.55) * photon * u_warp;

    // Disk parameters (in the lens-warped image plane, the disk wraps around BH).
    float diskInner = 0.13;
    float diskOuter = 0.50;

    // ─── Lensing trick ─────────────────────────────────────────────────
    // For each pixel above the BH, also imagine a light ray that came
    // from BEHIND the BH and curved over the top to reach us. Sample disk
    // at the antipodal angle scaled by deflection.
    // Direct: treat disk as inclined at ~60° (so we see top crescent + lower disk).
    // Inclination flattens y by 0.45 for the in-plane disk sample.
    vec2 disk1 = vec2(p.x, p.y / 0.45);
    float r1 = length(disk1);
    float ang1 = atan(disk1.y, disk1.x);
    float d1 = ringSample(r1, diskInner, diskOuter, ang1);

    // Lensed (the "wrapped over top" image). Bend x↔-x and amplify y.
    // This approximates Einstein ring → ∞ shape.
    vec2 disk2 = vec2(-p.x, (p.y - sign(p.y) * 0.15) / 0.30);
    float r2 = length(disk2);
    float ang2 = atan(disk2.y, disk2.x);
    float d2 = ringSample(r2, diskInner, diskOuter * 1.1, ang2) * 0.55;

    // Doppler shift: ang ~ 0 (right side, approaching) is hotter/brighter,
    // ang ~ pi (left side, receding) cooler/dimmer.
    float dopp1 = 0.7 + 0.6 * (cos(ang1) * 0.5 + 0.5);
    float dopp2 = 0.7 + 0.6 * (cos(ang2) * 0.5 + 0.5);

    vec3 d1Col = diskColor(d1) * d1 * dopp1;
    vec3 d2Col = diskColor(d2) * d2 * dopp2;

    // Compose. Both disks are blocked by the horizon.
    float bhMask = step(horizonR, r);
    col += (d1Col + d2Col) * 1.4 * bhMask * u_warp;

    // Subtle planet horizon glow at bottom
    float planetGlow = smoothstep(-0.55, -0.42, p.y) * (1.0 - smoothstep(-0.42, -0.30, p.y));
    col += vec3(0.30, 0.45, 0.85) * planetGlow * 0.5 * u_appear;

    // Stars
    float stars = step(0.9985, fract(sin(dot(vUv * 1700.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.85, 0.92, 1.0) * stars * 0.4;

    // Hard horizon black
    col *= horizonMask;
    // Add photon ring even atop horizon (bright thin outline)
    col += vec3(1.0, 0.78, 0.42) * photon * (1.0 - horizonMask) * u_horizonAlpha;

    col *= u_appear;
    gl_FragColor = vec4(col, 1.0);
  }
`

export function createWarp(): BeatScene {
  let mesh: THREE.Mesh | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let savedFov = 60
  const uniforms = {
    u_t: { value: 0 },
    u_zoom: { value: 1.0 },
    u_warp: { value: 0 },
    u_appear: { value: 0 },
    u_horizonAlpha: { value: 1 },
    u_resolution: { value: new THREE.Vector2(1, 1) },
  }

  return {
    init(ctx: SceneContext) {
      camera = ctx.camera
      savedFov = ctx.camera.fov
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
      uniforms.u_warp.value = easeInOutCubic(clamp01(lt / 0.4))
      uniforms.u_appear.value = clamp01(lt / 0.18) * (lt > 0.95 ? Math.max(0, 1 - (lt - 0.95) / 0.05) : 1)
      uniforms.u_zoom.value = 1.0 + 0.42 * easeInOutCubic(lt)
      // Camera FOV pull from 60 → 30 over the beat (matches script)
      if (camera) {
        camera.fov = 60 - 30 * easeInOutCubic(lt)
        camera.position.set(0, 0, 5)
        camera.lookAt(Math.sin(t * 0.4) * 0.05 * lt, 0, 0)
        camera.updateProjectionMatrix()
      }
    },
    exit() {
      if (camera) {
        camera.fov = savedFov
        camera.position.set(0, 0, 5)
        camera.lookAt(0, 0, 0)
        camera.updateProjectionMatrix()
      }
    },
    dispose() {
      if (mesh) {
        mesh.parent?.remove(mesh)
        disposeMesh(mesh)
        mesh = null
      }
      camera = null
    },
  }
}
