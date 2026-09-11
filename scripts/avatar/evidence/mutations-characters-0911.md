# Mutating the character contract, one defence at a time

Runner: `scripts/avatar/evidence/mutations-characters-0911.py`, handed the
committed blobs of `build.py` and `characters/mika.py`. It refuses to start unless the working copies
already equal them, asserts each pattern hits exactly once, and asserts the
restore byte-for-byte. Raw output in `mutations-characters-0911.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit, which is how two earlier versions
of this file came to name a blob that no longer existed):

    build.py               774691cd843a3b8d28e0ec2ff0d973bd3b068108
    mika.py                82ca02d29d1a480e3826d7ba61d624a0bfcecb11

Baseline: 18 tests, green.

C10 is the only one that lives in the contract rather than in build.py: it
points a role at a material name the character does not have, which is what
adding a role and forgetting the palette entry would look like.

| # | what the mutation puts back | file | result |
|---|---|---|---|
| C1 | build.py declares a palette of its own beside the contract | `build.py` | **RED** |
| C2 | build.py imports one character's value by name | `build.py` | **RED** |
| C3 | add_material defaults the colours it is supposed to be handed | `build.py` | **RED** |
| C4 | outline_colour reads Mika's line value instead of the character's | `build.py` | **RED** |
| C5 | the imported outfit is dressed by an unbound callback again | `build.py` | **RED** |
| C6 | bowl_texture checks against a written-down mean again | `build.py` | **RED** |
| C7 | build() reads Mika directly and ignores the character it was handed | `build.py` | **RED** |
| C8 | build.py spells one of her material names again | `build.py` | **RED** |
| C9 | the manifest advertises only the two prefixes this build knew about | `build.py` | **RED** |
| C10 | a role points at a material the character does not have | `mika.py` | **RED** |

10 of 10 red. A STILL GREEN row would mean that defence is not
tested by anything, which is the only result this table exists to catch.
