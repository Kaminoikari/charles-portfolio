import { useEffect, useRef } from 'react'

const VS_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FS_SOURCE = `
precision mediump float;
uniform float t;
uniform vec2 r;
uniform float u_intensity;
uniform float u_eggCollapse;
uniform float u_eggFlash;
uniform float u_eggShock;
uniform float u_maskStrength;
uniform float u_photoHide;

vec2 myTanh(vec2 x) {
  vec2 ex = exp(x);
  vec2 emx = exp(-x);
  return (ex - emx) / (ex + emx);
}

void main() {
  // Normalized half-height coords. Centre = (0,0), top edge = (0, 1).
  vec2 p_norm = (gl_FragCoord.xy * 2.0 - r) / r.y;

  // Black hole collapse distortion. Drives both the lens (o_bg) and gas
  // (o_anim) blocks during the egg's collapse phase so the entire shader
  // implodes instead of just darkening:
  //  - radial zoom: scales sample coords outward, which makes the lens ring
  //    and gas pattern appear to shrink toward the centre (everything is
  //    being eaten by the singularity).
  //  - tightening vortex: angle shifts ∝ 1/r, so inner regions spiral CW
  //    much faster than outer regions — the classic gravitational whirlpool.
  // When u_eggCollapse = 0 both reduce to identity, so idle look is unchanged.
  float r_norm = length(p_norm);
  float collapseScale = 1.0 + u_eggCollapse * 3.5;
  float swirl = u_eggCollapse * 2.2 / (r_norm + 0.28);
  float baseAng = atan(p_norm.y, p_norm.x);
  vec2 p_swirled = vec2(cos(baseAng - swirl), sin(baseAng - swirl)) * r_norm;
  vec2 p_eff = p_swirled * collapseScale;

  vec4 o_bg = vec4(0.0);
  vec4 o_anim = vec4(0.0);

  {
    vec2 p_img = p_eff * mat2(1.0, -1.0, 1.0, 1.0);
    float d = abs(length(p_img) - 0.7);
    // Sharp circular lens core — symmetric, no diagonal cut.
    float core = 0.1 / (0.08 + d);
    o_bg += vec4(core);
    o_bg *= max(o_bg, vec4(0.0));
    // Plain soft halo (no angular pattern) — just extends the glow outward.
    float halo = 0.10 / (0.32 + d);
    o_bg += vec4(halo);
  }

  {
    // Saturating CW drift instead of linear rotation. Linear omega*t would
    // sweep the noise field around indefinitely and the shader's natural
    // streamers smear into permanent long arcs after ~30 sec. Exponential
    // saturation gives a strong CW flow in the first few seconds (matching
    // the particle ring direction), then asymptotes to a fixed angular
    // offset — no further winding accumulates. The shader's internal
    // t * 0.2 phase keeps the gas evolving naturally, so it still feels
    // alive even after the drift has settled.
    float r_eff = length(p_eff);
    float ang_eff = atan(p_eff.y, p_eff.x);
    float driftMax = mix(0.55, 0.12, smoothstep(0.3, 1.3, r_eff));
    float drift = driftMax * (1.0 - exp(-t * 0.08));
    float rotatedAng = ang_eff - drift;
    vec2 p_rotated = vec2(cos(rotatedAng), sin(rotatedAng)) * r_eff;

    vec2 p_anim = p_rotated / 0.7;
    vec2 d = vec2(-1.0, 1.0);
    float denom = 0.1 + 5.0 / dot(5.0 * p_anim - d, 5.0 * p_anim - d);
    vec2 c = p_anim * mat2(1.0, 1.0, d.x / denom, d.y / denom);
    vec2 v = c;
    v *= mat2(cos(log(length(v)) + t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0))) * 5.0;
    vec4 animAccum = vec4(0.0);
    for (int i = 1; i <= 9; i++) {
      float fi = float(i);
      animAccum += sin(vec4(v.x, v.y, v.y, v.x)) + vec4(1.0);
      v += 0.7 * sin(vec2(v.y, v.x) * fi + t) / fi + 0.5;
    }
    vec4 animTerm = 1.0 - exp(-exp(c.x * vec4(0.6, -0.4, -1.0, 0.0))
                      / animAccum
                      / (0.1 + 0.1 * pow(length(sin(v / 0.3) * 0.2 + c * vec2(1.0, 2.0)) - 1.0, 2.0))
                      / (1.0 + 7.0 * exp(0.3 * c.y - dot(c, c)))
                      / (0.10 + abs(length(p_anim) - 0.7)) * 0.2);
    o_anim += animTerm;
  }

  // Light fade during collapse — the spiraling distortion now carries most of
  // the visual story, so we keep the gas mostly visible (70% at peak) so the
  // implosion is legible rather than just blacking out.
  float gasFade = 1.0 - u_eggCollapse * 0.3;
  vec4 raw = mix(o_bg, o_anim, 0.5) * 1.5 * u_intensity * gasFade;
  vec3 rgb = clamp(raw.rgb, 0.0, 1.0);
  float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0);

  // Singularity core: warm bright point that grows during collapse, peaks at flash.
  float coreDist = length(p_norm);
  float coreI = u_eggCollapse * 1.4 + u_eggFlash * 2.0;
  float core = exp(-coreDist * coreDist * 6.0) * coreI;
  rgb += vec3(core * 1.0, core * 0.85, core * 0.7);
  a = max(a, core);

  // Shockwave: bright ring expanding outward, dims as it grows.
  float shockR = u_eggShock * 2.4;
  float shockBand = exp(-pow(length(p_norm) - shockR, 2.0) * 22.0);
  float shock = shockBand * (1.0 - u_eggShock) * 3.5;
  rgb += vec3(shock, shock * 0.95, shock * 0.85);
  a = max(a, shock);

  // White flash overlay during singularity.
  rgb += vec3(u_eggFlash * 0.9);
  a = max(a, u_eggFlash * 0.9);

  // Tight center mask: only hides the inner pinch where the two crescents
  // converge into a bright concentration. Lens ring itself (around p_norm
  // radius 0.5) stays fully visible. Animates fully open during egg collapse.
  float maskDist = length(p_norm);
  float maskCutout = smoothstep(0.15, 0.42, maskDist);
  float mask = mix(1.0, maskCutout, u_maskStrength);
  rgb *= mask;
  a *= mask;

  // Photo-phase hide: during the portrait the whole shader fades to zero so
  // the bright lens halo doesn't appear behind the photo. Independent of
  // maskStrength which only handles the centre pinch in idle/collapse.
  float photoVisible = 1.0 - u_photoHide;
  rgb *= photoVisible;
  a *= photoVisible;

  gl_FragColor = vec4(rgb * a, a);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compile(gl, gl.VERTEX_SHADER, vs)
  const f = compile(gl, gl.FRAGMENT_SHADER, fs)
  if (!v || !f) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, v)
  gl.attachShader(program, f)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link failed:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

// Egg phase boundaries (seconds since trigger). Match ParticleHero so the
// shader and particles stay in sync.
const COLLAPSE_END = 0.8
const FLASH_END = 1.0
const EXPLODE_END = 1.6
const PHOTO_END = 3.5
const REVERSE_END = 5.0
// Reverse phase splits into a secondary gravitational collapse (REVERSE_COLLAPSE_FRAC
// of the reverse window) and a release back to idle. Smaller peak than the
// initial collapse since this one is just the black hole reforming itself.
const REVERSE_COLLAPSE_FRAC = 0.55
const REVERSE_PEAK = 0.9

interface EggPhase {
  collapse: number
  flash: number
  shock: number
  maskStrength: number
  photoHide: number
}

function eggPhaseFor(elapsed: number): EggPhase {
  if (elapsed <= 0 || elapsed > REVERSE_END) {
    return { collapse: 0, flash: 0, shock: 0, maskStrength: 1, photoHide: 0 }
  }

  let collapse = 0
  if (elapsed < COLLAPSE_END) {
    collapse = Math.pow(elapsed / COLLAPSE_END, 3)
  } else if (elapsed < FLASH_END) {
    collapse = 1
  } else if (elapsed < EXPLODE_END) {
    collapse = 1 - (elapsed - FLASH_END) / (EXPLODE_END - FLASH_END)
  } else if (elapsed < PHOTO_END) {
    collapse = 0
  } else {
    // Reverse: secondary collapse curve that mirrors the original — gravitational
    // pull builds, peaks near rk=REVERSE_COLLAPSE_FRAC, then releases back to 0.
    const rk = (elapsed - PHOTO_END) / (REVERSE_END - PHOTO_END)
    if (rk < REVERSE_COLLAPSE_FRAC) {
      collapse = Math.pow(rk / REVERSE_COLLAPSE_FRAC, 2) * REVERSE_PEAK
    } else {
      collapse = REVERSE_PEAK * (1 - (rk - REVERSE_COLLAPSE_FRAC) / (1 - REVERSE_COLLAPSE_FRAC))
    }
  }

  let flash = 0
  if (elapsed > COLLAPSE_END && elapsed < FLASH_END) {
    const t = (elapsed - COLLAPSE_END) / (FLASH_END - COLLAPSE_END)
    flash = Math.sin(t * Math.PI)
  }

  let shock = 0
  if (elapsed > FLASH_END && elapsed < EXPLODE_END) {
    shock = (elapsed - FLASH_END) / (EXPLODE_END - FLASH_END)
  }

  // Mask logic:
  //  - Collapse → flash: open from 1 → 0 (reveal the imploding lens).
  //  - Explode: close 0 → 1 as shockwave pushes outward.
  //  - Photo: hold fully closed so the portrait is the only visual focus —
  //    the lens halo doesn't reappear behind the photo.
  //  - Reverse: open during secondary collapse, close back as it settles.
  let maskStrength = 1
  if (elapsed < FLASH_END) {
    maskStrength = 1 - Math.min(elapsed / COLLAPSE_END, 1)
  } else if (elapsed < EXPLODE_END) {
    maskStrength = (elapsed - FLASH_END) / (EXPLODE_END - FLASH_END)
  } else if (elapsed < PHOTO_END) {
    maskStrength = 1
  } else {
    const rk = (elapsed - PHOTO_END) / (REVERSE_END - PHOTO_END)
    if (rk < REVERSE_COLLAPSE_FRAC) {
      maskStrength = 1 - rk / REVERSE_COLLAPSE_FRAC
    } else {
      maskStrength = (rk - REVERSE_COLLAPSE_FRAC) / (1 - REVERSE_COLLAPSE_FRAC)
    }
  }

  // Photo-phase hide: ramp up DURING the second half of explode phase so the
  // lens is fully hidden by the time particles arrive at portrait positions.
  // Previously the ramp started at EXPLODE_END which left a brief 120 ms
  // window where the bright lens flashed behind the converging photo.
  const HIDE_RAMP_START = EXPLODE_END - 0.35  // start fading at 1.25s
  const HIDE_RAMP_END = EXPLODE_END - 0.05    // fully hidden by 1.55s
  const PHOTO_FADE_OUT = 0.15
  let photoHide = 0
  if (elapsed >= HIDE_RAMP_START && elapsed < HIDE_RAMP_END) {
    photoHide = (elapsed - HIDE_RAMP_START) / (HIDE_RAMP_END - HIDE_RAMP_START)
  } else if (elapsed >= HIDE_RAMP_END && elapsed < PHOTO_END) {
    photoHide = 1
  } else if (elapsed >= PHOTO_END && elapsed < PHOTO_END + PHOTO_FADE_OUT) {
    photoHide = 1 - (elapsed - PHOTO_END) / PHOTO_FADE_OUT
  }

  return { collapse, flash, shock, maskStrength, photoHide }
}

interface Props {
  intensity?: number
}

export default function BlackHoleBackdrop({ intensity = 1.0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  const eggStartRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true })
    if (!gl) return

    const program = link(gl, VS_SOURCE, FS_SOURCE)
    if (!program) return
    gl.useProgram(program)

    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const timeLocation = gl.getUniformLocation(program, 't')
    const resolutionLocation = gl.getUniformLocation(program, 'r')
    const intensityLocation = gl.getUniformLocation(program, 'u_intensity')
    const eggCollapseLocation = gl.getUniformLocation(program, 'u_eggCollapse')
    const eggFlashLocation = gl.getUniformLocation(program, 'u_eggFlash')
    const eggShockLocation = gl.getUniformLocation(program, 'u_eggShock')
    const maskStrengthLocation = gl.getUniformLocation(program, 'u_maskStrength')
    const photoHideLocation = gl.getUniformLocation(program, 'u_photoHide')

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    // Match the particle canvas DPR cap. The shader is per-pixel work in
    // the fragment program, so 1.5 → 2.0 is a 1.78× cost in fragment
    // invocations, but the lens/halo edges and the gas filaments are the
    // most visible thing in the hero and they need to be crisp on dpr=3
    // iPhones where 1.5 was rendering at half native density.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let lastW = -1
    let lastH = -1
    const resize = () => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      // Skip when dimensions are unchanged. Setting canvas.width/height
      // wipes the WebGL framebuffer, so a spurious fire would render the
      // shader as one transparent frame before the next render() repaints —
      // visible as a flicker in the lens halo on mobile.
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(parent)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let prefersReduced = reducedMotion.matches
    const onMotionChange = (e: MediaQueryListEvent) => { prefersReduced = e.matches }
    reducedMotion.addEventListener('change', onMotionChange)

    const onEasterEgg = () => {
      if (eggStartRef.current === 0) {
        eggStartRef.current = performance.now()
      }
    }
    window.addEventListener('easter-egg', onEasterEgg)

    const startTime = performance.now()
    const FROZEN_T = 4.2

    const render = () => {
      animIdRef.current = requestAnimationFrame(render)
      if (!visibleRef.current) return

      const now = performance.now()
      const elapsed = (now - startTime) / 1000

      let phase: EggPhase = { collapse: 0, flash: 0, shock: 0, maskStrength: 1, photoHide: 0 }
      if (eggStartRef.current > 0) {
        const eggElapsed = (now - eggStartRef.current) / 1000
        if (eggElapsed > REVERSE_END) {
          eggStartRef.current = 0
        } else {
          phase = eggPhaseFor(eggElapsed)
        }
      }

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(timeLocation, prefersReduced ? FROZEN_T : elapsed)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.uniform1f(intensityLocation, intensity)
      gl.uniform1f(eggCollapseLocation, phase.collapse)
      gl.uniform1f(eggFlashLocation, phase.flash)
      gl.uniform1f(eggShockLocation, phase.shock)
      gl.uniform1f(maskStrengthLocation, phase.maskStrength)
      gl.uniform1f(photoHideLocation, phase.photoHide)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    render()

    return () => {
      cancelAnimationFrame(animIdRef.current)
      observer.disconnect()
      ro.disconnect()
      reducedMotion.removeEventListener('change', onMotionChange)
      window.removeEventListener('easter-egg', onEasterEgg)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [intensity])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      role="presentation"
      aria-hidden="true"
    />
  )
}
