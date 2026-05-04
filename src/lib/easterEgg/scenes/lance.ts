import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutQuart } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_charge;
  uniform float u_beamStart;
  uniform float u_beamWidth;
  uniform float u_beamFade;
  uniform float u_pan;
  uniform float u_satX;
  uniform float u_satY;
  uniform float u_satOpacity;
  uniform float u_muzzleFlash;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  float sdCircle(vec2 p, float r) { return length(p) - r; }

  // Hex-grid coordinate. Returns the local position within the nearest hex
  // cell along with that cell's id. Used to draw the Dyson shell as a real
  // panel pattern instead of fbm noise pretending to be hexagons.
  vec3 hexGrid(vec2 p) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 cell = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = (p - cell);
    return vec3(cell, dot(id, vec2(31.7, 73.1)));
  }

  // Distance from origin to nearest hex edge in unit-spacing grid coords.
  float hexEdge(vec2 cell) {
    vec2 q = abs(cell);
    return 0.5 - max(q.x * 0.866 + q.y * 0.5, q.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    p.x += u_pan;

    float r = length(p);
    vec3 col = vec3(0.012, 0.014, 0.024) + vec3(0.05, 0.03, 0.02) * exp(-r * 4.0);

    // Stars.
    float stars = step(0.998, fract(sin(dot(vUv * 1800.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.7, 0.8, 1.0) * stars * 0.6;

    // Dyson sphere — proper rendered shell with hex panel grid, limb darkening,
    // a hot inner corona around the occluder, and a starlit rim from the corona
    // light spilling around the silhouette.
    vec2 sp = p - vec2(-0.05, 0.0);
    float sphereR = 0.32;
    float sphereD = length(sp);
    float sphereMask = smoothstep(sphereR + 0.004, sphereR - 0.002, sphereD);

    // Soft outer rim glow visible just past the silhouette edge.
    float rimGlow = exp(-pow((sphereD - sphereR) * 18.0, 2.0)) * (1.0 - sphereMask);
    col += vec3(1.0, 0.55, 0.20) * rimGlow * 0.55;

    if (sphereMask > 0.0) {
      // Spherical mapping so panels denser near the limb (fakes 3D curvature).
      float facing = sqrt(max(0.0, 1.0 - pow(sphereD / sphereR, 2.0)));
      vec2 panelUv = sp / (0.85 * sphereR + 0.15 * facing);
      vec3 hex = hexGrid(panelUv * 9.0);
      float edge = hexEdge(hex.xy);
      float strut = 1.0 - smoothstep(0.04, 0.10, edge);
      // Per-panel lighting variation seeded by cell id.
      float panelSeed = fract(sin(hex.z) * 43758.5453);
      vec3 panelDark = vec3(0.06, 0.04, 0.03) * (0.55 + 0.45 * facing);
      vec3 panelLit  = vec3(0.18, 0.10, 0.05) * (0.55 + 0.55 * facing);
      vec3 panelCol = mix(panelDark, panelLit, panelSeed);
      // Heated panels (rare, glowing nodes).
      float hot = step(0.92, panelSeed);
      panelCol += vec3(1.0, 0.65, 0.25) * hot * (0.35 + 0.45 * facing);
      // Strut tone — warm metal rim picked out by inner corona light.
      vec3 strutCol = vec3(0.55, 0.30, 0.15) * (0.45 + 0.55 * facing);
      vec3 shell = mix(panelCol, strutCol, strut);
      // Limb darkening for 3D feel.
      shell *= mix(0.55, 1.0, facing);

      // Inner corona ring just outside the central occluder.
      float corona = exp(-pow((sphereD - 0.085) * 16.0, 2.0));
      shell += vec3(1.0, 0.70, 0.32) * corona * 1.55;
      // Diffuse warm bleed from the core.
      shell += vec3(1.0, 0.55, 0.20) * exp(-sphereD * 7.5) * 0.5;
      // Black singularity occluder.
      shell *= 1.0 - smoothstep(0.075, 0.040, sphereD);

      col = mix(col, shell, sphereMask);
    }

    // Charge build-up at the upper-edge firing port. The port glows brighter
    // as charge ramps; on fire we layer a brief muzzle flash and shockwave.
    vec2 portPos = vec2(-0.05, sphereR - 0.018);
    vec2 portRel = p - portPos;
    float portR = length(portRel);
    float chargeCore = exp(-portR * portR * 320.0) * u_charge;
    float chargeHalo = exp(-portR * portR * 32.0) * u_charge * 0.55;
    col += vec3(0.65, 0.92, 1.0) * (chargeCore * 4.5 + chargeHalo * 2.0);
    // Charge ring forming around the port just before fire.
    float chargeRing = exp(-pow((portR - 0.015) * 70.0, 2.0)) * pow(u_charge, 2.0);
    col += vec3(0.75, 0.98, 1.0) * chargeRing * 1.6;

    // Muzzle flash on fire — bright disc + radial spikes that decay fast.
    if (u_muzzleFlash > 0.0) {
      float flashCore = exp(-portR * portR * 90.0) * u_muzzleFlash;
      float flashRing = exp(-pow((portR - 0.030) * 35.0, 2.0)) * u_muzzleFlash;
      // Cross-shaped spikes (anamorphic flare hint).
      float spikeH = exp(-pow(portRel.y * 60.0, 2.0)) * exp(-abs(portRel.x) * 6.0);
      float spikeV = exp(-pow(portRel.x * 60.0, 2.0)) * exp(-abs(portRel.y) * 6.0);
      col += vec3(0.85, 0.98, 1.0) * (flashCore * 4.0 + flashRing * 1.2);
      col += vec3(0.95, 1.0, 1.0) * (spikeH + spikeV) * u_muzzleFlash * 1.4;
    }

    // Outgoing energy lance. Three-band profile: ionized core, plasma sheath,
    // diffuse field. Slight noise wobble across the path so the line reads as
    // energy rather than a printed stroke.
    float beamLen = u_beamStart;
    float distFromOrigin = p.x - portPos.x;
    if (beamLen > 0.0 && distFromOrigin >= 0.0 && distFromOrigin <= beamLen) {
      float wobble = (fbm(vec2(distFromOrigin * 26.0, u_t * 4.5)) - 0.5) * 0.012 * u_beamWidth;
      float beamY = abs(p.y - portPos.y - wobble);
      float beamCore = exp(-pow(beamY / (0.0040 * u_beamWidth), 2.0));
      float beamSheath = exp(-pow(beamY / (0.012 * u_beamWidth), 2.0)) * 0.55;
      float beamField = exp(-pow(beamY / (0.040 * u_beamWidth), 2.0)) * 0.18;
      // Crackle: high-frequency intensity noise along the path so it pulses.
      float crackle = 0.65 + 0.35 * fbm(vec2(distFromOrigin * 80.0, u_t * 12.0));
      col += vec3(0.95, 1.0, 1.0) * beamCore * 2.6 * crackle * u_beamFade;
      col += vec3(0.55, 0.92, 1.0) * beamSheath * 1.7 * crackle * u_beamFade;
      col += vec3(0.30, 0.65, 1.0) * beamField * 1.2 * u_beamFade;
    }

    // Beam-head supercharged tip — sharper than a gaussian, stays bright until
    // the tip leaves the frame.
    if (beamLen < 0.55) {
      vec2 tip = vec2(portPos.x + beamLen, portPos.y);
      float tipR = length(p - tip);
      col += vec3(0.95, 1.0, 1.0) * exp(-tipR * tipR * 1500.0) * 3.6 * u_beamFade;
      col += vec3(0.65, 0.95, 1.0) * exp(-tipR * 22.0) * 0.75 * u_beamFade;
    }

    // Detached panel cluster drifting away. Replaces the lone bright dot with
    // a small disc that has its own hex pattern + warm engine bloom behind it.
    vec2 satP = p - vec2(u_satX, u_satY);
    float satR = length(satP);
    float satMask = smoothstep(0.030, 0.024, satR);
    if (satMask > 0.0 && u_satOpacity > 0.0) {
      vec3 satHex = hexGrid(satP * 90.0);
      float satEdge = hexEdge(satHex.xy);
      float satStrut = 1.0 - smoothstep(0.05, 0.20, satEdge);
      vec3 satBody = mix(vec3(0.20, 0.12, 0.06), vec3(0.50, 0.28, 0.10), satStrut);
      // Engine glow trailing in the direction opposite drift.
      vec2 trail = satP + vec2(0.04, -0.012);
      float trailGlow = exp(-length(trail) * 22.0) * 0.85;
      col += vec3(1.0, 0.55, 0.20) * trailGlow * u_satOpacity;
      col = mix(col, satBody, satMask * u_satOpacity);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

export function createLance(): BeatScene {
  let mesh: THREE.Mesh | null = null
  const uniforms = {
    u_t: { value: 0 },
    u_charge: { value: 0 },
    u_beamStart: { value: 0 },
    u_beamWidth: { value: 1 },
    u_beamFade: { value: 1 },
    u_pan: { value: 0 },
    u_satX: { value: 0.25 },
    u_satY: { value: 0.0 },
    u_satOpacity: { value: 0 },
    u_muzzleFlash: { value: 0 },
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
      // Charge ramps quickly, spikes at fire, drains as the beam takes over.
      const chargeRampUp = clamp01(lt / 0.22)
      const chargeRampDown = lt < 0.27 ? 1 : Math.max(0, 1 - (lt - 0.27) / 0.10)
      uniforms.u_charge.value = chargeRampUp * chargeRampDown
      // Muzzle flash spikes around the fire moment then decays in ~120ms.
      const flashT = (lt - 0.25) / 0.10
      uniforms.u_muzzleFlash.value = flashT > 0 && flashT < 1
        ? Math.sin(Math.PI * flashT)
        : 0
      // Beam extends rapidly after fire then exits frame.
      const beamProgress = clamp01((lt - 0.27) / 0.30)
      uniforms.u_beamStart.value = easeOutQuart(beamProgress) * 0.65
      // Width stays >= 0.1 so the gaussian denominators never blow up; the
      // separate fade uniform handles the actual end-of-beat dim-out.
      uniforms.u_beamWidth.value = 1
      uniforms.u_beamFade.value = lt > 0.85 ? Math.max(0, 1 - (lt - 0.85) / 0.15) : 1
      uniforms.u_pan.value = -lt * 0.22
      // Satellite (detached panel cluster) drifts up-right as the lance fires.
      const satT = clamp01((lt - 0.40) / 0.55)
      uniforms.u_satX.value = -0.05 + 0.30 + satT * 0.45
      uniforms.u_satY.value = 0.18 + satT * 0.12
      uniforms.u_satOpacity.value =
        (satT < 0.1 ? satT / 0.1 : 1) * (lt > 0.92 ? Math.max(0, 1 - (lt - 0.92) / 0.08) : 1)
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
