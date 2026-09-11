# Is the pan a reference-frame error? No.

`scripts/avatar/evidence/pan-shift-0911.ts`, run 2026-09-11.

Three of the fourteen rig families had no pan that equalled its own
re-derivation. The first diagnosis was that `springsim` projects each clip's
crown through a camera already raised by the pan while `clearance.panRange`
subtracts a frame edge computed without it, so the two sides of the subtraction
were in different frames of reference; the proposed fix was to record the crown
unpanned and add the pan back arithmetically in `panRange`.

Both halves of that are wrong, and this is the measurement that says so.

## The pan is an exact translation of the rig

`FrameCamera` places the camera at `(0, lookAtY + tilt, ±distance)` looking at
`(0, lookAtY, 0)`, and a pan of `p` adds `p` to `lookAtY`. Position and target
both move, so the whole rig translates, and `screen` adds the same `lookAtY`
back. The identity that follows is `screen_p(P) === screen_0(P - p·ŷ) + p`:

```
identity screen_p(P) == screen_0(P - p) + p:
  worst absolute difference over 36 samples: 4.441e-16
```

Floating-point exact. What it rules out is the proposed fix: the panned reading
is the unpanned reading of a point MOVED, not the unpanned reading of the same
point plus a constant. A recorded crown HEIGHT does not carry enough to
reconstruct it -- that would need the crown's world position re-projected.

## And the shift per unit of pan is small, and negative

  y      z       p     screen_0   screen_p   screen_p-screen_0   d/dp
  1.55  0.00   0.10   1.55392   1.55245   -0.00147          -0.0147
  1.55  0.00   0.30   1.55392   1.55053   -0.00339          -0.0113
  1.70  0.00   0.10   1.70677   1.70478   -0.00199          -0.0199
  1.70  0.00   0.30   1.70677   1.70184   -0.00493          -0.0164
  1.85  0.00   0.10   1.86040   1.85789   -0.00251          -0.0251
  1.85  0.00   0.30   1.86040   1.85392   -0.00648          -0.0216
  1.55  0.06   0.10   1.56504   1.56097   -0.00406          -0.0406
  1.55  0.06   0.30   1.56504   1.55393   -0.01111          -0.0370
  1.70  0.06   0.10   1.72181   1.71720   -0.00461          -0.0461
  1.70  0.06   0.30   1.72181   1.70908   -0.01273          -0.0424
  1.85  0.06   0.10   1.87940   1.87425   -0.00515          -0.0515
  1.85  0.06   0.30   1.87940   1.86504   -0.01436          -0.0479
  1.55  0.12   0.10   1.57673   1.56994   -0.00679          -0.0679
  1.55  0.12   0.30   1.57673   1.55750   -0.01923          -0.0641
  1.70  0.12   0.10   1.73763   1.73027   -0.00736          -0.0736
  1.70  0.12   0.30   1.73763   1.71669   -0.02094          -0.0698
  1.85  0.12   0.10   1.89939   1.89146   -0.00794          -0.0794
  1.85  0.12   0.30   1.89939   1.87673   -0.02266          -0.0755


A reference-frame error would show `screen_p - screen_0` equal to `p`. It is
between -0.15mm and -0.8mm for a 100mm pan: the crown sits near the subject
plane, where raising the camera barely moves the projection, and what movement
there is goes the other way. Taken through `crownWorst`'s max across a clip's
placements the observed slope reaches -0.34, still far inside 1:1.

## What that leaves

`avatarViewSpan` returns `lookAtY + half` with the unpanned `lookAtY`, and
`screen` returns absolute subject-plane height, so under pan `p` the top edge is
at `view.top + p`. "The crown is inside" is exactly
`screen_p(crown) - view.top <= p`, which is `least <= p`. `panRange`'s
subtraction is dimensionally correct as written.

The defect is only that `least` is a function of the pan -- because
`crownScreen` was read under it -- while the guard asked for
`pan === ceil(least(pan))`, a fixed point that need not exist on the centimetre
grid. Since the slope is inside 1:1, `p - least(p)` is strictly increasing, so
the smallest grid point that FITS is unique and well defined even where the
fixed point is not. `clearance.panHolds` asks for that instead.
