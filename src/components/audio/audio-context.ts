// Ambient-audio mute state, shared via context so both the chat launcher pill
// and the open-panel header can toggle the same audio (the music control was
// folded into the chat widget — see the Phase 5 layout decision). Hook + context
// live here (non-component) so AudioProvider.tsx exports only its component,
// keeping React Fast Refresh happy.

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
