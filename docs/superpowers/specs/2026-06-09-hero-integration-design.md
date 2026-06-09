# Hero Integration — Design Spec

Date: 2026-06-09
Branch: `feat/hero-face-base`
Status: design, pending implementation plan

## 1. Goal

Replace the current portfolio hero (Canvas2D particle system + black-hole backdrop + Konami easter egg) with the Three.js face portrait built in `experiments/hero-clone/face-base.html`. The new hero is Charles's photographed face baked into a halftone dot portrait that periodically sweeps between a dot-matrix state and a lit wireframe constellation, fronted by a loading + Enter gate that lets the cinematic intro play with sound.

## 2. Scope

- Full replacement of the existing hero visual engine. The current particle/black-hole/Konami code is removed, not extended.
- The original hero is preserved on the `fallback/original-hero` branch (already created and pushed) so it can be restored at any time.
- The face look itself (halftone bake, sweep, shed-dust field, constellation vertices, snappy scan, intro red curtain + eye ignition + braam, hold-to-fire laser) is already built and tuned in the sandbox; this work ports it into the React app, adds the loading/Enter gate, and lays out the hero text around it.

Out of scope (this pass): i18n of the hero copy (keep current English line), yutaabe's separate SHIFT/warp mode, an audio mute control.

## 3. Architecture (approach C — extract module, bundle three, thin React shell)

The standalone Three.js module is extracted into a self-contained engine with a small public API, called by a thin React component that owns the DOM, layout, gate, and lifecycle.

```
src/components/hero/
  faceHero.ts     // the ported Three.js engine (scene, GLB load, halftone+wireframe,
                  // sweep + dust + constellation, intro, laser, audio). No React.
  FaceHero.tsx    // React shell: <section>, <canvas>, loading + Enter gate, hero text,
                  // SCROLL hint. Owns mount/unmount, Enter → startIntro, reduced-motion.
```

`three` is added as a bundled npm dependency, version-pinned to `0.183.0` (the version the sandbox uses). Imports change from the CDN importmap to bundled specifiers: `import * as THREE from 'three'` and addons from `three/examples/jsm/...` (GLTFLoader, SimplifyModifier, BufferGeometryUtils, EffectComposer, RenderPass, UnrealBloomPass, OutputPass). TypeScript types: prefer three's bundled types; if they do not resolve at the pinned version, add `@types/three` at the matching version (resolved during implementation).

Post-extraction, `faceHero.ts` is the canonical source for the engine. `experiments/hero-clone/face-base.html` stays as a reference/dev sandbox but is no longer the deployed code; the two may diverge.

### Module API

```ts
type FaceHeroOptions = {
  assetBase: string                 // e.g. '/hero/'
  onProgress?: (p: number) => void  // 0..1 real load progress (GLB + texture + audio)
  onReady?: () => void              // assets loaded, Enter can be enabled
  onIntroComplete?: () => void      // intro finished, hero text may reveal
  reducedMotion?: boolean           // skip the animated intro
}
type FaceHeroHandle = {
  startIntro: () => void            // called from the Enter click (a real user gesture → audio unlocks)
  dispose: () => void               // tear down renderer, listeners, RAF, audio
}
function initFaceHero(canvas: HTMLCanvasElement, opts: FaceHeroOptions): FaceHeroHandle
```

The engine no longer auto-plays the intro on load and no longer needs the sandbox's approach-A "replay on first interaction" workaround — the Enter gate guarantees the gesture. `startIntro()` runs the red-curtain → eye-ignition → braam → sweep-reveal sequence, then steady-state sweep cycling.

## 4. Assets

Move the six runtime assets the engine actually uses into `public/hero/` (served at `/hero/...`):

- `male_base.glb`
- `charles-face.png`
- `intro_scan.mp3`, `intro_baam2.mp3`
- `laser-attack.mp3`, `laser-fire.wav`

The engine resolves them via `opts.assetBase`. Unused sandbox assets (`cat.glb`, `dog*.glb`, `intro_baam.mp3`, `laser-fire.mp3`) are not moved. Note: `laser-fire.wav` is ~1.5 MB; kept as WAV for the seamless loop, revisit later if bundle weight matters.

## 5. Loading + Enter gate

A full-screen dark overlay rendered by `FaceHero.tsx`, in the site's own brand language (NOT a clone of any reference site): SF Mono, dark background, cyan primary with mars-orange accent.

