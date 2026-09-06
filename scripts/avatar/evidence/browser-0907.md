# Two builds nobody had loaded, loaded

Phase 3.5 (VRM 1.0 → 0.x conversion) and Phase 4 (per-mesh skins, rebound
garment weights) both produce a file whose only honest check is a browser: the
Python and vitest suites read the bytes, and three-vrm reading the same bytes
is a different question. Neither had been opened in one. Done 2026-09-07
through `scripts/avatar/live-preview.html`, which now takes `?model=`.

Dev server: `npm run dev`, Vite 8.1.4 on :5173. Browser: Playwright Chromium.

## Phase 3.5 — the converted fixture

`python3 make.py --base fixtures/seed-san.vrm` writes
`out/base-vrm0.vrm` (10,922,948 bytes): VirtualCast's Seed-san, a VRM 1.0 body
with 51 humanoid bones, five skins, non-identity rest rotations and +Z forward,
converted to VRM 0.x. Copied to `public/avatar/_check-base-vrm0.vrm` for the
run and deleted afterwards; it is not a variant and is not served.

`live-preview.html?model=/avatar/_check-base-vrm0.vrm`

The page declares `MIKA_MILFY_FAMILY` for whatever it loads, so this run told
the engine that Seed-san is a `vroid-sample-b` rig, which it is not. That is
what the declaration is for on a tool that opens undeclared builds, and it is
why nothing here reads a clearance number as true of this body: the run is
checking that three-vrm loads the file, poses it and draws it, not that the
VRoid clip budgets apply to a robot.

- Status line: 「10 支動作已就緒」 — every clip bound to the converted skeleton.
- Console: 0 errors. One warning, `VRMAnimationLoaderPlugin: specVersion of the
  VRMA is not defined`, which every clip raises on every body and predates this.
- `browser-0907-vrm1to0-launcher.png` — upright, facing camera. The −Z flip the
  conversion writes is what makes that true; an unconverted 1.0 body faces away.
- `browser-0907-vrm1to0-dance.png` — the dance clip retargeted onto 51 bones
  with the 1.0 thumb names, arms up, hair swinging on the converted springs.
- `browser-0907-vrm1to0-column.png` — the column framing (head to shins; the
  composition crops at 0.430 and the feet are below it), materials intact — the
  eight matcap approximations the conversion reported do not read as blown-out
  white.

## Phase 4 — the shipped build with rebound weights

`public/avatar/mika-milfy-12.vrm`, last written by b6270f8, the commit that
smoothed the imported garment's skin weights so the cardigan stopped tearing at
the armpit and elbow. The default preview URL.

- Console: 0 errors, the same single VRMA warning.
- `browser-0907-rebound-stretch.png` — stretch, elbow bent, sleeve continuous.
- `browser-0907-rebound-dance.png` — mid-dance in profile, the shoulder and
  sleeve read as one surface.
- `browser-0907-rebound-dance-armsup.png` — arm out to the side, the pose the tear
  showed on: shoulder to elbow to cuff, no gap.
