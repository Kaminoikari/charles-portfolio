import { useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { ThreeEvent } from '@react-three/fiber'
import { skills } from '../data/skills'
import type { Skill } from '../data/skills'

// --- Constants ---

const LINE_COUNT = 36
const LINE_LENGTH = 12
const PARTICLE_BASE_SIZE = 0.06
const HOVER_SCALE = 1.4
const SLOW_MULTIPLIER = 0.3
const BLOOM_INTENSITY = 1.2
const BLOOM_LUMINANCE_THRESHOLD = 0.4

const COLOR_MAP: Record<Skill['color'], THREE.Color> = {
  white: new THREE.Color(160 / 255, 180 / 255, 200 / 255),
  cyan: new THREE.Color(160 / 255, 200 / 255, 220 / 255),
  gray: new THREE.Color(100 / 255, 100 / 255, 100 / 255),
}

const OPACITY_MAP: Record<Skill['color'], number> = {
  white: 0.55,
  cyan: 0.65,
  gray: 0.27,
}

const EMISSIVE_MAP: Record<Skill['color'], THREE.Color> = {
  white: new THREE.Color(0, 0, 0),
  cyan: new THREE.Color(0.2, 0.6, 0.8),
  gray: new THREE.Color(0, 0, 0),
}

// --- Helpers ---

function generateParticlePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * Math.random())
    const radius = 0.5 + Math.random() * (LINE_LENGTH - 1)
    // Scatter particles along radiating lines with some perpendicular jitter
    const jitter = (Math.random() - 0.5) * 0.8
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    positions[i * 3] = cosA * radius + (-sinA) * jitter
    positions[i * 3 + 1] = sinA * radius + cosA * jitter
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3
  }
  return positions
}

// --- Sub-components ---

