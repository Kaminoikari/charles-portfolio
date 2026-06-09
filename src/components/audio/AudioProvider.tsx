// Owns the ambient <audio> element + fade logic and exposes mute state via
// context. It renders NO floating button of its own — the control now lives
// inside the chat widget (launcher pill + panel header). This replaces the old
// standalone AmbientAudio button that collided with the chat launcher.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AmbientAudioContext } from './audio-context'

const AUDIO_SRC = '/assets/ambient-space.mp3'
const TARGET_VOLUME = 0.35
const FADE_DURATION_MS = 1800

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

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  // Always start muted on every page load — sound is opt-in per session.
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (muted) {
      if (!audio.paused) fadeVolume(audio, audio.volume, 0, 600)
      return
    }

    audio.muted = false   // clear the silent-unlock flag set in unlock()
    audio.volume = 0
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => fadeVolume(audio, 0, TARGET_VOLUME, FADE_DURATION_MS)).catch(() => {})
    }
  }, [muted])

  // play silently inside the user gesture so a later unmute() (after the hero intro) can produce
  // sound on iOS, where audio must first be started by a real gesture
  const unlock = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = true
    audio.play().catch(() => {})
  }

  return (
    <AmbientAudioContext.Provider value={{ muted, toggle: () => setMuted((p) => !p), unmute: () => setMuted(false), unlock }}>
      <audio ref={audioRef} src={AUDIO_SRC} loop preload="none" aria-hidden="true" />
      {children}
    </AmbientAudioContext.Provider>
  )
}
