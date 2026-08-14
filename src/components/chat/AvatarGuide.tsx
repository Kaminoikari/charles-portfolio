// React shell for the 3D avatar guide. Dynamically imports the engine (which
// carries three-vrm + GLTFLoader) so gated-off visitors (reduced-motion, no
// WebGL2) never download it, and tears the engine down on unmount. All
// behaviour lives in avatarGuideEngine.ts.

import { useEffect, useRef } from 'react'
import type { AvatarMode } from './avatarMode'
import type { AvatarGuideHandle } from './avatarGuideEngine'

// _webp = same model repacked with EXT_texture_webp textures (15.4MB→5.5MB,
// scripts/compress_vrm_webp.py). /avatar/* is cached immutable, so any
// content change MUST come with a new filename. WebP support is a safe
// assumption here: the avatar gate already requires WebGL2, which every
// WebP-capable browser generation ships with.
const VRM_URL = '/avatar/AvatarSample_B_webp.vrm'

export default function AvatarGuide({
  mode,
  active = true,
  onHandle,
  onLoaded,
  onContextLost,
  onLoadFailed,
}: {
  mode: AvatarMode
  active?: boolean
  // Hands the live engine handle up once the engine is created (and null on
  // teardown) so the widget can drive lip sync / emotions / gestures directly
  // — those are imperative performance beats, not renderable React state.
  onHandle?: (handle: AvatarGuideHandle | null) => void
  // Relayed from the engine after the VRM's first rendered frame; the widget
  // swaps the capsule launcher for the character only after this fires.
  onLoaded?: () => void
  // Relayed when the browser reclaims the WebGL context — the canvas stays
  // blank from then on, so the widget must fall back to the capsule launcher.
  onContextLost?: () => void
  // Relayed when the VRM fetch/parse fails — the widget keeps the corner
  // empty during a healthy load, so a failure has to announce itself.
  onLoadFailed?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<AvatarGuideHandle | null>(null)
  const modeRef = useRef(mode)
  const activeRef = useRef(active)
  const onHandleRef = useRef(onHandle)
  const onLoadedRef = useRef(onLoaded)
  const onContextLostRef = useRef(onContextLost)
  const onLoadFailedRef = useRef(onLoadFailed)
  useEffect(() => {
    onHandleRef.current = onHandle
    onLoadedRef.current = onLoaded
    onContextLostRef.current = onContextLost
    onLoadFailedRef.current = onLoadFailed
  }, [onHandle, onLoaded, onContextLost, onLoadFailed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    void import('./avatarGuideEngine').then(({ initAvatarGuide }) => {
      // The import resolves after unmount if the visitor closes fast; a handle
      // created then would leak its render loop.
      if (cancelled || !canvasRef.current) return
      handleRef.current = initAvatarGuide(
        canvas,
        VRM_URL,
        () => {
          if (!cancelled) onLoadedRef.current?.()
        },
        () => {
          if (!cancelled) onContextLostRef.current?.()
        },
        () => {
          if (!cancelled) onLoadFailedRef.current?.()
        },
      )
      handleRef.current.setMode(modeRef.current)
      handleRef.current.setActive(activeRef.current)
      onHandleRef.current?.(handleRef.current)
    })
    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
      onHandleRef.current?.(null)
    }
  }, [])

  useEffect(() => {
    modeRef.current = mode
    handleRef.current?.setMode(mode)
  }, [mode])

  // Cursor perception, desktop (fine-pointer) only: she watches the cursor
  // when it comes near, and a stroke back and forth across her head (≥3
  // direction flips within 2s) earns a happy head wiggle. Listening is
  // passive on document — nothing here can swallow the click that opens the
  // panel, and a hidden placement (zero-size rect) just clears the gaze.
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let patDir = 0
    let patFlips = 0
    let patWindowStart = 0
    let patCooldownUntil = 0
    let lastX = 0
    const onMove = (e: PointerEvent) => {
      const h = handleRef.current
      const canvas = canvasRef.current
      if (!h || !canvas) return
      const r = canvas.getBoundingClientRect()
      if (r.width === 0) {
        h.clearGaze()
        return
      }
      const dx = e.clientX - (r.left + r.width / 2)
      // Her face sits in the upper third, not at the geometric centre.
      const dy = e.clientY - (r.top + r.height * 0.35)
      if (Math.hypot(dx, dy) < 420) {
        h.setGaze(dx / (r.width * 1.6), -dy / (r.height * 1.1))
      } else {
        h.clearGaze()
      }
      const now = performance.now()
      const inHead =
        e.clientX > r.left + r.width * 0.2 &&
        e.clientX < r.right - r.width * 0.2 &&
        e.clientY > r.top &&
        e.clientY < r.top + r.height * 0.32
      if (inHead) {
        const dir = Math.sign(e.clientX - lastX)
        if (dir !== 0) {
          if (patDir !== 0 && dir !== patDir) {
            if (patFlips === 0) patWindowStart = now
            if (now - patWindowStart >= 2000) {
              patFlips = 0
              patWindowStart = now
            }
            patFlips++
            if (patFlips >= 3 && now > patCooldownUntil) {
              patFlips = 0
              patCooldownUntil = now + 8000
              // Deliberately silent (plan F): pats never speak, only react.
              h.setEmotion('happy', 0.9, 1.8)
              h.playGesture('wiggle')
            }
          }
          patDir = dir
        }
      } else {
        patDir = 0
        patFlips = 0
      }
      lastX = e.clientX
    }
    // Leaving the window entirely fires no further pointermove — without
    // these she'd stay locked on the last cursor position (R1 review LOW).
    const onLeave = () => handleRef.current?.clearGaze()
    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [])

  useEffect(() => {
    activeRef.current = active
    handleRef.current?.setActive(active)
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none h-[280px] w-[180px] select-none"
    />
  )
}
