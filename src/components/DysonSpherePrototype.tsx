import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`

const BG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1, 0)), u.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vUv;
    float r = length(p - vec2(0.5, 0.5));

    // Cool dark grey base — minimal warmth
    vec3 base = vec3(0.020, 0.018, 0.022);
    base *= 1.0 - smoothstep(0.50, 1.10, r) * 0.55;

    // Subtle volumetric texture
    float haze = fbm(p * 3.5) * 0.5 + fbm(p * 1.4) * 0.3;
    haze = pow(haze, 1.6);

    // Very subtle warm tint upper-right (much reduced)
    vec2 nebCenter = vec2(0.80, 0.64);
    float nebDist = length((p - nebCenter) * vec2(1.0, 1.1));
    vec3 neb = vec3(0.10, 0.06, 0.04) * exp(-nebDist * 2.6) * (0.4 + 0.5 * haze);

    // Cool nebula lower-left
    vec2 nebCenter2 = vec2(0.18, 0.32);
    float nebDist2 = length((p - nebCenter2) * vec2(1.2, 1.0));
    vec3 neb2 = vec3(0.08, 0.07, 0.10) * exp(-nebDist2 * 3.2) * (0.4 + 0.5 * haze);

    vec3 col = base + neb + neb2;

    // Sparse stars
    float s = fract(sin(dot(vUv * 2150.0, vec2(12.9898, 78.233))) * 43758.5453);
    col += vec3(0.7, 0.75, 0.85) * step(0.9985, s) * 0.7;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Geodesic shell shader — used for BOTH outer (dark) and inner (luminous)
// shells. Tints (panel/strut/node) are passed in via uniforms so a single
// shader handles both layers.
const SHELL_VERT = /* glsl */ `
  attribute vec3 a_bary;
  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying float vFogDepth;
  void main() {
    vBary = a_bary;
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    vec4 mvp = viewMatrix * wp;
    vFogDepth = -mvp.z;
    gl_Position = projectionMatrix * mvp;
  }
`

const SHELL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying float vFogDepth;
  uniform vec3 u_glow;
  uniform vec3 u_warm;
  uniform vec3 u_strut;
  uniform vec3 u_panel;     // triangle interior fill colour
  uniform vec3 u_node;      // vertex node colour
  uniform float u_panelAlpha;
  uniform float u_nodeIntensity;
  uniform float u_rimGain;
  uniform vec3 u_fogColor;
  uniform float u_fogDensity;
  uniform float u_time;

  void main() {
    vec3 d = fwidth(vBary);
    vec3 a3 = smoothstep(vec3(0.0), d * 1.4, vBary);
    float edgeMask = 1.0 - min(min(a3.x, a3.y), a3.z);

    float maxBary = max(max(vBary.x, vBary.y), vBary.z);
    float vertexHot = pow(smoothstep(0.84, 0.995, maxBary), 1.4);

    float facing = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.4);

    // Panel fill (dark on outer shell, bright on inner shell)
    vec3 panelCol = u_panel * (0.7 + 0.6 * facing);
    // Strut colour
    vec3 strutCol = u_strut * (0.65 + 0.55 * facing) + u_glow * 0.18 * rim;
    // Node colour (dark on outer, bright on inner)
    vec3 nodeCol = u_node * vertexHot * u_nodeIntensity * (0.45 + 0.55 * facing);

    vec3 col = panelCol;
    col = mix(col, strutCol, edgeMask);
    col += nodeCol * (1.0 - edgeMask * 0.4);
    col += u_glow * rim * u_rimGain;

    float alpha = clamp(u_panelAlpha + edgeMask * (1.0 - u_panelAlpha) + vertexHot * 0.3, 0.0, 1.0);

    // Fog (matches THREE.FogExp2)
    float fogFactor = 1.0 - exp(-u_fogDensity * u_fogDensity * vFogDepth * vFogDepth);
    col = mix(col, u_fogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, alpha);
  }
`

