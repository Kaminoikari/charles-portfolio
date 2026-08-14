# Portfolio — Project Instructions

## Changelog

Only auto-add changelog entries for **major features or significant changes** (new sections, architectural shifts, large redesigns, headline technical work). Routine fixes, copy tweaks, small UX adjustments, refactors, and minor visual polish do **not** require an entry.

If you're unsure whether a change qualifies, **ask first** before writing one. Do not silently add or skip entries when in doubt.

## Design Context

### Users
- **Primary**: Recruiters and hiring managers evaluating AI PM candidates
- **Secondary**: Potential co-founders and collaborators
- **Tertiary**: Industry peers and community

### Brand Personality
**Bold. Impactful. Memorable.**

### Aesthetic Direction
- Dark, cinematic, tech-forward — inspired by xAI
- Space Grotesk + SF Mono, mars orange (#E8652B) accent, cyan (#00D9FF) interactive states
- Anti-references: Wix/Squarespace templates, plain GitHub README portfolios

### Design Principles
1. **Show, don't tell** — Canvas animations visualize products, metrics are prominent
2. **Content density with breathing room** — Meaningful info + generous spacing
3. **Interactive but purposeful** — Every animation serves a narrative
4. **Consistency over novelty** — Unified system > individual flourishes
5. **Performance is a feature** — Canvas pauses off-screen, lean dependencies

## Engineering Notes

### Audio — iOS Safari rules (hard-won; do NOT re-litigate)

Any audio on this site must respect these iOS Safari (incl. iOS 18) facts. We
burned many deploy cycles proving them on a real iPhone — trust them instead of
re-testing from scratch.

These rules were won on the hero's heat-vision SFX, which lived in
`src/components/hero/faceHero.ts`. That file was deleted on 2026-08-14 when the
face hero was replaced (see the changelog entry `hero-particle-field`); the code
it describes is on the `backup/hero-face` branch if you ever need to read the
working implementation. The rules below still bind every audio surface that
remains, above all Mika's voice in `src/components/chat/`.

- **Do NOT use the Web Audio API for the looping beam.** It cannot be unlocked
  reliably on iOS in our interaction model. Use `<audio>` elements (HTMLMediaElement),
  which are far more lenient. This was a deliberate, tested decision.
- **iOS unlocks audio only on a tap-COMPLETED gesture** (`click` / `touchend` /
  `pointerup`) — **never** `touchstart` / `pointerdown`, and never off-gesture
  (e.g. a `setTimeout`/`onReady` callback).
- **A `new AudioContext()` constructed outside a tap-completed gesture is
  permanently locked** — `resume()` never resolves to `running`, even from a later
  good gesture. (This is what made "refresh → loop silent" unfixable with Web Audio:
  the skip-intro/refresh path has no Enter click, and a press-and-HOLD has no
  completed tap before the sound needs to start.)
- **HTMLAudio unlock pattern that works:** start the element playing **muted inside
  the gesture**, then **unmute it later** (even from a timer) — iOS blocks a fresh
  `.play()` fired from a timer but honours unmuting an already-playing element.
- **Gapless `<audio loop>` without Web Audio:** run **two** loop elements phase-offset
  by half the clip and drive each volume by `|sin(π·phase)|` (equal-power) so each
  dips to silence exactly at its own re-seek seam while the other carries the sound.
  Both just `loop` forever — no `.play()` at the seam — keeping the iOS unlock intact.
- iOS mute-switch: call `navigator.audioSession.type = "playback"` (the existing
  `setPlaybackSession()`) so sound passes with the hardware ringer off (iOS 16.4+).
- Temporary `?audiodebug=1` overlay logging was used to diagnose this; it has been
  removed. Re-add a similar gated overlay if iOS audio ever needs debugging again.
