// Intro beat lengths in seconds. They live here, outside faceHero.ts, because two
// consumers must agree on them: the engine that plays the intro, and the shell
// that waits for it before handing the site chrome back. Keeping them in
// faceHero.ts would force the shell to statically import the whole three.js
// chunk just to read three numbers.
export const INTRO_BEATS = { red: 2.6, pause: 0.4, sweep: 1.5 } as const

export const INTRO_DURATION_MS = (INTRO_BEATS.red + INTRO_BEATS.pause + INTRO_BEATS.sweep) * 1000

// How long the site chrome takes to fade back in once the intro hands the screen
// over. Matches the hero headline's `duration-700` in FaceHero.tsx, so the nav,
// the floating controls, the headline and the ambient track all arrive on one
// beat. Owned here because the nav and the floating-chrome wrapper both read it.
export const CHROME_REVEAL_MS = 700

// Upper bound the shell waits for the engine's onIntroComplete before revealing
// the chrome anyway. The slack covers engine warm-up, the gate's own fade-out,
// and a dropped frame or two — a stalled intro must never leave the site
// without navigation.
export const INTRO_FAILSAFE_MS = INTRO_DURATION_MS + 4000
