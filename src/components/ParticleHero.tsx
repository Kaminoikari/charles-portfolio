import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/particle.vert?raw'
import fragmentShader from '../shaders/particle.frag?raw'

// ============================================================
// Constants
// ============================================================
const PARTICLE_COUNT = 3000
const CYAN_PARTICLE_RATIO = 0.15
const SCATTER_RANGE_X = 10
const SCATTER_RANGE_Y = 6
const SCATTER_RANGE_Z = 4
const TEXT_CANVAS_WIDTH = 1024
const TEXT_CANVAS_HEIGHT = 512
const FORMATION_SPEED = 0.008
const MOUSE_DECAY = 0.05

// ============================================================
// Helpers: sample text positions from offscreen Canvas 2D
// ============================================================
function sampleTextPositions(count: number): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = TEXT_CANVAS_WIDTH
  canvas.height = TEXT_CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Float32Array(count * 3)

  // Clear
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, TEXT_CANVAS_WIDTH, TEXT_CANVAS_HEIGHT)

  // Draw "CHARLES" large
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 140px Arial, sans-serif'
  ctx.fillText('CHARLES', TEXT_CANVAS_WIDTH / 2, TEXT_CANVAS_HEIGHT * 0.38)

  // Draw "AI Product Builder" smaller
  ctx.font = '400 40px Arial, sans-serif'
  ctx.fillText('AI Product Builder', TEXT_CANVAS_WIDTH / 2, TEXT_CANVAS_HEIGHT * 0.68)

  // Read pixel data and collect white pixel positions
  const imageData = ctx.getImageData(0, 0, TEXT_CANVAS_WIDTH, TEXT_CANVAS_HEIGHT)
  const pixels = imageData.data
  const whitePositions: Array<{ x: number; y: number }> = []

  // Sample every N pixels for performance
  const step = 2
  for (let y = 0; y < TEXT_CANVAS_HEIGHT; y += step) {
    for (let x = 0; x < TEXT_CANVAS_WIDTH; x += step) {
      const i = (y * TEXT_CANVAS_WIDTH + x) * 4
      if (pixels[i] > 128) {
        whitePositions.push({ x, y })
      }
    }
  }

  // Map canvas coords to 3D world coords and fill target array
  const positions = new Float32Array(count * 3)
  const scaleX = 10 / TEXT_CANVAS_WIDTH   // map to ~[-5, 5]
  const scaleY = 6 / TEXT_CANVAS_HEIGHT    // map to ~[-3, 3]

  for (let i = 0; i < count; i++) {
    if (whitePositions.length === 0) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      continue
    }
    const idx = Math.floor(Math.random() * whitePositions.length)
    const px = whitePositions[idx]
    // Center and scale to world coordinates
    positions[i * 3] = (px.x - TEXT_CANVAS_WIDTH / 2) * scaleX
    positions[i * 3 + 1] = -(px.y - TEXT_CANVAS_HEIGHT / 2) * scaleY
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3 // slight z variation
  }

  return positions
}

// ============================================================
// Particles component (runs inside R3F Canvas)
// ============================================================
function Particles() {
  const pointsRef = useRef<THREE.Points>(null)
  const mouseRef = useRef(new THREE.Vector2(0, 0))
  const smoothMouseRef = useRef(new THREE.Vector2(0, 0))
  const progressRef = useRef(0)
  useThree()

  // Build geometry and material once
  const { geometry, material } = useMemo(() => {
    // Random initial positions
    const randomPositions = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      randomPositions[i * 3] = (Math.random() - 0.5) * SCATTER_RANGE_X
      randomPositions[i * 3 + 1] = (Math.random() - 0.5) * SCATTER_RANGE_Y
      randomPositions[i * 3 + 2] = (Math.random() - 0.5) * SCATTER_RANGE_Z
    }

    // Target text positions
    const targetPositions = sampleTextPositions(PARTICLE_COUNT)

    // Color mix attribute (0 = white, 1 = cyan)
    const colorMix = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      colorMix[i] = Math.random() < CYAN_PARTICLE_RATIO ? 1.0 : 0.0
    }

    const geo = new THREE.BufferGeometry()
    // Dummy position attribute (required by THREE, actual positions computed in shader)
    geo.setAttribute('position', new THREE.Float32BufferAttribute(randomPositions, 3))
    geo.setAttribute('aRandomPos', new THREE.Float32BufferAttribute(randomPositions, 3))
    geo.setAttribute('aTargetPos', new THREE.Float32BufferAttribute(targetPositions, 3))
    geo.setAttribute('aColorMix', new THREE.Float32BufferAttribute(colorMix, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uProgress: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [])

  // Global pointer listener for mouse tracking
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      )
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  // Animation loop
  useFrame((state) => {
    if (!material) return

    // Smooth mouse
    smoothMouseRef.current.lerp(mouseRef.current, MOUSE_DECAY)

    // Animate progress toward 1 (text formation)
    progressRef.current += (1 - progressRef.current) * FORMATION_SPEED

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uMouse.value.copy(smoothMouseRef.current)
    material.uniforms.uProgress.value = progressRef.current
  })

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
    />
  )
}

// ============================================================
// ParticleHero (exported component)
// ============================================================
export default function ParticleHero() {
  return (
    <section className="relative h-screen w-full" style={{ background: '#0A0A0A' }}>
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: false }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <color attach="background" args={['#0A0A0A']} />
        <Particles />
      </Canvas>

      {/* Scroll indicator overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="animate-bounce text-sm tracking-widest text-white/50">
          SCROLL TO EXPLORE ↓
        </span>
      </div>
    </section>
  )
}
