# Mutating the outfit contract, one defence at a time

Runner: `scripts/avatar/evidence/mutations-outfits-0911.py`, handed the
committed blobs of `build.py` and `outfits/mellowheart.py`. It refuses to start unless the working copies
already equal them, asserts each pattern hits exactly once, and asserts the
restore byte-for-byte. Raw output in `mutations-outfits-0911.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit, which is how two earlier versions
of this file came to name a blob that no longer existed):

    build.py               774691cd843a3b8d28e0ec2ff0d973bd3b068108
    mellowheart.py         74650e1679eb163c772c561c70705ef7fa618bed

Baseline: 14 tests, green.

O9 and O10 live in the contract. O10 is the one that guards a literal this
refactor deliberately left alone: outfit.py still spells the `Mellow_` prefix
in three places, which is outside this contract's scope, so a test pins the
two together and this mutation is what proves the pin holds.


| # | what the mutation puts back | file | result |
|---|---|---|---|
| O1 | build.py declares the package's colours of its own again | `build.py` | **RED** |
| O2 | build.py imports one package's value by name | `build.py` | **RED** |
| O3 | outfit_files names the two garment files itself | `build.py` | **RED** |
| O4 | the imported outfit is coloured from mellowheart directly | `build.py` | **RED** |
| O5 | a clearance is written back into build() | `build.py` | **RED** |
| O6 | the FIT banner is dropped from the contract | `mellowheart.py` | **RED** |
| O8 | the vendor mesh name is typed back into build() | `build.py` | **RED** |
| O9 | the contract claims a thigh band the package has no part for | `mellowheart.py` | **RED** |
| O10 | the importer stamps a prefix the contract does not declare | `mellowheart.py` | **RED** |
| O7 | the bonemap path forgets it moved a directory deeper | `mellowheart.py` | **RED** |

10 of 10 red. A STILL GREEN row would mean that defence is not
tested by anything, which is the only result this table exists to catch.
