import * as THREE from 'three'

// Cinematic finishing pass for the easter-egg sequence. Runs after bloom in
// the EffectComposer chain to give every beat a unified film look:
//   - subtle vignette
//   - warm-shadow / cool-highlight tone grade
//   - light saturation lift
//   - per-pixel grain so flat colour fields read as photographed light
//   - boundary fade-to-black driven by `u_globalFade` so adjacent beats
//     transition through a brief blink instead of a hard cut.
export const cinematicShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_globalFade: { value: 1 },
    u_grainStrength: { value: 0.045 },
    u_vignetteStrength: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_globalFade;
    uniform float u_grainStrength;
    uniform float u_vignetteStrength;
    varying vec2 vUv;

    vec3 cinematicGrade(vec3 col) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      // Warm push for shadows, cool push for highlights — gentle teal/orange split.
      vec3 warmShadow = vec3(0.045, 0.020, 0.000);
      vec3 coolHighlight = vec3(-0.020, 0.000, 0.045);
      vec3 graded = col + warmShadow * (1.0 - smoothstep(0.0, 0.45, lum));
      graded += coolHighlight * smoothstep(0.55, 1.0, lum);
      // Mild saturation boost so colour-rich regions pop without nuking neutrals.
      float gLum = dot(graded, vec3(0.299, 0.587, 0.114));
      graded = mix(vec3(gLum), graded, 1.10);
      return graded;
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // Vignette — radial darkening keyed off frame aspect.
      vec2 p = vUv - 0.5;
      p.x *= u_resolution.x / u_resolution.y;
      float r = length(p);
      float vignette = smoothstep(1.05, 0.40, r);
      col *= mix(1.0 - u_vignetteStrength, 1.0, vignette);

      col = cinematicGrade(col);

      // Animated grain. Re-seed per frame so flat tones don't read as posterized.
      float grain = fract(sin(dot(vUv * 1024.0 + u_time * 53.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * u_grainStrength;

      // Global fade for boundary blinks. Multiplied last so vignette/grade
      // stay coherent through the transition rather than hard-cutting tone.
      col *= u_globalFade;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

// Internal beat boundaries that should blink to black between cuts. The
// 0.0 (sequence start), 10.8 (Convergence→Snap), and 12.0 (sequence end) edges
// are intentionally excluded:
//   * 0.0  — Awakening already opens from a slow star push-in
//   * 10.8 — Convergence's white-hot pinpoint flows directly into Snap's warp
//            transit; the visual handoff is deliberately seamless
//   * 12.0 — Snap fades the overlay opacity into the homepage shader itself
export const INTERNAL_BOUNDARIES = [1.2, 3.0, 4.5, 6.0, 7.0, 8.5, 9.5]

const FADE_HALF = 0.06

// Triangle fade centered on each boundary: 0 at the boundary, 1 at ±FADE_HALF.
// Total black-window per boundary ≈ 120ms which reads as a deliberate cinematic
// blink rather than a stutter.
export function globalFadeForTime(t: number): number {
  for (const boundary of INTERNAL_BOUNDARIES) {
    const dist = Math.abs(t - boundary)
    if (dist < FADE_HALF) {
      return dist / FADE_HALF
    }
  }
  return 1
}
