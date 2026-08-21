// React shell for the 3D avatar guide. Dynamically imports the engine (which
// carries three-vrm + GLTFLoader) so gated-off visitors (reduced-motion, no
// WebGL2) never download it, and tears the engine down on unmount. All
// behaviour lives in avatarGuideEngine.ts.

import { useEffect, useRef } from 'react'
import {
  AVATAR_FRAMING_DEFAULT,
  PAT_EMOTION,
  avatarHeadBand,
  type AvatarFraming,
  type AvatarMode,
  type AvatarPlacement,
} from './avatarMode'
import type { AvatarGuideHandle } from './avatarGuideEngine'

// Head-pat pacing. The streak window is what makes three pats read as "in a
// row" rather than as three unrelated pats over a coffee break; the two
// cooldowns differ because the gestures do. A stroke is continuous, so without
// a long cooldown one sweep would fire over and over.
//
// The tap gap is deliberately SHORT. It exists to collapse a duplicate
// pointerup into one pat, not to police how fast the visitor may pat: a
// deliberate second tap is a second pat, and three quick ones have to reach the
// annoyed beat, which is the whole point of the gesture. At 350ms it did not —
// a steady 300ms tap rhythm landed only two pats in three, so the third pat
// needed a fifth tap. 120ms is below any rhythm a hand produces on purpose.
const PAT_STREAK_LIMIT = 3
const PAT_STREAK_WINDOW_MS = 20000
const PAT_STROKE_COOLDOWN_MS = 8000
const PAT_TAP_COOLDOWN_MS = 120

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

  // Head pats, two ways in.
  //
  // A TAP on her head (mouse or touch) is the plain one, added 2026-08-21 on
  // the owner's ask. A STROKE back and forth across it (≥3 direction flips
  // within 2s, fine pointers only) is the older one and still earns the same
  // reaction. Either way the third in a row turns the happy wiggle into 怒り:
  // petting a cat past its patience. The streak is SHARED, so three of any mix
  // gets there.
  //
  // Both listen passively on document rather than on a hit target of their own.
  // The canvas is pointer-events-none and must stay that way — anything here
  // that could swallow a click would be swallowing the click that opens the
  // panel. A hidden placement (zero-size rect) is ignored for the same reason.
  //
  // Cursor tracking used to live here too: she turned her head toward the
  // pointer wherever it went on the page. Removed 2026-08-14 on the owner's
  // call — a figure that follows the cursor across an unrelated page reads as
  // demanding attention rather than offering it. Her look now comes only from
  // the chat state (idle sweep / listening / speaking) and her own idle acts.
  useEffect(() => {
    let patDir = 0
    let patFlips = 0
    let patWindowStart = 0
    let strokeCooldownUntil = 0
    let tapCooldownUntil = 0
    let patStreak = 0
    let lastPatAt = 0
    let lastX = 0

    // Where her head is depends on the camera, so the band is derived from the
    // framing rather than written down. It used to be two literal canvas
    // percentages measured against lookAtY 1.17; raising the frame to 1.32 on
    // 2026-08-20 moved her head down inside the canvas and left the band
    // pointing at the wrong part of it, with nothing to notice. avatarMode.ts
    // owns that arithmetic now and its test holds it to both placements.
    const onHead = (clientX: number, clientY: number): boolean => {
      const canvas = canvasRef.current
      if (!canvas) return false
      const r = canvas.getBoundingClientRect()
      if (r.width === 0) return false
      const band = avatarHeadBand(framingRef.current ?? AVATAR_FRAMING_DEFAULT, {
        w: r.width,
        h: r.height,
      })
      const midX = r.left + r.width / 2
      const halfBand = r.width * band.halfWidth
      return (
        clientX > midX - halfBand &&
        clientX < midX + halfBand &&
        clientY > r.top + r.height * band.top &&
        clientY < r.top + r.height * band.bottom
      )
    }

    // She reacts here and reports the pat upward; the SOUND is ChatWidget's to
    // play, because it owns the one audio element and the no-overlap rule. The
    // face and the body beat stay here so a pat still reads when the sound is
    // skipped or the browser refuses it.
    // Returns whether the pat LANDED. The engine handle arrives from a dynamic
    // import, so a gesture during the load has nothing to perform on; callers
    // must not spend their cooldown on one, or a stroke over her head before
    // the engine is ready would do nothing AND eat the next eight seconds.
    const landPat = (now: number): boolean => {
      const h = handleRef.current
      if (!h) return false
      patStreak = now - lastPatAt < PAT_STREAK_WINDOW_MS ? patStreak + 1 : 1
      lastPatAt = now
      if (patStreak >= PAT_STREAK_LIMIT) {
        patStreak = 0
        h.setEmotion(...PAT_EMOTION.annoyed)
        onPatRef.current?.('annoyed')
      } else {
        h.setEmotion(...PAT_EMOTION.happy)
        h.playGesture('wiggle')
        onPatRef.current?.('happy')
      }
      return true
    }

    const onTap = (e: PointerEvent) => {
      // While she IS the launcher, every click on her belongs to the button
      // that opens the panel. Giving her head a second meaning there would
      // spend the visitor's way in on a giggle.
      //
      // The reach that leaves is a WIDTH, not a pointer type: the docked
      // placement needs ≥880px and the fullscreen column ≥768px
      // (avatarPlacement), and neither asks what kind of pointer you have. A
      // narrow phone therefore never reaches a tap pat, because she is only
      // ever its launcher; an iPad, or the same phone turned landscape, does.
      if (placementRef.current === 'launcher') return
      const now = performance.now()
      if (now < tapCooldownUntil || !onHead(e.clientX, e.clientY)) return
      if (landPat(now)) tapCooldownUntil = now + PAT_TAP_COOLDOWN_MS
    }

    const onMove = (e: PointerEvent) => {
      const now = performance.now()
      if (!onHead(e.clientX, e.clientY)) {
        patDir = 0
        patFlips = 0
        lastX = e.clientX
        return
      }
      const dir = Math.sign(e.clientX - lastX)
      if (dir !== 0) {
        if (patDir !== 0 && dir !== patDir) {
          if (patFlips === 0) patWindowStart = now
          if (now - patWindowStart >= 2000) {
            patFlips = 0
            patWindowStart = now
          }
          patFlips++
          if (patFlips >= 3 && now > strokeCooldownUntil) {
            patFlips = 0
            if (landPat(now)) strokeCooldownUntil = now + PAT_STROKE_COOLDOWN_MS
          }
        }
        patDir = dir
      }
      lastX = e.clientX
    }

    // pointerup, not pointerdown: it is a tap-COMPLETED gesture, which is what
    // iOS requires before it will let the reaction make a sound at all (the
    // project's audio rules in CLAUDE.md).
    document.addEventListener('pointerup', onTap, { passive: true })
    const fine = window.matchMedia('(pointer: fine)').matches
    if (fine) document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointerup', onTap)
      if (fine) document.removeEventListener('pointermove', onMove)
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
