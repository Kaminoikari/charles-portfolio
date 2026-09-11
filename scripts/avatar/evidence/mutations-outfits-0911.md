# Every defence of the outfit contract, mutated one at a time

Seven mutations on 2026-09-11, against commit `8de2d67`. Runner:
`mutations-outfits-0911.py`, handed both committed blobs, refusing to start
unless both working files equal them, each pattern asserted to hit exactly once,
each restore asserted byte-for-byte.

Two files rather than one, because one defence lives in the contract itself: the
FIT banner marking the five values that are this package on this body. A
mutation that deletes it has to be able to reach it.

| id | defence broken | file | verdict |
|---|---|---|---|
| O1 | build.py declares the package's colours of its own again | build.py | RED |
| O2 | build.py imports one package's value by name | build.py | RED |
| O3 | `outfit_files` names the two garment files itself | build.py | RED |
| O4 | the imported outfit is coloured from mellowheart directly | build.py | RED |
| O5 | a clearance is written back into `build()` | build.py | RED |
| O6 | the FIT banner is dropped from the contract | mellowheart.py | RED |
| O7 | the bonemap path forgets it moved a directory deeper | mellowheart.py | RED |

O4 is the one worth naming. It does not type a value in; it reads the right
value off the wrong thing, `mellowheart.TINT` instead of `outfit_pack.TINT`, so
the build still produces exactly today's bytes and every behaviour test stays
green. What catches it is that the contract's argument stops being read, which
is why `every value in the contract is read somewhere` exists alongside the
wiring assertions.

O7 would not fail at import either. A bonemap path that does not resolve makes
the cardigan fit on fourteen anchors instead of ten, silently, at build time.
