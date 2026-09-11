# Every defence of the character contract, mutated one at a time

Seven mutations on 2026-09-11, against commit `613a23c`. The runner is
`mutations-characters-0911.py`: it is handed the committed blob, refuses to
start unless the working file already equals it, writes back the exact bytes it
read, and asserts the restore byte-for-byte. Each mutation's pattern must hit
exactly once or the run aborts, so a mutation that silently fails to land cannot
be reported as a defence holding.

| id | defence broken | verdict | which test fires |
|---|---|---|---|
| C1 | build.py declares a palette of its own beside the contract | RED | `declares none of the characters values` |
| C2 | build.py imports one character's value by name | RED | `does not import one characters values by name` |
| C3 | `add_material` defaults the colours it is handed | RED | `cannot be made without saying whose it is`, `helpers take what they need` |
| C4 | `outline_colour` reads Mika's line value, not the character's | RED | `outline is her skins hue at her own line value`, `every value is read somewhere` |
| C5 | the imported outfit is dressed by an unbound callback | RED | `imported outfit is dressed by the same character` |
| C6 | `bowl_texture` checks against a written-down mean | RED | `bowl is baked to the brightness it is asked for` |
| C7 | `build()` reads Mika directly, ignoring its argument | RED | `palette is read off the character`, `every value is read somewhere` |

## C6 was GREEN on the first run, and why that mattered

The first pass had six RED and one STILL GREEN. Putting `0.90` back inside
`bowl_texture`'s binary search left the signature taking `mean` and the call site
passing `character.BOWL_MEAN`, so both positive wiring assertions held; the
negative one was looking for `< BOWL_MEAN:`, which is not the shape the mutation
produces. A function may accept a parameter and ignore it, and a wiring test
that reads the signature and the call site sees none of that.

The replacement asks the function what it produced rather than how it is
spelled: two different means have to come back as two different textures, each
within a quantisation step of what was asked for. That test is C6's RED above.
