import { useEffect, useRef, useState } from 'react'

/** How long a scene's crossfade runs; a clip fading out keeps playing until it is gone. */
export const SCENE_FADE_MS = 700

/**
 * A moving backdrop. Only the scene on show has a video at all. A scene she
 * leaves keeps playing through its fade, then drops its video and keeps its
 * poster (the clip's first frame), so coming back still crossfades from a
 * picture and only one clip's decoded frames are ever held. Until 2026-10-03
 * every visited scene kept its paused video mounted, buffers and all, until
 * the page went; the owner asked for the backdrop to take no extra memory.
 *
 * The clip on show is kept playing. Muted and inline, every browser lets it
 * start without a tap, but iOS in Low Power Mode refuses, and a page sent to
 * the background has its video paused and not resumed. A refusal leaves the
 * poster up and tries again on the next completed tap (the gesture iOS
 * honours, see CLAUDE.md's audio rules) and whenever the page comes back to
 * the front. A visitor who asks for reduced motion keeps the poster and never
 * downloads the clip.
 */
export function SceneClip({ poster, video, focusX, on }: { poster: string; video: string; focusX: number; on: boolean }) {
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [live, setLive] = useState(on)
  useEffect(() => {
    if (on) {
      setLive(true)
      return
    }
    const drop = window.setTimeout(() => setLive(false), SCENE_FADE_MS)
    return () => window.clearTimeout(drop)
  }, [on])
  const picture = (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-cover"
      style={{ backgroundImage: `url(${poster})`, backgroundPosition: `${focusX}% 70%` }}
    />
  )
  if (still || !live) return picture
  return <LiveClip poster={poster} video={video} focusX={focusX} on={on} />
}

function LiveClip({ poster, video, focusX, on }: { poster: string; video: string; focusX: number; on: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  // The source is set here rather than in the markup, so the cleanup that
  // empties it is undone by the next mount (StrictMode mounts twice in
  // development, and an emptied source the markup set once never came back).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.src = video
    return () => {
      // A detached <video> holds its buffers until it is collected; emptying
      // its source gives them back now.
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
  }, [video])
  useEffect(() => {
    const el = ref.current
    if (!el || !on) return
    const kick = () => {
      if (el.paused) el.play().catch(() => {})
    }
    const back = () => {
      if (document.visibilityState === 'visible') kick()
    }
    kick()
    window.addEventListener('pointerup', kick)
    window.addEventListener('touchend', kick)
    document.addEventListener('visibilitychange', back)
    window.addEventListener('pageshow', back)
    return () => {
      window.removeEventListener('pointerup', kick)
      window.removeEventListener('touchend', kick)
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('pageshow', back)
    }
  }, [on])
  return (
    <video
      ref={ref}
      aria-hidden="true"
      poster={poster}
      muted
      loop
      playsInline
      preload="auto"
      className="absolute inset-0 h-full w-full object-cover"
      style={{ objectPosition: `${focusX}% 70%` }}
    />
  )
}