- **Loading:** lowercase `loading` with a real percentage counter driven by `onProgress` (GLB + texture + audio). The canvas sits idle/black behind it.
- **Enter:** once `onReady` fires (100%), the label becomes a bracketed lowercase `[ enter ]` control; Charles's name/handle sits in a corner.
- **Click `[ enter ]`** (the user gesture): unlock audio, call `handle.startIntro()`, fade the gate out.

This is the production replacement for the sandbox's approach-A audio workaround.

### Session behavior (D1)

The gate shows once per browser tab session (`sessionStorage` flag). First home visit → gate + full intro with sound. Returning to home via in-app navigation within the same session → skip the gate and show the hero with text already revealed (no forced silent replay).

### No mute control (D2)

v1 ships without an audio mute toggle. Enter implies consent to sound.

## 6. Choreography (data flow)

```
/ mounts FaceHero → initFaceHero(canvas) starts loading assets, gate shows "loading %"
onReady (100%)    → gate shows "[ enter ]"
click [ enter ]   → unlock audio + startIntro() + gate fades out
  intro: scan riser + rising red curtain → eyes ignite + braam → sweep reveal of the dot portrait
onIntroComplete   → hero <h1> fades up from the lower third → SCROLL hint appears
steady state      → periodic sweep: dot portrait ↔ wireframe constellation (shed-dust field,
                    twinkling vertices), hold-to-fire eye laser on pointer
```

## 7. Layout

- Full-bleed face canvas filling the hero `<section>` (`h-screen`, like the current hero).
- Hero text overlaid in the lower third over a bottom gradient scrim for legibility; preserve the current copy: "Hi, I'm Charles. I'm a Senior Product Manager building products at the speed of AI." (kept in the React tree, faded until the reveal).
- SCROLL hint pinned bottom-centre, appears last.
- The head may need to sit slightly higher than dead-centre so the eyes are not behind the text; tuned during implementation.
- Mobile: text stacks below the face; the hold-to-fire touch behavior already built carries over so vertical swipes still scroll.

## 8. Cleanup

- Delete `src/components/ParticleHero.tsx` (contains the particle system, photo sampling, Konami easter egg, and the inline `EasterEggHint`).
- Delete `src/components/BlackHoleBackdrop.tsx` (only consumed by `ParticleHero`).
- `src/App.tsx`: replace `<ParticleHero />` with `<FaceHero />`.
- `charles-face.png` in `src` is only used by `ParticleHero`; the `public/hero/` copy serves the engine after removal.
- Changelog data files mention these by name in historical entries — those are text records, left untouched.

## 9. Accessibility, error handling, fallback

- The hero `<h1>` always exists in the DOM (visually faded until reveal) so crawlers and screen readers get the headline regardless of gate/intro state.
- `prefers-reduced-motion` (D3): skip the animated intro entirely — show the static face + text immediately. The gate still appears but Enter resolves instantly to the settled state.
- WebGL unsupported or GLB load failure: fall back to a static `charles-face.png` + the hero text, so the page never hard-fails. Error handling concentrated at the engine boundary (the GLTFLoader reject path and a WebGL-context check).
- `dispose()` must fully tear down renderer, RAF loop, event listeners, and audio on unmount to avoid leaks during SPA navigation.

## 10. Testing

The project has no React test harness today (only `tsx --test` for RAG). Automated gate:

- `tsc -b` typecheck passes (strict; no `any` on the module's public surface).
- `eslint .` passes.
- `vite build` succeeds (confirms three + addons bundle correctly).

Add a minimal `vitest` + `@testing-library/react` setup to cover the shell logic with the engine module mocked:

- FaceHero renders; the hero `<h1>` text is present in the DOM before/after the gate.
- The loading→enter transition flips on `onReady`.
- Clicking `[ enter ]` calls `startIntro` exactly once and unlocks audio.
- `prefers-reduced-motion` path skips the intro.

Visual verification remains manual via the dev server (headless screenshots of the heavy WebGL canvas are unreliable). Verify multiple states (loading, enter, intro, dot portrait, wireframe) and the true default, not a single flattering frame.

## 11. Risks / notes

- Regression risk to the tuned visual is low because the engine logic is ported near-verbatim behind the module boundary rather than rewritten.
- WebGL context lifecycle under React (StrictMode double-mount in dev) must be handled by `dispose()` + guarded init.
- `three` adds meaningful bundle weight; acceptable for a flagship hero, monitored at `vite build`.
