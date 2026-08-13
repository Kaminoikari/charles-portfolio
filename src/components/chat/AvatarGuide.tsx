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
  onLoaded,
  onContextLost,
}: {
  mode: AvatarMode
  active?: boolean
  // Relayed from the engine after the VRM's first rendered frame; the widget
  // swaps the capsule launcher for the character only after this fires.
  onLoaded?: () => void
  // Relayed when the browser reclaims the WebGL context — the canvas stays
  // blank from then on, so the widget must fall back to the capsule launcher.
  onContextLost?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<AvatarGuideHandle | null>(null)
  const modeRef = useRef(mode)
  const activeRef = useRef(active)
  const onLoadedRef = useRef(onLoaded)
  const onContextLostRef = useRef(onContextLost)
  useEffect(() => {
    onLoadedRef.current = onLoaded
    onContextLostRef.current = onContextLost
  }, [onLoaded, onContextLost])

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
      )
      handleRef.current.setMode(modeRef.current)
      handleRef.current.setActive(activeRef.current)
    })
    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
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
