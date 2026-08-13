// React shell for the 3D avatar guide. Dynamically imports the engine (which
// carries three-vrm + GLTFLoader) so gated-off visitors (reduced-motion, no
// WebGL2) never download it, and tears the engine down on unmount. All
// behaviour lives in avatarGuideEngine.ts.

import { useEffect, useRef } from 'react'
import type { AvatarMode } from './avatarMode'
import type { AvatarGuideHandle } from './avatarGuideEngine'

const VRM_URL = '/avatar/AvatarSample_B.vrm'

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
