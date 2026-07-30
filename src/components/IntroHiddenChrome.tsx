import type { ReactNode } from 'react'
import { useHeroIntro } from './hero/hero-intro-context'
import { CHROME_REVEAL_MS } from './hero/introTiming'

// Floating controls (the music toggle, the chat launcher and its open panel) step
// aside while the hero intro owns the screen, and come back with the nav, the
// headline and the ambient track.
//
// Opacity only — never a transform on this wrapper. A transformed ancestor becomes
// the containing block for its `position: fixed` descendants, which would drag
// both FABs out of the viewport corners and into the page flow (the same trap the
// site-wide `.reveal` wrappers set for fixed overlays).
export function IntroHiddenChrome({ children }: { children: ReactNode }) {
  const { introRunning } = useHeroIntro()
  return (
    <div
      // inert so neither control answers a Tab or a click from behind the splash
      // gate; it also covers a chat panel left open before the visitor arrived here
      inert={introRunning}
      aria-hidden={introRunning || undefined}
      style={{
        opacity: introRunning ? 0 : 1,
        transition: `opacity ${CHROME_REVEAL_MS}ms ease`,
      }}
    >
      {children}
    </div>
  )
}
