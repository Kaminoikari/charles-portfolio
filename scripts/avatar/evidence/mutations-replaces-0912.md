# Mutating the computed drop list, one defence at a time

Runner: `scripts/avatar/evidence/mutations-replaces-0912.py`, handed the
committed blobs of `make.py`, `customise.py` and `outfits/mellowheart.py`. It
refuses to start unless the working copies already equal them, asserts each
pattern hits exactly once, asserts the restore byte-for-byte, and clears both
`__pycache__` directories before every run. Raw output in
`mutations-replaces-0912.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit):

    make.py                 3ecafe175224fa8d7ff129c04c58455bce337d4e
    customise.py            9ff14c8e2b8282edf937e659234e3af616e3644b
    outfits/mellowheart.py  50432ca0dbfac7757aa49be43babb95db46e0103

Baseline: 32 tests green across `customise_test` and `outfits_test`, and the
loader collects 16 from each, so nothing after a misplaced `unittest.main()`
is being skipped.

The claim under test is that the outfit declares which of the body's parts it
covers, as prefixes, and the build resolves those against whatever manifest
this particular body produced. Five positions can each break that on their own,
so there are five mutations: the call site in `make.py`, the deletable check,
the matching predicate and the ordering in `replaced`, and the contract's value
in `mellowheart.py`.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| R1 | `make.py` carries the five part names it used to carry | the make.py-holds-no-names row | **as expected** |
| R2 | a part the manifest marks undeletable is asked for anyway | the locked-part row | **as expected** |
| R3 | the outfit claims only the garments, leaving the base body's hair clips on | the written-down-list row | **as expected** |
| R4 | the prefixes are matched as whole part names again | the body-without-a-lower-garment row and the never-seen-garment row | **as expected** |
| R5 | the names come out in whatever order the manifest happened to store them | the five-names row and the body-without-a-lower-garment row | **as expected** |

## Why each position needs its own row

**R1 is the one the stage exists for.** Five names living in `make.py` is what
made the pipeline refuse every body except Mika: `drop_parts` raises on a name
the manifest does not carry, deliberately, so a typo cannot quietly leave a
garment on, and that same refusal stopped step 2 dead on the other bodies.
`outfits_test.test_what_comes_off_the_base_body_is_asked_of_the_contract`
reads `make.py` and fails if the list is spelled out there.

**R2 guards a different failure from R1.** With the names hardcoded, nothing
had to consult `deletable`, because the five were all deletable. Resolving by
prefix makes the flag load-bearing: no locked part starts with `Outfit_` on the
bodies measured so far, and the next exporter is free to name one that does.
R1 cannot reach this position, so it gets its own row,
`test_a_part_the_manifest_locks_is_never_asked_for`.

**R3 is the contract's value, not its mechanism.** R1, R2 and R4 all stay
satisfied if `REPLACES` names the wrong prefixes; the pipeline would then dress
Mika and leave her old hair ornament and clip on her head. The guard is
`outfits_test.test_the_prefixes_resolve_to_what_the_written_down_list_held`,
which partitions `baseline.vrm` and asserts the two prefixes resolve to exactly
the five names the old list held, no more and no fewer.

**R4 is the matching predicate, and it is a wide mutation.** Comparing names to
`'Outfit_'` and `'Acc_'` by equality resolves to nothing at all, so it reddens
four other rows besides its own two; the runner lists those separately. Its
must-fail set is still the pair that no other row covers, because those two are
the only cases built from a body other than Mika's: a manifest shaped like
Vivi's, which has a top and shoes and no lower garment, and one carrying
`Outfit_AccessoryNeck` from Sendagaya_Shibu, which this pipeline had never seen
before this stage.

**R5 is ordering, and it needs a careful mutation.** Dropping `sorted` outright
returns a generator, which fails every row on its type and would prove nothing
about the order. Replacing it with `list` keeps the type and changes only the
sequence, and then exactly the two rows with more than one name in them go red.

## The census this rests on

`evidence/pipeline-0912-steps.log`, seven bodies through steps 1 to 3:

    AvatarSample_C     9 parts   removes Outfit_Bottom, Outfit_Shoes, Outfit_Top
    Vivi               9 parts   removes Outfit_Shoes, Outfit_Top
    Sendagaya_Shibu   11 parts   removes Outfit_AccessoryNeck, Outfit_Bottom, ...
    Darkness_Shibu     9 parts   removes Outfit_Shoes, Outfit_Top
    HairSample_Female  8 parts   removes Outfit_Shoes, Outfit_Top
    mika-pink         13 parts   removes exactly the original five
    vrm1-twist-sample  7 parts   removes Outfit_Bottom, Outfit_Shoes, Outfit_Top

Three of the seven have no lower garment, and one carries a garment name that was
not in the written-down list. Under R1 each of those is a refusal rather than a
dressed body. (The part counts are higher than when this table was first written
because stage 2b started naming `Hair_Side_L` and `Hair_Side_R` on these bodies;
the drop lists are unchanged, and `vrm1-twist-sample` is the body 2b added.)
