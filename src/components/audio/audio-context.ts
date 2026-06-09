// Ambient-audio mute state, shared via context. AudioProvider owns the <audio>
// element and fade logic; the standalone MusicToggle FAB (bottom-left) reads and
// flips this state. Hook + context live here (non-component) so AudioProvider.tsx
// exports only its component, keeping React Fast Refresh happy.

import { createContext, useContext } from 'react'

export interface AmbientAudioValue {
  muted: boolean
  toggle: () => void
  unmute: () => void
  // start the element playing but silent, inside a user gesture, so a later unmute() (e.g. after the
  // hero intro) produces sound even though it fires outside a gesture (iOS autoplay unlock)
  unlock: () => void
}

export const AmbientAudioContext = createContext<AmbientAudioValue | null>(null)

export function useAmbientAudio(): AmbientAudioValue {
  const ctx = useContext(AmbientAudioContext)
  // Safe fallback if a consumer mounts outside the provider (shouldn't happen).
  if (!ctx) return { muted: true, toggle: () => {}, unmute: () => {}, unlock: () => {} }
  return ctx
}
