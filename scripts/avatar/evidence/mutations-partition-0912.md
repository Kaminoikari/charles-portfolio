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

    partition.py           d78714d89162ef4675d8b50197c22115f7bf51cd
    gate_test.py           4a61cd6926441696ef1d5615fdf189844c41d2d8

Baseline: 61 tests, green. The loader collects 61 as well, so nothing after
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
| P7 | two claims may end up with the same part name, and the second wins in silence | `partition.py` | **RED** |
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

## P7 after the rename

P7 mutates the line that refuses a part name arriving twice. When it was
written that meant two meshes reading one name out of the grammar, which was a
refusal; `resolve_clashes` now renames instead, so the same line catches a
resolver that answered wrongly. Same position, different reason to be there,
and C7 in `mutations-clashes-0912.md` aims at it from that side with a test
that stubs the resolver. P7 keeps its place because stage 0 put it there.
