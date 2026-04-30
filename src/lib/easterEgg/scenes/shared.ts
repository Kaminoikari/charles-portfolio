import * as THREE from 'three'

// fbm + noise helpers as a GLSL string fragment to inject into shaders.
export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1, 0)), u.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
`

// Standard fullscreen-quad vertex shader (passes UV).
export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export function makeFullscreenQuad(fragment: string, uniforms: Record<string, THREE.IUniform>) {
  const geom = new THREE.PlaneGeometry(2, 2)
  const mat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  return new THREE.Mesh(geom, mat)
}

// Smooth easings.
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
export const easeInCubic = (x: number) => x * x * x
export const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
export const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4)
export const easeInQuart = (x: number) => x * x * x * x
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// Adds barycentric coords as vertex attribute (un-indexes the geometry).
export function addBarycentric(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geom.toNonIndexed()
  const count = g.attributes.position.count
  const bary = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 3) {
    bary[i * 3 + 0] = 1; bary[i * 3 + 1] = 0; bary[i * 3 + 2] = 0
    bary[(i + 1) * 3 + 0] = 0; bary[(i + 1) * 3 + 1] = 1; bary[(i + 1) * 3 + 2] = 0
    bary[(i + 2) * 3 + 0] = 0; bary[(i + 2) * 3 + 1] = 0; bary[(i + 2) * 3 + 2] = 1
  }
  g.setAttribute('a_bary', new THREE.BufferAttribute(bary, 3))
  return g
}

export function disposeMesh(mesh: THREE.Mesh | THREE.Object3D) {
  mesh.traverse((obj) => {
    const m = obj as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material
    if (Array.isArray(mat)) {
      mat.forEach((mm) => mm.dispose())
    } else if (mat) {
      ;(mat as THREE.Material).dispose()
    }
  })
}
