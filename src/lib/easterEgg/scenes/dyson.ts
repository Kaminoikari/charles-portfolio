import * as THREE from 'three'
import type { BeatScene, SceneContext } from '../types'
import { addBarycentric, clamp01, disposeMesh, easeInOutCubic } from './shared'

const SHELL_VERT = /* glsl */ `
  attribute vec3 a_bary;
  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vBary = a_bary;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const SHELL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 u_glow;
  uniform vec3 u_strut;
  uniform vec3 u_panel;
  uniform vec3 u_node;
  uniform float u_panelAlpha;
  uniform float u_nodeIntensity;
  uniform float u_rimGain;

  void main() {
    vec3 d = fwidth(vBary);
    vec3 a3 = smoothstep(vec3(0.0), d * 1.4, vBary);
    float edgeMask = 1.0 - min(min(a3.x, a3.y), a3.z);

    float maxBary = max(max(vBary.x, vBary.y), vBary.z);
    float vertexHot = pow(smoothstep(0.84, 0.995, maxBary), 1.4);

    float facing = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.4);

    vec3 panelCol = u_panel * (0.7 + 0.6 * facing);
    vec3 strutCol = u_strut * (0.65 + 0.55 * facing) + u_glow * 0.18 * rim;
    vec3 nodeCol = u_node * vertexHot * u_nodeIntensity * (0.45 + 0.55 * facing);

    vec3 col = panelCol;
    col = mix(col, strutCol, edgeMask);
    col += nodeCol * (1.0 - edgeMask * 0.4);
    col += u_glow * rim * u_rimGain;

    float alpha = clamp(u_panelAlpha + edgeMask * (1.0 - u_panelAlpha) + vertexHot * 0.3, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`

