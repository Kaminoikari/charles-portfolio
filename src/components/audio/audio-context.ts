// Ambient-audio mute state, shared via context. AudioProvider owns the <audio>
// element and fade logic; the standalone MusicToggle FAB (bottom-left) reads and
// flips this state. Hook + context live here (non-component) so AudioProvider.tsx
// exports only its component, keeping React Fast Refresh happy.

import { createContext, useContext } from 'react'

export interface AmbientAudioValue {
  muted: boolean
  toggle: () => void
}

export const AmbientAudioContext = createContext<AmbientAudioValue | null>(null)

export function useAmbientAudio(): AmbientAudioValue {
  const ctx = useContext(AmbientAudioContext)
  // Safe fallback if a consumer mounts outside the provider (shouldn't happen).
  if (!ctx) return { muted: true, toggle: () => {} }
  return ctx
}
