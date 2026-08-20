// React shell for the 3D avatar guide. Dynamically imports the engine (which
// carries three-vrm + GLTFLoader) so gated-off visitors (reduced-motion, no
// WebGL2) never download it, and tears the engine down on unmount. All
// behaviour lives in avatarGuideEngine.ts.

import { useEffect, useRef } from 'react'
import {
  AVATAR_FRAMING_DEFAULT,
  PAT_EMOTION,
  type AvatarFraming,
  type AvatarMode,
  type AvatarPlacement,
} from './avatarMode'
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
  sizeClass,
  sizeStyle,
  framing,
  placement,
  onHandle,
  onPat,
  onLoaded,
  onContextLost,
  onLoadFailed,
}: {
  mode: AvatarMode
  active?: boolean
  // Tailwind height/width for the canvas box, from avatarSizeClass(). The
  // engine matches its drawing buffer to whatever this resolves to, so a bigger
  // box means more pixels of her rather than an upscale. Required rather than
  // defaulted: a default would be a fourth hand-written copy of the numbers
  // that avatarMode.ts and its test now hold together.
  sizeClass: string
  // The fullscreen column's box instead, in px, from avatarColumnBox(). It wins
  // over sizeClass when present — that box depends on both viewport axes at
  // once, which is arithmetic no utility class can carry.
  sizeStyle?: { width: number; height: number }
  // Camera distance and look-at height for this placement, when the canvas is
  // tall enough to want a different crop. Undefined keeps the engine default.
  framing?: AvatarFraming
  // Which composition she stands in. The engine plays only the motion-capture
  // clips that have been measured to fit that frame.
  placement: AvatarPlacement
  // Hands the live engine handle up once the engine is created (and null on
  // teardown) so the widget can drive lip sync / emotions / gestures directly
  // — those are imperative performance beats, not renderable React state.
  onHandle?: (handle: AvatarGuideHandle | null) => void
  // Fires when a head pat lands, with which reaction it earned. The face and
  // the body beat are performed here (below) so a pat always reads even when
  // no sound can follow; the callback exists because the VOICE belongs to
  // ChatWidget — it owns the one audio element, the no-overlap rule and the
  // lip-sync wiring, none of which this shell should grow a second copy of.
  onPat?: (kind: 'happy' | 'annoyed') => void
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
  const framingRef = useRef(framing)
  const placementRef = useRef(placement)
  const onHandleRef = useRef(onHandle)
  const onPatRef = useRef(onPat)
  const onLoadedRef = useRef(onLoaded)
  const onContextLostRef = useRef(onContextLost)
  const onLoadFailedRef = useRef(onLoadFailed)
  useEffect(() => {
    onHandleRef.current = onHandle
    onPatRef.current = onPat
    onLoadedRef.current = onLoaded
    onContextLostRef.current = onContextLost
    onLoadFailedRef.current = onLoadFailed
  }, [onHandle, onPat, onLoaded, onContextLost, onLoadFailed])

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
      // The engine is created with the default framing; a placement that
      // already wants a different one would otherwise show one frame of the
      // wrong crop before the effect below fires.
      const f = framingRef.current
      if (f) handleRef.current.setFraming(f.distance, f.lookAtY)
      handleRef.current.setPlacement(placementRef.current)
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
    placementRef.current = placement
    handleRef.current?.setPlacement(placement)
  }, [placement])

  // Dolly with the placement. Depends on the numbers rather than the object so
  // a fresh literal each render does not re-run this.
  const framingDistance = framing?.distance
  const framingLookAtY = framing?.lookAtY
  useEffect(() => {
    framingRef.current =
      framingDistance !== undefined && framingLookAtY !== undefined
        ? { distance: framingDistance, lookAtY: framingLookAtY }
        : undefined
    const f = framingRef.current ?? AVATAR_FRAMING_DEFAULT
    handleRef.current?.setFraming(f.distance, f.lookAtY)
  }, [framingDistance, framingLookAtY])

  // Head pats, desktop (fine-pointer) only: a stroke back and forth across her
  // head (≥3 direction flips within 2s) earns a happy head wiggle and a
  // bashful giggle (えへへ, via onPat → ChatWidget). Listening is
  // passive on document — nothing here can swallow the click that opens the
  // panel, and a hidden placement (zero-size rect) is ignored.
  //
  // Cursor tracking used to live here too: she turned her head toward the
  // pointer wherever it went on the page. Removed 2026-08-14 on the owner's
  // call — a figure that follows the cursor across an unrelated page reads as
  // demanding attention rather than offering it. Her look now comes only from
  // the chat state (idle sweep / listening / speaking) and her own idle acts.
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let patDir = 0
    let patFlips = 0
    let patWindowStart = 0
    let patCooldownUntil = 0
    // Third pat in quick succession and the wiggle turns into 怒り: petting a
    // cat past its patience. Streak resets once the visitor lets 20s pass.
    let patStreak = 0
    let lastPatAt = 0
    let lastX = 0
    const onMove = (e: PointerEvent) => {
      const h = handleRef.current
      const canvas = canvasRef.current
      if (!h || !canvas) return
      const r = canvas.getBoundingClientRect()
      if (r.width === 0) return
      const now = performance.now()
      // Projected against the VRM's own skeleton in the waist-up framing, her
      // hair top sits at 12.5% of the canvas HEIGHT, chin ~38%, neck 42.8%.
      // The band is 12–40%: a little slack above the hair, and stopping short
      // of the neck so a stroke across her collarbone is not a head pat.
      //
      // Both axes are fractions of the HEIGHT, measured from her centre line.
      // Height is what fixes her scale (metres-per-pixel divides by it), while
      // width only buys margin for her arms — so a fraction of the width would
      // make the band grow with the margin. It did: the 2026-08-14 widening
      // took it from ±54px to ±73.5px, 3.7× her head, before this was tied to
      // the right axis. 0.19 = the 54px it was at the original 280px box.
      const midX = r.left + r.width / 2
      const headHalfBand = r.height * 0.19
      const inHead =
        e.clientX > midX - headHalfBand &&
        e.clientX < midX + headHalfBand &&
        e.clientY > r.top + r.height * 0.12 &&
        e.clientY < r.top + r.height * 0.4
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
              patStreak = now - lastPatAt < 20000 ? patStreak + 1 : 1
              lastPatAt = now
              // She reacts here and reports the pat upward; the sound (a
              // bashful giggle on the happy beat) is ChatWidget's to play.
              // Plan F's "pats never speak" still holds in the sense that
              // matters: she laughs, she never says a line — the owner asked
              // for the laugh on 2026-08-20.
              if (patStreak >= 3) {
                patStreak = 0
                h.setEmotion(...PAT_EMOTION.annoyed)
                // The third pat stays silent on purpose: a giggle under the
                // 怒り face would cancel out the one beat that says "enough".
                onPatRef.current?.('annoyed')
              } else {
                h.setEmotion(...PAT_EMOTION.happy)
                h.playGesture('wiggle')
                onPatRef.current?.('happy')
              }
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
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
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
      // The waist-up camera crops her mid-thigh; without this the crop reads as
      // a hard cut across her legs. The gradient dissolves the last 16% of the
      // canvas into the page instead.
      className={
        'pointer-events-none select-none [-webkit-mask-image:linear-gradient(to_bottom,#000_84%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_84%,transparent_100%)] ' +
        (sizeStyle ? '' : sizeClass)
      }
      style={sizeStyle}
    />
  )
}
