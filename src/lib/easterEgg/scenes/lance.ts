import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { NOISE_GLSL, QUAD_VERT, clamp01, disposeMesh, easeOutQuart, smoothstep } from './shared'

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float u_t;
  uniform float u_charge;     // 0->1 then 0 quickly (top-of-sphere flash buildup)
  uniform float u_beamStart;  // x position of beam tip travel
  uniform float u_beamWidth;  // beam thickness modifier
  uniform float u_pan;        // whip pan offset
  uniform float u_satX;       // detached satellite x position
  uniform float u_satY;
  uniform float u_satOpacity;
  uniform vec2 u_resolution;

  ${NOISE_GLSL}

  // SDF circle
  float sdCircle(vec2 p, float r) { return length(p) - r; }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    p.x += u_pan;

    // Background dim space + faint warm haze
    float r = length(p);
    vec3 col = vec3(0.015, 0.015, 0.025) + vec3(0.05, 0.03, 0.02) * exp(-r * 4.0);

    // Subtle stars
    float stars = step(0.998, fract(sin(dot(vUv * 1800.0, vec2(12.9898, 78.233))) * 43758.5453));
    col += vec3(0.7, 0.8, 1.0) * stars * 0.6;

    // Dyson sphere silhouette: a dim glowing disc with hex hint
    vec2 sp = p - vec2(-0.05, 0.0);
    float sphereR = 0.30;
    float sphereD = sdCircle(sp, sphereR);
    if (sphereD < 0.0) {
      // Hex-ish radial pattern fade
      float hex = fbm(sp * 28.0);
      float facing = 1.0 - length(sp) / sphereR;
      vec3 panelCol = vec3(0.10, 0.06, 0.04) * (0.5 + facing);
      vec3 nodeCol = vec3(1.0, 0.78, 0.40) * pow(hex, 6.0) * facing * 0.8;
      col = panelCol + nodeCol;
      // Inner corona ring around centre
      float innerD = length(sp);
      float corona = exp(-pow((innerD - 0.08) * 14.0, 2.0));
      col += vec3(1.0, 0.7, 0.3) * corona * 1.6;
      // Black void
      col *= 1.0 - smoothstep(0.07, 0.04, innerD);
    }

    // Charge spot at top of sphere
    vec2 chargePos = vec2(-0.05, sphereR - 0.02);
    float chargeR = length(p - chargePos);
    float chargeGlow = exp(-chargeR * 18.0) * u_charge * 4.0;
    col += vec3(0.7, 0.95, 1.0) * chargeGlow;

    // Outgoing cyan beam: horizontal line from charge spot extending right
    // Beam tip is at chargePos + (u_beamStart, 0); width tapered with x distance.
    float beamY = abs(p.y - chargePos.y);
    float distFromOrigin = p.x - chargePos.x;
    float beamLen = u_beamStart;
    float withinBeamX = step(0.0, distFromOrigin) * step(distFromOrigin, beamLen);
    float beamCore = exp(-pow(beamY / (0.0035 * u_beamWidth), 2.0));
    float beamHalo = exp(-pow(beamY / (0.022 * u_beamWidth), 2.0)) * 0.45;
    float beamProfile = (beamCore + beamHalo) * withinBeamX;
    col += vec3(0.55, 0.95, 1.0) * beamProfile * 1.8;

    // Bright tip flare
    float tipDist = length(p - vec2(chargePos.x + beamLen, chargePos.y));
    col += vec3(0.9, 1.0, 1.0) * exp(-tipDist * 28.0) * step(beamLen, 0.55) * 1.2;

    // Detached satellite (small honeycomb dot drifting away)
    vec2 satP = p - vec2(u_satX, u_satY);
    float sat = exp(-length(satP) * 80.0);
    float satRing = smoothstep(0.025, 0.018, length(satP)) * smoothstep(0.012, 0.018, length(satP));
    col += vec3(1.0, 0.55, 0.18) * (sat * 1.6 + satRing * 0.6) * u_satOpacity;

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
    u_pan: { value: 0 },
    u_satX: { value: 0.25 },
    u_satY: { value: 0.0 },
    u_satOpacity: { value: 0 },
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
      // Charge: ramp 0 → 1 over 0.0-0.25, then snap to 0 at fire
      const chargeRampUp = clamp01(lt / 0.25)
      const chargeRampDown = 1.0 - smoothstep(0.25, 0.32, lt)
      uniforms.u_charge.value = chargeRampUp * chargeRampDown
      // Beam: starts at 0 at t=0.27, extends to 0.65 by t=0.6, fades after
      const beamProgress = clamp01((lt - 0.27) / 0.30)
      uniforms.u_beamStart.value = easeOutQuart(beamProgress) * 0.65
      // Beam fade out near end
      uniforms.u_beamWidth.value = (lt > 0.85) ? Math.max(0, 1.0 - (lt - 0.85) / 0.15) : 1.0
      // Whip pan: shift right slightly across the beat
      uniforms.u_pan.value = -lt * 0.22
      // Satellite detachment: visible after t=0.4, drifts up-right
      const satT = clamp01((lt - 0.40) / 0.55)
      uniforms.u_satX.value = -0.05 + 0.30 + satT * 0.45
      uniforms.u_satY.value = 0.18 + satT * 0.12
      uniforms.u_satOpacity.value = (satT < 0.1 ? satT / 0.1 : 1) * (lt > 0.92 ? Math.max(0, 1 - (lt - 0.92) / 0.08) : 1)
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
