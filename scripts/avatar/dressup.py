"""Repair a VRoid Studio dress-up export before anything else reads it.

WHY THIS EXISTS. refit.py is the repair; this is the step that decides what to
hand it. The distinction matters because of how the defect arrives. Studio's
auto-fit gives every garment vertex the skin weights of the body vertex nearest
to it, so an oversized top that flares into the space beside the ribs takes a
handover between chest and upper arm across one edge, and a raised arm drags the
whole flank up with the humerus (evidence/refit-0909.md: a 49.8mm edge pulled to
96.3mm, 46.48mm of growth against a 25mm limit). Nothing in the .xroid records
the repair. Re-export the project and the tear is back, byte for byte, and every
gate that looks at the T-pose still passes.

So the repair cannot be a command somebody remembers. It has to be the step a
fresh export goes through, and it has to work out for itself what to repair:

  WHICH PRIMITIVES  are the ones verify.torn_bindings names on THIS file, not a
                    list of mesh names typed once. A re-export that flares a
                    different garment, or renames `Tops.baked`, is repaired the
                    same way; one that tears nothing is copied through.
  WHICH BODY        is the manifest's skin, read through pierce.skin_parts, so
                    the pool is the same set the clipping gate calls skin. An
                    auto-masked export is full of holes exactly where a garment
                    covers it, and a pool with holes reads the cloth as further
                    from the body than it is -- which is the one input refit
                    cannot recover from, because the shed field is that distance.
  AND THEN          the same check runs again on what was written. refit is a
                    fade over a ramp, not a proof; a garment whose weights hand
                    over WHILE it is still on the body has nothing to shed, and
                    the honest answer there is to refuse rather than to write a
                    file that has been through a step called repair.

Not wired into make.py on purpose. That pipeline builds Milfy from a base body
and every garment in it is authored here, bound by binding.py, and gated at step
6; it has never produced this defect and has no import step to attach to. This
is the entry for a body that arrives already dressed.
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pierce  # noqa: E402
import refit  # noqa: E402
import verify  # noqa: E402


def torn_cloth(path, limit=verify.BIND_GROWTH_MAX_MM, bends=verify.BIND_BENDS):
    """The (mesh, primitive) pairs whose bindings tear, each named once.

    torn_bindings reports one row per bend, so a primitive that tears when the
    left arm rises and again when it drops is two rows and one primitive. Handing
    the duplicate to refit would rewrite the same accessors twice, and the second
    pass would read the weights the first one wrote.
    """
    return tuple(dict.fromkeys((mesh, prim) for mesh, prim, _, _, _
                               in verify.torn_bindings(path, limit, bends)))


def body_primitives(manifest):
    """The (mesh, primitive) pairs of the manifest's skin, in the manifest's order."""
    parts = json.load(open(manifest))['parts']
    return tuple((parts[name]['mesh'], index)
                 for name in pierce.skin_parts(parts)
                 for index in parts[name]['primitives'])


def repair(src, dst, manifest, limit=verify.BIND_GROWTH_MAX_MM,
           bends=verify.BIND_BENDS, **kw):
    """Re-home whatever tears in `src` and write the result to `dst`.

    Raises rather than returning if the file still tears afterwards; `kw` goes
    to refit.apply, whose defaults are the ones measured on the 2026-09-09
    export.
    """
    torn = torn_cloth(src, limit, bends)
    if not torn:
        shutil.copyfile(src, dst)
        return {'path': dst, 'torn': (), 'rehomed': [], 'bytes': os.path.getsize(dst)}

    report = refit.apply(src, dst, torn, body_primitives(manifest), **kw)
    left = verify.torn_bindings(dst, limit, bends)
    if left:
        worst = max(left, key=lambda row: row[4])
        raise SystemExit(
            f'{dst} still tears after re-homing {[f"{m}[{p}]" for m, p in torn]}: '
            f'{worst[0]}[{worst[1]}] grows an edge {worst[4]:.2f}mm when '
            f'{worst[2]} turns {worst[3]}° (limit {limit}mm)')
    return {**report, 'torn': torn}


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('dressup.py <export.vrm> <repaired.vrm> <parts.json>')
    print(repair(sys.argv[1], sys.argv[2], sys.argv[3]))
