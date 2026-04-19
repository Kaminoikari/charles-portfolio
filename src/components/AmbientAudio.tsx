import { useEffect, useRef, useState } from 'react'

const AUDIO_SRC = '/assets/ambient-space.mp3'
const TARGET_VOLUME = 0.35
const FADE_DURATION_MS = 1800
const STORAGE_KEY = 'ambient-audio-muted'

function fadeVolume(audio: HTMLAudioElement, from: number, to: number, durationMs: number) {
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    audio.volume = from + (to - from) * t
    if (t < 1) requestAnimationFrame(tick)
    else if (to === 0) audio.pause()
  }
  requestAnimationFrame(tick)
}

export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    // Default to muted so the icon matches the browser's autoplay-blocked reality.
    // Only remember "unmuted" when the user explicitly opted in.
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (muted) {
      if (!audio.paused) fadeVolume(audio, audio.volume, 0, 600)
      return
    }

    audio.volume = 0
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => fadeVolume(audio, 0, TARGET_VOLUME, FADE_DURATION_MS))
        .catch(() => {})
    }
  }, [muted])

  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <>
      <audio ref={audioRef} src={AUDIO_SRC} loop preload="auto" aria-hidden="true" />
      <button
        type="button"
        onClick={toggleMuted}
        aria-label={muted ? 'Unmute ambient music' : 'Mute ambient music'}
        aria-pressed={!muted}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur-md transition-all duration-300 hover:border-[var(--color-accent-cyan)] hover:text-[var(--color-accent-cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-cyan)]"
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4Z" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4Z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
    </>
  )
}
