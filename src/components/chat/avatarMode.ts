// Chat-state → avatar-behaviour mapping for the 3D avatar guide, kept as pure
// functions so the rules are testable without WebGL or React.

import type { ChatStatus } from './useChatStream'

// What the avatar body is doing. The 3D engine consumes this; nothing else does.
//  idle       head sweeps left/right — nobody is talking
//  listening  head tilts up/down — the visitor is composing a question
//  speaking   viseme mouth loop + answering tint — retrieval and streaming
export type AvatarMode = 'idle' | 'listening' | 'speaking'

// `input` is the raw field value, NOT trimmed: during IME composition the field
// briefly holds marks or spaces, and the visitor is very much "typing" then.
export function deriveAvatarMode(input: string, status: ChatStatus): AvatarMode {
  if (status === 'streaming') return 'speaking'
  if (input.length > 0) return 'listening'
  return 'idle'
}

interface GateInputs {
  search: string
  stored: string | null
  matchMedia: (q: string) => Pick<MediaQueryList, 'matches'>
  // A thunk, not a boolean: probing WebGL2 creates a real GL context, and the
  // gate must not pay that cost for the (default, flag-off) production visitor.
  // Keeping the probe lazy means it only runs after every cheaper check passes.
  webgl: () => boolean
}

// Dev-flag gate. The avatar ships dark: production visitors keep the capsule
// launcher until the real character replaces the sample model. Everything here
// is injected so tests never touch real browser globals.
export function avatarGuideEnabled({ search, stored, matchMedia, webgl }: GateInputs): boolean {
  const flagged = new URLSearchParams(search).get('avatar') === '1' || stored === '1'
  if (!flagged) return false
  if (!matchMedia('(min-width: 880px)').matches) return false
  if (!matchMedia('(pointer: fine)').matches) return false
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return webgl()
}

// Browser-bound wrapper used by the widget; the testable core stays injected.
export function avatarGuideEnabledInBrowser(): boolean {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem('avatarGuide')
  } catch {
    // storage blocked (private mode etc.) — flag simply reads as absent
  }
  return avatarGuideEnabled({
    search: window.location.search,
    stored,
    matchMedia: (q) => window.matchMedia(q),
    webgl: hasWebGL,
  })
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') != null
  } catch {
    return false
  }
}
