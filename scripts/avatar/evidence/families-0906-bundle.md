# Phase 6b: what importing the clearance into client code costs

Two production builds, identical except that AVATAR_FAMILIES' value is
swapped for a stub with no clearance import. Everything else — the family
field, familyOf/familyOfUrl, the engine wiring — is unchanged in both.

$ shasum -a 256 src/components/chat/avatarVariants.ts   # before
622a0987ff63528fe59faafdce6bd272d5be73ff323a50bd331341c8af037c97  /Users/charles/portfolio/src/components/chat/avatarVariants.ts

## A. as shipped (clearance imported)
$ npm run build
dist/assets/index-DLdcBg-2.css              72.26 kB │ gzip:  13.11 kB
dist/assets/ChangelogPage-ZgsT2JHM.js        8.63 kB │ gzip:   2.66 kB
dist/assets/ProjectDetailPage-B3eU5Sjy.js   11.92 kB │ gzip:   3.28 kB
dist/assets/particleHero-WVIYXBPR.js        21.75 kB │ gzip:   5.82 kB
dist/assets/AboutPage-Ds4LzszV.js          135.71 kB │ gzip:  50.51 kB
dist/assets/avatarGuideEngine-BgDCOmaN.js  227.39 kB │ gzip:  59.25 kB
dist/assets/three.module-DcjWpYFJ.js       556.16 kB │ gzip: 139.82 kB
dist/assets/index-Cm65yDye.js              937.06 kB │ gzip: 345.21 kB
✓ built in 1.45s

## B. same tree, clearance import replaced by a stub
$ npx vite build
dist/assets/index-DLdcBg-2.css              72.26 kB │ gzip:  13.11 kB
dist/assets/ChangelogPage-DsFu2ROh.js        8.63 kB │ gzip:   2.66 kB
dist/assets/ProjectDetailPage-DR9X4eDf.js   11.92 kB │ gzip:   3.28 kB
dist/assets/particleHero-WVIYXBPR.js        21.75 kB │ gzip:   5.82 kB
dist/assets/AboutPage-DHnlJSpX.js          135.71 kB │ gzip:  50.51 kB
dist/assets/avatarGuideEngine-CmSr4wn3.js  227.39 kB │ gzip:  59.25 kB
dist/assets/three.module-DcjWpYFJ.js       556.16 kB │ gzip: 139.82 kB
dist/assets/index-DqH9tZs1.js              930.91 kB │ gzip: 342.94 kB
✓ built in 1.38s

$ shasum -a 256 src/components/chat/avatarVariants.ts   # after restore
622a0987ff63528fe59faafdce6bd272d5be73ff323a50bd331341c8af037c97  /Users/charles/portfolio/src/components/chat/avatarVariants.ts

## Reading

|  | eager `index` chunk | gzip |
|---|---|---|
| A, clearance imported | 937.06 kB | 345.21 kB |
| B, stub | 930.91 kB | 342.94 kB |
| difference | +6,150 bytes | +2.27 kB |

Every other chunk is byte-identical between the two builds, including the lazy
`avatarGuideEngine` one: the clearance lands in the chunk the site loads first,
because `ChatWidget` imports `avatarVariants` eagerly. +2.27 kB gzipped on a
345 kB chunk, or 0.66%.

The import also runs `combineClearance`'s validation in the browser at module
load. It throws only when the two produced halves disagree on `rigSha`, or when
`crownFringe` is missing — both build-time facts, held by `clearance.test.ts`
and by Phase 5's C10 and C11, so a throw in a visitor's browser would mean a
build CI had already failed. Accepted at that price: the alternative is a
second copy of `excluded` in the registry, which is the drift this layer exists
to remove.
