// Where the nav hands over from the hamburger to the full inline row.
//
// The breakpoint itself lives in exactly one place: the `xl:` classes in Nav.tsx
// (Tailwind's `xl`, 80rem ≈ 1280px). Measured on the shipped design at 1280px, the
// inline row needs 1248px: content 1119.5 (wordmark + 7 section links + 3 locale
// pills + contact CTA) + 32 inter-group gaps + 96 px-12 gutters, rounded up. So `xl`
// is the narrowest standard breakpoint that fits it, with 32px left over. The old
// `md` switch showed that row from 768px, where the CTA and the locale switcher fell
// off the right edge and the wordmark wrapped onto two lines.
//
// Nothing restates that width in JS. Callers ask the DOM which way the CSS went, by
// reading the computed display of the hamburger the `xl:hidden` class applies to —
// a px constant here would silently disagree with a rem-based media query for
// anyone whose browser default font size isn't 16px, and again if the theme's
// breakpoint ever moves.
//
// Lives in its own module (not Nav.tsx) so that file keeps exporting only its
// component, which is what React Fast Refresh requires.
export function inlineNavTakesOver(hamburger: HTMLElement | null): boolean {
  if (!hamburger) return false
  return getComputedStyle(hamburger).display === 'none'
}