function RadiatingLines() {
  const geometry = useMemo(() => {
    const points: number[] = []
    const colors: number[] = []
    for (let i = 0; i < LINE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / LINE_COUNT
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      // Center point
      points.push(0, 0, 0)
      colors.push(0.24, 0.24, 0.24, 0.3)
      // Outer point
      points.push(cos * LINE_LENGTH, sin * LINE_LENGTH, 0)
      colors.push(0.24, 0.24, 0.24, 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
    return geo
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </lineSegments>
  )
}

interface ParticlesProps {
  speedMultiplier: React.RefObject<number>
  onHover: (index: number | null, screenPos: { x: number; y: number } | null) => void
}

const TOTAL_PARTICLES = 24 // ~20 decorative + skill-labeled particles

function Particles({ speedMultiplier, onHover }: ParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera, size } = useThree()
  const count = TOTAL_PARTICLES
  const hoveredRef = useRef<number | null>(null)

  const { basePositions, phases, radii } = useMemo(() => {
    const positions = generateParticlePositions(count)
    const ph = new Float32Array(count)
    const rd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      ph[i] = Math.random() * Math.PI * 2
      rd[i] = 0.02 + Math.random() * 0.04
    }
    return { basePositions: positions, phases: ph, radii: rd }
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointerNDC = useRef(new THREE.Vector2(9999, 9999))

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerNDC.current.set(
      (e.clientX / size.width) * 2 - 1,
      -(e.clientY / size.height) * 2 + 1,
    )
  }, [size])

  const handlePointerLeave = useCallback(() => {
    pointerNDC.current.set(9999, 9999)
    if (hoveredRef.current !== null) {
      hoveredRef.current = null
      onHover(null, null)
    }
  }, [onHover])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = clock.getElapsedTime() * (speedMultiplier.current ?? 1)

    // Raycasting for hover detection
    raycaster.setFromCamera(pointerNDC.current, camera)
    const intersects = raycaster.intersectObject(mesh)
    const hitIndex = intersects.length > 0 ? intersects[0].instanceId ?? null : null

    if (hitIndex !== hoveredRef.current) {
      hoveredRef.current = hitIndex
      if (hitIndex !== null) {
        // Project to screen coordinates for tooltip
        dummy.position.set(
          basePositions[hitIndex * 3],
          basePositions[hitIndex * 3 + 1],
          basePositions[hitIndex * 3 + 2],
        )
        dummy.updateMatrixWorld()
        const projected = dummy.position.clone().project(camera)
        const screenX = ((projected.x + 1) / 2) * size.width
        const screenY = ((-projected.y + 1) / 2) * size.height
        onHover(hitIndex, { x: screenX, y: screenY })
      } else {
        onHover(null, null)
      }
    }

    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3]
      const by = basePositions[i * 3 + 1]
      const bz = basePositions[i * 3 + 2]

      // Floating animation
      const floatX = Math.sin(t * 0.8 + phases[i]) * radii[i]
      const floatY = Math.cos(t * 0.6 + phases[i] * 1.3) * radii[i]

      dummy.position.set(bx + floatX, by + floatY, bz)

      // Scale pulsing + hover scale
      const pulse = 0.8 + 0.2 * Math.sin(t * 1.2 + phases[i] * 2)
      const isHovered = hoveredRef.current === i
      const scale = PARTICLE_BASE_SIZE * pulse * (isHovered ? HOVER_SCALE : 1)
      dummy.scale.set(scale, scale, scale)

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Color with opacity pulsing — use skill data if available, otherwise decorative
      const skill = i < skills.length ? skills[i] : null
      const colorKey = skill ? skill.color : (['white', 'cyan', 'gray'] as const)[i % 3]
      const baseColor = COLOR_MAP[colorKey]
      const baseOpacity = OPACITY_MAP[colorKey]
      const opacityPulse = baseOpacity + 0.1 * Math.sin(t * 1.5 + phases[i])
      tempColor.copy(baseColor).multiplyScalar(opacityPulse / baseOpacity)
      mesh.setColorAt(i, tempColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TOTAL_PARTICLES]}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        transparent
        opacity={0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
        emissive={EMISSIVE_MAP.cyan}
        emissiveIntensity={0.5}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

// --- Main Component ---

export default function UniverseSection() {
  const [tooltip, setTooltip] = useState<{
    name: string
    x: number
    y: number
  } | null>(null)
  const speedRef = useRef(1)
  const sectionRef = useRef<HTMLDivElement>(null)

  const handleParticleHover = useCallback(
    (index: number | null, screenPos: { x: number; y: number } | null) => {
      if (index !== null && screenPos !== null && index < skills.length) {
        setTooltip({ name: skills[index].name, ...screenPos })
      } else {
        setTooltip(null)
      }
    },
    [],
  )

  const handleTextEnter = useCallback(() => {
    speedRef.current = SLOW_MULTIPLIER
  }, [])

  const handleTextLeave = useCallback(() => {
    speedRef.current = 1
  }, [])

  return (
    <section
      id="skills"
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ height: '100vh', background: '#0A0A0A' }}
    >
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0A0A0A']} />
        <RadiatingLines />
        <Particles speedMultiplier={speedRef} onHover={handleParticleHover} />
        <EffectComposer>
          <Bloom
            intensity={BLOOM_INTENSITY}
            luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* HTML Text Overlay — xAI exact layout: "Understand" left of center, "What I Do" right and below */}
      <div
        className="pointer-events-auto absolute inset-0 select-none"
        onMouseEnter={handleTextEnter}
        onMouseLeave={handleTextLeave}
      >
        <span
          className="absolute text-[36px] md:text-[72px]"
          style={{
            right: 'calc(50% + 20px)',
            top: '42%',
            fontWeight: 300,
            color: 'rgba(200, 210, 220, 0.55)',
            lineHeight: 1,
            letterSpacing: '2px',
            textAlign: 'right',
          }}
        >
          Understand
        </span>
        <span
          className="absolute text-[36px] md:text-[72px]"
          style={{
            left: 'calc(50% + 20px)',
            top: '54%',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: 1,
            letterSpacing: '2px',
          }}
        >
          What I Do
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -140%)',
          }}
        >
          <div
            style={{
              background: 'rgba(20, 20, 25, 0.9)',
              border: '1px solid rgba(100, 200, 220, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'rgba(200, 220, 240, 0.9)',
              fontSize: '13px',
              fontWeight: 400,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
            }}
          >
            {tooltip.name}
          </div>
        </div>
      )}
    </section>
  )
}
