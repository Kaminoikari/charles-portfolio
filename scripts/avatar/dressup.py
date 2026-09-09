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
  AND ONLY THOSE    that the manifest calls a garment. Re-homing means giving a
                    limb's hold on free-hanging cloth back to the joint the limb
                    hangs from, and skin does not hang off the body: a torn
                    `Body_Skin` is a defect of the body itself and refit would
                    quietly rewrite the pool it is measuring against. Anything
                    torn that is not a garment stops the run and is named.
  AND THEN          the same check runs again on what was written. refit is a
                    fade over a ramp, not a proof; a garment whose weights hand
                    over WHILE it is still on the body has nothing to shed. The
                    file refit wrote is deleted before the raise, because a
                    still-torn model left at the output path is exactly what a
                    caller that checks for the file rather than the exit code
                    would pick up.

AND AFTER ALL THAT, cover.trim cuts the body the clothes cover. It runs second
because refit reads the skin as its body pool, and a pool with fresh holes in it
reports cloth as further from the body than it is. What that step is for, and
why its two guards pull against each other, is in cover.py.

Not wired into make.py on purpose. That pipeline builds Milfy from a base body
and every garment in it is authored here, bound by binding.py, and gated at step
6; it has never produced this defect and has no import step to attach to. This
is the entry for a body that arrives already dressed.
"""
import glob
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cover  # noqa: E402
import glb  # noqa: E402
import motion  # noqa: E402
import pierce  # noqa: E402
import refit  # noqa: E402
import verify  # noqa: E402

CLIPS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     '..', '..', 'public', 'avatar', 'animations', '*.vrma')


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


def garment_primitives(manifest):
    """The (mesh, primitive) pairs the manifest calls cloth, in its own order.

    The same prefixes pierce.count scores, so the set refit is allowed to rewrite
    is the set the clipping gate holds to a limit.
    """
    parts = json.load(open(manifest))['parts']
    return tuple((info['mesh'], index) for name, info in parts.items()
                 if name.startswith(('Outfit_', 'Acc_'))
                 for index in info['primitives'])


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

    cloth = set(garment_primitives(manifest))
    stray = tuple(pair for pair in torn if pair not in cloth)
    if stray:
        raise SystemExit(
            f'{src} tears at {[f"{m}[{p}]" for m, p in stray]}, which the manifest '
            'does not call a garment: re-homing gives a limb\'s hold on free-hanging '
            'cloth back to the joint the limb hangs from, and nothing here hangs')

    report = refit.apply(src, dst, torn, body_primitives(manifest), **kw)
    left = verify.torn_bindings(dst, limit, bends)
    if left:
        worst = max(left, key=lambda row: row[4])
        # Deleted, not left behind: refit writes the file before this runs, and a
        # still-torn model at the output path is what a caller that looks for the
        # file rather than the exit code would go on to measure.
        os.remove(dst)
        raise SystemExit(
            f'{dst} still tears after re-homing {[f"{m}[{p}]" for m, p in torn]}: '
            f'{worst[0]}[{worst[1]}] grows an edge {worst[4]:.2f}mm when '
            f'{worst[2]} turns {worst[3]}° (limit {limit}mm); nothing was written')
    return {**report, 'torn': torn}


def prepare(src, dst, manifest, clips=None, samples=4, rounds=12, **kw):
    """Everything a fresh export goes through, in the order it has to happen.

    Weights first, geometry second, and not the other way round. refit measures
    how far each piece of cloth has shed from the body, and the body it measures
    against is the manifest's skin; cutting the skin the clothes cover before
    that would hand it a pool with new holes in it and a shed field read off
    them. cover.trim then runs on the repaired file, against the same frames the
    clipping gate will score it on, so the cut is judged on what the gate
    checks rather than on a pose nobody plays.
    """
    clips = sorted(glob.glob(CLIPS)) if clips is None else list(clips)
    with tempfile.TemporaryDirectory() as tmp:
        fixed = os.path.join(tmp, 'refit.vrm')
        repaired = repair(src, fixed, manifest, **kw)
        doc, binary = glb.load(fixed)
        poses = [None] + [rot for _, _, rot in
                          motion.sample_poses(doc, clips, samples)]
        trimmed = cover.trim(fixed, dst, manifest, poses=tuple(poses),
                             rounds=rounds)
    if not trimmed['converged']:
        # Left in place rather than deleted: unlike a still-torn model, a model
        # that ran out of rounds is a usable file with a known residue, and the
        # rounds it got through are in the report. Refusing to say so is what
        # would be wrong.
        raise SystemExit(
            f'{dst} still loses pixels after {rounds} rounds of trimming: '
            f'{trimmed["rounds"][-1]["lost"]} left; the cut is in the report')
    return {**trimmed, 'refit': repaired}


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('dressup.py <export.vrm> <repaired.vrm> <parts.json>')
    print(prepare(sys.argv[1], sys.argv[2], sys.argv[3]))
