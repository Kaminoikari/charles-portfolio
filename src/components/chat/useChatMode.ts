// Size state for the chat widget: a launcher pill, the small docked panel, or
// a fullscreen takeover.
//
// There is deliberately no "closed" state. Stowing the panel always keeps the
// conversation — the conversation lives in useChatStream inside ChatWidget, and
// ChatWidget never unmounts — so `minimised` is the only resting state and the
// only way to discard a conversation is the explicit "clear" control.

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChatMode = 'minimised' | 'docked' | 'fullscreen'

/** The two sizes the panel can actually be read at. */
type OpenMode = Exclude<ChatMode, 'minimised'>

export interface ChatModeControls {
  mode: ChatMode
  /** Re-open from the pill at whichever size was last in use. */
  open: () => void
  minimise: () => void
  toggleFullscreen: () => void
}

export function useChatMode(): ChatModeControls {
  const [mode, setMode] = useState<ChatMode>('minimised')
  // Remembers the size the visitor was last reading at, so re-opening from the
  // pill does not demote a fullscreen user to the small panel every time.
  const lastOpenRef = useRef<OpenMode>('docked')

  const goTo = useCallback((next: ChatMode) => {
    if (next !== 'minimised') lastOpenRef.current = next
    setMode(next)
  }, [])

  const open = useCallback(() => goTo(lastOpenRef.current), [goTo])
  const minimise = useCallback(() => goTo('minimised'), [goTo])

  const toggleFullscreen = useCallback(() => {
    setMode((prev) => {
      const next: OpenMode = prev === 'fullscreen' ? 'docked' : 'fullscreen'
      lastOpenRef.current = next
      return next
    })
  }, [])

  // Escape steps down one level rather than dismissing outright: fullscreen
  // collapses to the docked panel, the docked panel stows to the pill, and a
  // stowed widget ignores the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMode((prev) => {
        if (prev === 'fullscreen') {
          lastOpenRef.current = 'docked'
          return 'docked'
        }
        if (prev === 'docked') return 'minimised'
        return prev
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { mode, open, minimise, toggleFullscreen }
}
