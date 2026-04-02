precision mediump float;

varying float vColorMix;
varying float vAlpha;

// Colors
const vec3 WHITE = vec3(1.0, 1.0, 1.0);
const vec3 CYAN = vec3(0.0, 0.851, 1.0); // #00D9FF

void main() {
  // Circular point with soft edges
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  // Discard pixels outside circle
  if (dist > 0.5) discard;

  // Tight radial falloff — crisp star-like points with soft edge
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha = alpha * alpha; // sharpen falloff
  alpha *= vAlpha * 0.7; // reduce overall opacity to prevent blob merging

  // Mix between white and cyan
  vec3 color = mix(WHITE, CYAN, vColorMix);

  // Subtle glow for cyan particles
  float glowBoost = vColorMix * 0.15;
  alpha += glowBoost * max(0.0, 1.0 - dist * 3.0);
  alpha = clamp(alpha, 0.0, 0.85);

  gl_FragColor = vec4(color, alpha);
}
