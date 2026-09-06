# Phase 6b (part 1) — the rig family in the variant registry

2026-09-06. Plan `~/.claude/plans/nested-conjuring-wirth.md`, Phase 6b.

Phase 6b has two halves. This is the first: making the registry say which
skeleton each body has, so the measurements Phase 5 gathered are attached to
the right bodies. The second half is the integration fixture, which needs a
free VRM 1.0 whose licence the owner has approved; it is not done and is not
started (see **Not done**).

## What was wrong

The registry assumed one skeleton, silently. `AVATAR_VARIANTS` listed three
bodies and the only thing holding them to one rig was a test that compared each
one to the FIRST entry. That test cannot say anything once a second rig is
declared, and it also passes when every body moves together, which is what a
re-export of the whole VRoid project does. `motionsFor(placement)` returned the
same pool for any body, so a clip that does not work on a second skeleton had
no way to be withheld from it. And `avatarVariants.ts` explained the whole
arrangement as "the same 54 bones", which is not what makes two bodies
interchangeable: two skeletons can both have 54 bones and rest in different
places.

## What changed

| file | what it is now |
|---|---|
| `src/components/chat/avatarVariants.ts` | `AvatarFamilyId`, `AVATAR_FAMILIES`, `AvatarVariant.family`, `familyOf`, `familyOfUrl` |
| `src/components/chat/avatarMotions.ts` | `motionsFor(placement, family)` also drops what the family excludes |
| `src/components/chat/avatarGuideEngine.ts` | `shownFamily`, settled in `loadVariant` before the old body goes and recorded in `installVrm` beside `shownUrl` |
| `src/components/chat/ChatWidget.tsx` | the strip asks for the family of the body on screen |
| `src/components/chat/avatarVariants.test.ts` | four family tests replace the two rig tests |
| `src/components/chat/avatarGuideEngine.variant.test.ts` | the swap carries the family; the family is settled before the old body goes; the registry outranks `declaredFamily` |
| `src/components/chat/rigProbe.test.ts` | the pool test is per family, both directions |
| `src/components/chat/ChatWidget.test.tsx` | the strip's call site is pinned to `variantShown` |
| `scripts/avatar/live-preview-config.ts` | `MIKA_MILFY_FAMILY`, for a build the registry has not seen |
| `scripts/avatar/live-preview.ts` | hands that family to `initAvatarGuide` |
| `scripts/avatar/live-preview.test.ts` | holds it there |

`AVATAR_FAMILIES` holds the clearance file itself rather than a record that
restates its `rigSha`. The plan specified `{ rigSha, clearance }`; a second copy
of the sha could disagree with the one the producers wrote and nothing would say
which was right, so the map is `Record<AvatarFamilyId, ClearanceFile>` and the
sha is read from the file. That is the one deviation from the plan's shape.

`motionsFor`'s family argument is required rather than defaulted. A default is
what lets the wiring that carries the loaded body's family be deleted with every
test still green, which is the failure this layer exists to prevent — the
signature change surfaced 19 call sites, and each one is now a place that has to
name a family.

`familyOfUrl` returns null rather than throwing, and the engine settles the
family BEFORE it releases the body on screen. Both came out of code review. An
id is from this module's own union; a URL is a string from anywhere, and
`scripts/avatar/live-preview.ts` exists precisely to load a build that is not
declared yet — a throw there took the preview page down at construction, before
the canvas was wired, so the tool's own "load failed" message could never fire.
Resolving after `uninstallVrm()` was worse in a quieter way: the new body would
be in the scene with no clips bound and `resolve(true)` never reached, leaving
the look strip busy for the life of the page. Now an undeclared URL is refused
before anything moves — reported on the same condition as a 404, so a visitor
who can still see her gets no error — and a tool that knows better passes
`declaredFamily`. That declaration is a fallback and never an override: the
registry answers first for any URL it knows, or the preview tool could put one
family's clearances on another family's declared body, which is the mistake
this layer exists to prevent.

## Cost of importing the clearance into client code

`avatarVariants.ts` now imports `clearance/vroid-sample-b`, so for the first
time the measurement tables reach the browser and `combineClearance`'s
validation runs at module load there. Measured rather than estimated, by
building twice with only that import swapped for a stub: the eager `index`
chunk goes 930.91 → 937.06 kB, +6,150 bytes minified, +2.27 kB gzipped on a
345 kB chunk (0.66%). Both builds, and the sha of `avatarVariants.ts` before
the swap and after the restore, are in `families-0906-bundle.md`; that file
also records why the validation's new browser-side throw is not a new risk.

## Measurements

`motionsFor` filters twice and the two filters answer different questions:
`placements` is a property of the clip, `excluded` a property of the body. On the
one declared family they remove nothing extra: its three exclusions (`greeting`,
`showFullBody`, `shoot`) are clips that never entered the pool, so all ten of
`IDLE_MOTIONS` are still offered, which the green run confirms.

## Mutations

12, in `mutations-0906-families.md`, all as declared and all with the restore
verified by sha256. The harness is Phase 5's with two changes: a row may
declare an expected GREEN, and restores run in reverse order. The second is
defensive only — ascending is wrong just for a row that lists one file twice,
and no row here or in Phase 5 does (G6 is the only multi-file row and its two
edits land in two different files), so it changes no result in either receipt.