export function createDyson(): BeatScene {
  let group: THREE.Group | null = null
  let outer: THREE.Mesh | null = null
  let inner: THREE.Mesh | null = null
  let occluder: THREE.Mesh | null = null
  let corona: THREE.Mesh | null = null
  let coronaTex: THREE.CanvasTexture | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let savedFov = 60

  const outerUniforms = {
    u_glow: { value: new THREE.Color('#FFA050') },
    u_strut: { value: new THREE.Color('#3A2014') },
    u_panel: { value: new THREE.Color(0x1a0e08) },
    u_node: { value: new THREE.Color(0x2a1810) },
    u_panelAlpha: { value: 0.62 },
    u_nodeIntensity: { value: 0.6 },
    u_rimGain: { value: 0.06 },
  }
  const innerUniforms = {
    u_glow: { value: new THREE.Color('#FFCB7A') },
    u_strut: { value: new THREE.Color('#B86028') },
    u_panel: { value: new THREE.Color(0x2a1408) },
    u_node: { value: new THREE.Color('#FFE0A0') },
    u_panelAlpha: { value: 0.18 },
    u_nodeIntensity: { value: 2.0 },
    u_rimGain: { value: 0.10 },
  }

  return {
    init(ctx: SceneContext) {
      camera = ctx.camera
      savedFov = ctx.camera.fov
      group = new THREE.Group()
      ctx.scene.add(group)

      const outerGeom = addBarycentric(new THREE.IcosahedronGeometry(1.0, 3))
      outer = new THREE.Mesh(
        outerGeom,
        new THREE.ShaderMaterial({
          vertexShader: SHELL_VERT,
          fragmentShader: SHELL_FRAG,
          uniforms: outerUniforms,
          side: THREE.FrontSide,
          transparent: true,
          depthWrite: false,
        }),
      )
      outer.renderOrder = 6
      group.add(outer)

      const innerGeom = addBarycentric(new THREE.IcosahedronGeometry(0.86, 3))
      inner = new THREE.Mesh(
        innerGeom,
        new THREE.ShaderMaterial({
          vertexShader: SHELL_VERT,
          fragmentShader: SHELL_FRAG,
          uniforms: innerUniforms,
          side: THREE.FrontSide,
          transparent: true,
          depthWrite: false,
        }),
      )
      inner.renderOrder = 4
      group.add(inner)

      occluder = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 64, 64),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          fog: false,
          transparent: true,
          opacity: 1.0,
          depthWrite: false,
        }),
      )
      occluder.renderOrder = 10
      group.add(occluder)

      const PLANE_SIZE = 1.6
      const OCCLUDER_R = 0.42
      coronaTex = (() => {
        const c = document.createElement('canvas')
        const SIZE = 512
        c.width = c.height = SIZE
        const cx = SIZE / 2
        const ctx2d = c.getContext('2d')!
        const worldToPx = (w: number) => (w / PLANE_SIZE) * SIZE
        const inn = worldToPx(OCCLUDER_R + 0.01)
        const peak = worldToPx(OCCLUDER_R + 0.08)
        const out = worldToPx(OCCLUDER_R + 0.36)
        const img = ctx2d.createImageData(SIZE, SIZE)
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const dx = x - cx
            const dy = y - cx
            const r = Math.sqrt(dx * dx + dy * dy)
            let a = 0
            let cr = 255, cg = 220, cb = 150
            if (r < inn) {
              a = 0
            } else if (r < peak) {
              const tt = (r - inn) / (peak - inn)
              a = Math.pow(tt, 0.7)
              cr = 255
              cg = 210 + 35 * (1 - tt)
              cb = 130 + 50 * (1 - tt)
            } else if (r < out) {
              const tt = (r - peak) / (out - peak)
              a = Math.pow(1 - tt, 1.6)
              cr = 255
              cg = 140 - 65 * tt
              cb = 60 - 35 * tt
            }
            const i = (y * SIZE + x) * 4
            img.data[i] = Math.max(0, cr)
            img.data[i + 1] = Math.max(0, cg)
            img.data[i + 2] = Math.max(0, cb)
            img.data[i + 3] = Math.max(0, Math.min(255, a * 255))
          }
        }
        ctx2d.putImageData(img, 0, 0)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        return tex
      })()
      corona = new THREE.Mesh(
        new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE),
        new THREE.MeshBasicMaterial({
          map: coronaTex,
          color: new THREE.Color(1.5, 1.4, 1.2),
          blending: THREE.AdditiveBlending,
          depthTest: true,
          depthWrite: false,
          transparent: true,
        }),
      )
      corona.renderOrder = 9
      group.add(corona)

    },
    enter(_t: number) {},
    update(t: number, localT: number) {
      const lt = clamp01(localT)
      if (!outer || !inner || !corona || !group || !camera) return

      // Camera dolly + orbit + pull-out:
      // 0.00-0.45: z 4.5 → 2.4 (dolly-zoom in)
      // 0.45-0.85: orbit around y by ~25° (camera position rotates around origin)
      // 0.85-1.00: pull back to z 2.8, slight upward tilt
      const dollyT = clamp01(lt / 0.45)
      const orbitT = clamp01((lt - 0.30) / 0.55)
      const pullT = clamp01((lt - 0.85) / 0.15)

      const baseZ = 4.5 - easeInOutCubic(dollyT) * 2.1 + pullT * 0.4
      const ang = easeInOutCubic(orbitT) * (Math.PI * 0.32)
      camera.position.x = Math.sin(ang) * baseZ
      camera.position.y = pullT * 0.18
      camera.position.z = Math.cos(ang) * baseZ
      camera.lookAt(0, 0, 0)

      // Inner / outer counter-rotation
      outer.rotation.y = t * 0.18
      inner.rotation.y = -t * 0.12

      // Corona faces camera so its annulus is always visible
      corona.lookAt(camera.position)

      const pulse = 1.0 + 0.08 * Math.sin(t * 4.0)
      ;(corona.material as THREE.MeshBasicMaterial).color.setRGB(1.5 * pulse, 1.4 * pulse, 1.2 * pulse)
    },
    exit() {
      if (camera) {
        camera.fov = savedFov
        camera.updateProjectionMatrix()
      }
    },
    dispose() {
      if (group) {
        group.parent?.remove(group)
        disposeMesh(group)
        group = null
        outer = null
        inner = null
        occluder = null
        corona = null
      }
      if (coronaTex) {
        coronaTex.dispose()
        coronaTex = null
      }
      camera = null
    },
  }
}

// Camera animator — separate so the runner can drive the camera while we
// keep scene contents pure. Returns a function the runner could call. Unused
// in current design (scene rotates internally) but kept exported for future.
export function dysonCameraPath(camera: THREE.PerspectiveCamera, localT: number) {
  const lt = clamp01(localT)
  const ease = easeInOutCubic(lt)
  // z: 4.5 → 2.4 → 2.7
  let z = 4.5 - ease * 2.1
  if (lt > 0.85) z = 2.4 + (lt - 0.85) / 0.15 * 0.3
  camera.position.set(0, 0, z)
  camera.lookAt(0, 0, 0)
}