// Adds barycentric coords as a vertex attribute (un-indexes the geometry).
function addBarycentric(geom: THREE.BufferGeometry): THREE.BufferGeometry {
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

export default function DysonSpherePrototype() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // Volumetric haze — distant geometry fades into warm dust.
    scene.fog = new THREE.FogExp2(0x1a1820, 0.055)
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 200)
    camera.position.set(0, 0, 17)
    camera.lookAt(0, 0, 0)

    // Background quad
    const bgScene = new THREE.Scene()
    const bgCamera = new THREE.Camera()
    const bgQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        uniforms: {},
        depthTest: false,
        depthWrite: false,
      })
    )
    bgScene.add(bgQuad)

    // OUTER shell — dark panels, dark struts, DARK nodes (no bright glow at
    // vertices). This reads as the structural cage.
    const outerGeom = addBarycentric(new THREE.IcosahedronGeometry(1.0, 3))
    const outerUniforms = {
      u_time: { value: 0 },
      u_glow: { value: new THREE.Color('#FFA050') },
      u_warm: { value: new THREE.Color('#C2641F') },
      u_strut: { value: new THREE.Color('#3A2014') },
      u_panel: { value: new THREE.Color(0x1a0e08) },
      u_node: { value: new THREE.Color(0x2a1810) },
      u_panelAlpha: { value: 0.62 },
      u_nodeIntensity: { value: 0.6 },
      u_rimGain: { value: 0.06 },
      u_fogColor: { value: new THREE.Color(0x1a1820) },
      u_fogDensity: { value: 0.055 },
    }
    const outerShell = new THREE.Mesh(
      outerGeom,
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: outerUniforms,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
      })
    )
    outerShell.renderOrder = 6
    scene.add(outerShell)

    // INNER shell — smaller, luminous. Bright nodes, glowing struts. Sits
    // inside the outer cage so we see two nested lattice layers as in the ref.
    const innerGeom = addBarycentric(new THREE.IcosahedronGeometry(0.86, 3))
    const innerUniforms = {
      u_time: { value: 0 },
      u_glow: { value: new THREE.Color('#FFCB7A') },
      u_warm: { value: new THREE.Color('#FF8838') },
      u_strut: { value: new THREE.Color('#B86028') },
      u_panel: { value: new THREE.Color(0x2a1408) }, // mostly transparent
      u_node: { value: new THREE.Color('#FFE0A0') },
      u_panelAlpha: { value: 0.18 },
      u_nodeIntensity: { value: 2.0 },
      u_rimGain: { value: 0.10 },
      u_fogColor: { value: new THREE.Color(0x1a1820) },
      u_fogDensity: { value: 0.055 },
    }
    const innerShell = new THREE.Mesh(
      innerGeom,
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: innerUniforms,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
      })
    )
    innerShell.renderOrder = 4 // renders before outer shell
    scene.add(innerShell)

    // 3D occluder sphere at the geometric centre — renders AFTER the shells
    // so it visually anchors the centre of the structure (lattice surrounds
    // the void rather than sitting in front of it).
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        fog: false,
        // transparent:true forces it into the transparent render queue, so
        // renderOrder=10 actually renders AFTER the alpha-blended shells.
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      })
    )
    occluder.renderOrder = 10
    scene.add(occluder)

    // Corona ring — billboard plane at sphere centre, always faces camera.
    // Plane spans 1.6 world units; bright annulus lands at radii ~0.45–0.55
    // (just outside the 0.42 occluder), softening to ~0.78.
    const PLANE_SIZE = 1.6
    const OCCLUDER_R = 0.42
    const coronaTex = (() => {
      const c = document.createElement('canvas')
      const SIZE = 512
      c.width = c.height = SIZE
      const ctx = c.getContext('2d')!
      const cx = SIZE / 2
      // Convert world radius to canvas pixel radius.
      const worldToPx = (w: number) => (w / PLANE_SIZE) * SIZE
      const inner = worldToPx(OCCLUDER_R + 0.01) // 0.43 world
      const peak = worldToPx(OCCLUDER_R + 0.08) // 0.50 world
      const outer = worldToPx(OCCLUDER_R + 0.36) // 0.78 world
      const img = ctx.createImageData(SIZE, SIZE)
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const dx = x - cx
          const dy = y - cx
          const r = Math.sqrt(dx * dx + dy * dy)
          let a = 0
          let cr = 255, cg = 220, cb = 150
          if (r < inner) {
            a = 0
          } else if (r < peak) {
            const t = (r - inner) / (peak - inner)
            a = Math.pow(t, 0.7)
            cr = 255
            cg = 210 + 35 * (1 - t)
            cb = 130 + 50 * (1 - t)
          } else if (r < outer) {
            const t = (r - peak) / (outer - peak)
            a = Math.pow(1 - t, 1.6)
            cr = 255
            cg = 140 - 65 * t
            cb = 60 - 35 * t
          }
          const i = (y * SIZE + x) * 4
          img.data[i] = Math.max(0, cr)
          img.data[i + 1] = Math.max(0, cg)
          img.data[i + 2] = Math.max(0, cb)
          img.data[i + 3] = Math.max(0, Math.min(255, a * 255))
        }
      }
      ctx.putImageData(img, 0, 0)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    })()
    const corona = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE),
      new THREE.MeshBasicMaterial({
        map: coronaTex,
        // HDR boost — additive blending lets values >1 push the ring into bloom
        // territory so it stays visible even under the semi-opaque shell panels.
        color: new THREE.Color(1.5, 1.4, 1.2),
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        fog: true,
      })
    )
    // Corona renders BETWEEN shells and occluder so shells in front of corona
    // (silhouette region) still draw on top, but the occluder never gets
    // overlaid by it. Net effect: bright halo around the central void with the
    // lattice still reading clearly across the sphere.
    corona.renderOrder = 9
    scene.add(corona)


    // The dark void + corona ring are drawn by the shell shader itself, in the
    // sphere's local space, so they rotate with the sphere body.

    // Postprocessing — modest bloom (avoid over-blowing)
    const composer = new EffectComposer(renderer)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    composer.setSize(width, height)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.18,
      0.35,
      0.85
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    let rafId = 0
    const start = performance.now()
    const tick = () => {
      const t = (performance.now() - start) / 1000
      outerUniforms.u_time.value = t
      innerUniforms.u_time.value = t

      // Slow camera breathing
      const ang = t * 0.04
      camera.position.x = Math.sin(ang) * 0.3
      camera.position.y = Math.sin(t * 0.05) * 0.10
      camera.position.z = 17 + Math.cos(ang) * 0.3
      camera.lookAt(0, 0.05, 0)

      // Both shells rotate around Y at slightly different rates so the two
      // lattice layers slide past each other for parallax depth.
      outerShell.rotation.y = t * 0.18
      innerShell.rotation.y = -t * 0.12
      corona.lookAt(camera.position)


      renderer.autoClear = false
      renderer.clear()
      renderer.render(bgScene, bgCamera)
      composer.render()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
      bloom.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)

      outerShell.geometry.dispose()
      ;(outerShell.material as THREE.Material).dispose()
      innerShell.geometry.dispose()
      ;(innerShell.material as THREE.Material).dispose()
      occluder.geometry.dispose()
      ;(occluder.material as THREE.Material).dispose()
      corona.geometry.dispose()
      ;(corona.material as THREE.Material).dispose()
      coronaTex.dispose()
      bgQuad.geometry.dispose()
      ;(bgQuad.material as THREE.Material).dispose()
      renderer.dispose()
      composer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 0,
      }}
    />
  )
}