G9–G13 were added after code review, for four places that were wired and
working but pinned by nothing: the widget's own call site (G9 — swapping
`variantShown` for `variantWanted` there returns the same ten clips today, so
only a source guard separates them), the order `loadVariant` settles the family
in (G10 refusal, G11 "handed, not looked up"), the preview tool's declared
family (G12), and the precedence between the registry and `declaredFamily`
(G13 — reversing one `??` lets a tool's declaration override the registry for a
body the registry does know, which is one family's clearances on another
family's body, and with one family declared nothing else can tell the two
orders apart).

G6 is a pair, because the guard it proves is unreachable on the shipped data:
no family excludes a clip the pool offers. `G6-setup` adds such an exclusion and
must stay GREEN — the clip is correctly withheld. `G6` is that same setup plus
the exclusion filter removed, and goes RED. A single RED would not have said
which of the two did the work.

The plan also asked for "family with no clearance → red (delete the `.gen.ts`)".
There is no such row and there cannot be: `AVATAR_FAMILIES` is
`Record<AvatarFamilyId, ClearanceFile>`, so an entry without a clearance does
not compile, and deleting a `.gen.ts` half is an import error before any test
runs — vitest reports a module that failed to load, not a guard that fired.
G3 covers the reachable half of that requirement: it widens the map to
`Record<string, …>` and adds an entry no variant declares, and the test goes
red. `avatarVariants.test.ts` records this where the test's name would
otherwise over-promise it.

Two more properties are deliberately absent, for a related reason: neither is
something a vitest mutation can turn red. They are NOT held the same way, and
the first version of this receipt said they were.

- **`AvatarVariant.family` is a required field.** Marking it `family?:` does not
  compile at all: `npx tsc -p tsconfig.app.json --noEmit` reports TS2322 on
  `familyOf`'s `return found.family` and TS2538 twice in `avatarVariants.test.ts`
  where an optional id indexes `AVATAR_FAMILIES`. Run, not assumed. The type
  checker refuses it outright, so there is nothing for vitest to say.
- **`motionsFor` takes a required family.** Giving it a default DOES compile
  clean and redden nothing, which is exactly why it is worth stating: the guard
  is the signature, and nothing else would notice the wiring being deleted.

What catches their runtime consequences is G2 (a body declared with no family)
and G7/G8 (the engine naming a family instead of asking the body it loaded). They
were drafted as G1 and G5, and the ids skip those two rather than renumbering,
so the receipt and the harness name the same rows.

## Green

| suite | result | log |
|---|---|---|
| `npx vitest run` | 26 files, 414 tests passed | `families-0906-green.log` |
| `python3 -m unittest discover -s scripts/avatar -p '*_test.py'` | 223 tests, OK | `families-0906-pytests.log` |
| `npm run lint` and `npx tsc -p tsconfig.app.json --noEmit` | clean, exit 0 | `families-0906-checks.log` |
| `npm run build` | built | `families-0906-bundle.md` |

Every row was re-run after the last edit to any file it covers, and every row
names the log it came from. The first version of this receipt claimed the first
part while its vitest log predated three later edits, and described the other
three rows without evidence at all.

## Stale prose corrected

- `avatarVariants.ts`, in two places. The variant doc said "the same 54 bones",
  which was never the criterion: what makes these three one family is that
  `rigOf` hashes the same for all of them. The module header then said every
  variant must carry the same rest pose and that "the sha the clearance file
  names is the rig every variant has to be" — one global rig, which is the
  assumption this phase removed. It now opens on the rule the phase installed:
  same family ⇒ the clearance is shared; new family ⇒ measure it again.
- `avatarMotions.ts`: the dance was called "the largest of the ten". It is the
  third largest — 729,512 bytes, behind peaceSign's 1,335,704 and squat's
  771,944; it is the longest to PLAY, which is what the passage was reaching
  for. (The first correction of this quoted squat as 754KB, which is its size
  in KiB while the other two were quoted in decimal KB. All three now read
  decimal, with the byte counts beside them.)
- `render.py`: "Posed rendering needs the joint matrices and is not here yet."
  It has been here since `gather(posed=)` landed; `partmap.draw` hands the
  positions `pose.skinned()` produces straight to it, which is how pierce.py
  and motion.py sweep a clip.
- `proportion.py`: `rescale(pos, factor, chin, foot=FOOT_Y)` took a `foot` the
  body never read, left over from the version that compressed the body to hold
  total height. The parameter and `FOOT_Y` are gone, and the docstring says why
  there is no floor to scale towards.
- `~/vtuber-kit/models/README.md`, four claims this project has since
  falsified: that the pipeline needs VRM 0.x (both versions are read since
  Phase 0, and `make.py` converts 1.0 at the entry since Phase 3.5); that the
  clip clearances live in `avatarMotions.ts` (they moved to the clearance file
  in Phase 5); and, in two separate sections, that the hair crown can only be
  read in a browser (the spring simulator produces it; only the 1.5mm fringe is
  a browser reading). The first pass corrected one of those two sections and
  left the other contradicting it.

## Not done

- **The integration fixture.** Phase 6b's second half is a second real body
  through the whole pipeline, and the plan requires the candidate's licence to
  be approved before anything is downloaded. Nothing has been fetched. Until it
  runs, Phases 1–4 have no end-to-end acceptance on a body that is not this
  family, and the registry's family layer has only one family in it.
- The clip pool's `excluded` filter therefore has no positive case on shipped
  data. G6 is its receipt.
