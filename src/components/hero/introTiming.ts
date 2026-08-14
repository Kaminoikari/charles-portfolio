// Intro beat lengths in seconds. They lived outside the hero engine because two
// consumers had to agree on them: the engine that played the intro, and the shell
// that waited for it before handing the site chrome back. Keeping them in the
// engine would have forced the shell to statically import the whole three.js
// chunk just to read three numbers.
//
// INTRO_BEATS and INTRO_DURATION_MS have no consumer since the face hero was
// deleted on 2026-08-14; only CHROME_REVEAL_MS below is still read. See
// hero-intro-context.ts for what that means for the intro machinery as a whole.
export const INTRO_BEATS = { red: 2.6, pause: 0.4, sweep: 1.5 } as const

export const INTRO_DURATION_MS = (INTRO_BEATS.red + INTRO_BEATS.pause + INTRO_BEATS.sweep) * 1000

// How long the site chrome takes to fade back in once the intro hands the screen
// over. It was matched to the old hero headline's `duration-700` so the nav, the
// floating controls and the headline all arrived on one beat. Owned here because
// the nav and the floating-chrome wrapper both read it.
export const CHROME_REVEAL_MS = 700

// Upper bound the shell waits for the engine's onIntroComplete before revealing
// the chrome anyway. The slack covers engine warm-up, the gate's own fade-out,
// and a dropped frame or two — a stalled intro must never leave the site
// without navigation.
export const INTRO_FAILSAFE_MS = INTRO_DURATION_MS + 4000
