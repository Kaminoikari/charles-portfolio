# Mutating the material-grammar partition, one defence at a time

Runner: `scripts/avatar/evidence/mutations-partition-0912.py`, handed the
committed blobs of `partition.py` and `gate_test.py`. It refuses to start
unless the working copies already equal them, asserts each pattern hits exactly
once, asserts the restore byte-for-byte, and clears `__pycache__` before every
run so two same-length mutations landing in the same second cannot be answered
from the previous one's bytecode. Raw output in
`mutations-partition-0912.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit, which is how two earlier receipts
in this directory came to name a blob that no longer existed):

    partition.py           205feecf3a22ef7ec06c0075aa9bced89e8bfce7
    gate_test.py           225a44423793cc0b6751edd5b9f1ffdff2b3d3cd

Baseline: 50 tests, green. The loader collects 50 as well, so nothing after
`unittest.main()` is going unrun (memory:
project_test_entry_guard_silently_skips).

First run at `31b1448` / `a056131`, and re-run here against the blobs stages 2b
and the review fix left behind, because a table pinned to a superseded blob
cannot be re-run and so proves nothing about the code that ships. Two rows lost
their anchor and were re-aimed at the same two defences: P1's `BODY_MESH` branch
is gone, so the index table it restores is now applied inside the loop that
names by material, and P6's single refusal became two, so silencing the check
means emptying both lists. The other eight patterns still hit exactly once.

P9 is the only one that lives in the test rather than in partition.py: it
points the foreign-body fixture back at the body this step was written for,
which is what writing these tests against `mika-pink.vrm` would have looked
like. Two of them stay green under every other mutation in that case, because
the shipped body has no garment out of order and no hair in its body mesh.

| # | what the mutation puts back | file | result |
|---|---|---|---|
| P1 | the body's parts come from primitive index again | `partition.py` | **RED** |
| P2 | the category has to be the final segment | `partition.py` | **RED** |
| P3 | a dress-up export's decorated name is read as written | `partition.py` | **RED** |
| P4 | a garment nobody here has seen is filed under the nearest known one | `partition.py` | **RED** |
| P5 | back hair baked into the body mesh takes the hair mesh's name | `partition.py` | **RED** |
| P6 | recognise stops looking at what the body materials are called | `partition.py` | **RED** |
| P7 | a second mesh may claim a part name the first already has | `partition.py` | **RED** |
| P8 | the shipped body is renamed along with everybody else | `partition.py` | **RED** |
| P9 | the foreign body under test is the one this step was written for | `gate_test.py` | **RED** |
| P10 | the bounds check for the second pass is the first pass's | `partition.py` | **RED** |

10 of 10 red. A STILL GREEN row would mean that defence is not tested by
anything, which is the only result this table exists to catch.

## Two that shadow each other, and do not

P4 and P8 both trip `test_the_shipped_body_keeps_the_labels_the_index_table_gave`,
so it is worth saying why they are two defences and not one. P8 empties
`OUTFIT_NAMES`, and the fallback then spells VRoid's plural into the shipped
body's parts: `Outfit_Tops`. P4 keeps the table and breaks the fallback, so a
garment the table does not list is filed under `Outfit_Top` instead of keeping
the exporter's word. Each has a test the other leaves green: P8 leaves
`test_a_garment_this_pipeline_has_never_seen_keeps_vroids_word` green (the
fallback still answers `Outfit_AccessoryNeck`), and P4 leaves nothing about
Tops or Bottoms wrong on any body that has both.
