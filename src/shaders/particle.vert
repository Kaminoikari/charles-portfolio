// ============================================================
// 3D Simplex Noise (Stefan Gustavson, adapted for GLSL)
// ============================================================
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Curl noise from simplex noise (approximated via finite differences)
vec3 curlNoise(vec3 p) {
  float e = 0.1;
  float n1, n2;

  // df/dy, df/dz for x component
  n1 = snoise(p + vec3(0.0, e, 0.0));
  n2 = snoise(p - vec3(0.0, e, 0.0));
  float a = (n1 - n2) / (2.0 * e);

  n1 = snoise(p + vec3(0.0, 0.0, e));
  n2 = snoise(p - vec3(0.0, 0.0, e));
  float b = (n1 - n2) / (2.0 * e);

  // df/dx, df/dz for y component
  n1 = snoise(p + vec3(e, 0.0, 0.0));
  n2 = snoise(p - vec3(e, 0.0, 0.0));
  float c = (n1 - n2) / (2.0 * e);

  n1 = snoise(p + vec3(0.0, 0.0, e));
  n2 = snoise(p - vec3(0.0, 0.0, e));
  float d = (n1 - n2) / (2.0 * e);

  // df/dx, df/dy for z component
  n1 = snoise(p + vec3(e, 0.0, 0.0));
  n2 = snoise(p - vec3(e, 0.0, 0.0));
  float ee = (n1 - n2) / (2.0 * e);

  n1 = snoise(p + vec3(0.0, e, 0.0));
  n2 = snoise(p - vec3(0.0, e, 0.0));
  float f = (n1 - n2) / (2.0 * e);

  return vec3(a - b, d - c, ee - f);
}

// ============================================================
// Uniforms
// ============================================================
uniform float uTime;
uniform vec2 uMouse;       // normalized [-1, 1]
uniform float uProgress;   // 0 = scattered, 1 = text formed

// ============================================================
// Instance attributes
// ============================================================
attribute vec3 aRandomPos;
attribute vec3 aTargetPos;
attribute float aColorMix;  // 0 = white, 1 = cyan

// ============================================================
// Varyings
// ============================================================
varying float vColorMix;
varying float vAlpha;

void main() {
  // -----------------------------------------------------------
  // 1. Blend between random position and text target
  // -----------------------------------------------------------
  float prog = clamp(uProgress, 0.0, 1.0);
  // Smooth ease-in-out for formation
  float smoothProg = smoothstep(0.0, 1.0, prog);

  vec3 basePos = mix(aRandomPos, aTargetPos, smoothProg);

  // -----------------------------------------------------------
  // 2. Idle noise displacement (always active, subtle)
  // -----------------------------------------------------------
  float noiseScale = 0.8;
  float noiseSpeed = 0.15;
  vec3 noiseInput = basePos * noiseScale + uTime * noiseSpeed;
  vec3 curl = curlNoise(noiseInput);

  // When formed (high progress), reduce noise amplitude
  float idleAmplitude = mix(0.6, 0.08, smoothProg);
  vec3 noiseOffset = curl * idleAmplitude;

  // -----------------------------------------------------------
  // 3. Mouse repulsion with noise-based rotation
  // -----------------------------------------------------------
  // Project mouse to 3D (z=0 plane, mapped to scene coords)
  vec3 mousePos3D = vec3(uMouse.x * 5.0, uMouse.y * 3.0, 0.0);
  vec3 diff = basePos + noiseOffset - mousePos3D;
  float dist = length(diff);

  float mouseRadius = 1.5;
  float mouseStrength = 1.0 - smoothstep(0.0, mouseRadius, dist);
  mouseStrength = mouseStrength * mouseStrength * 1.2;

  // Noise-based rotation vector for organic "stardust flowing" feel
  vec3 noiseRotation = curlNoise(basePos * 2.0 + uTime * 0.3);
  vec3 repulsion = normalize(diff + 0.001) * mouseStrength;
  // Blend repulsion direction with noise rotation
  vec3 mouseOffset = mix(repulsion, noiseRotation * mouseStrength, 0.4);

  // -----------------------------------------------------------
  // 4. Final position
  // -----------------------------------------------------------
  vec3 finalPos = basePos + noiseOffset + mouseOffset;

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

  // Point size with distance attenuation — small star-like particles
  float baseSize = 1.2;
  float sizeVariation = snoise(vec3(aRandomPos.xy * 10.0, uTime * 0.5)) * 0.3 + 0.7;
  gl_PointSize = baseSize * sizeVariation * (80.0 / -mvPosition.z);

  gl_Position = projectionMatrix * mvPosition;

  // -----------------------------------------------------------
  // 5. Pass varyings
  // -----------------------------------------------------------
  vColorMix = aColorMix;

  // Particles slightly fade based on distance from camera
  vAlpha = smoothstep(25.0, 5.0, -mvPosition.z);
}
