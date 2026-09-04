"""The whole build, start to finish, so the result is reproducible.

Order is not arbitrary. Proportion runs before anything is attached, because
accessories bound to the head joint would otherwise sit at the old scale.
Stripping runs before proportion so the discarded VRoid garments never get
rescaled. And the skeleton is checked after every stage, not once at the end:
knowing WHICH step moved a bone is the difference between a fix and a rebuild.

The outfit has to be taken off twice. VRoid ships one half as meshes and paints
the other half straight into the body's skin texture, so deleting the garment
primitives leaves a black bodice and a studded choker printed on the skin.

Step 0 runs Blender. It was a manual command for one round and that round cost
an hour: the ribbon scripts were edited, the build was re-run, and the model
came back identical because build.py reads the exported .glb and the .glb was
still the old one. Nothing failed and nothing warned -- weld.part() returns None
for a missing file on purpose, so a machine without Blender can still build, and
a stale file is even quieter than a missing one. It belongs in the pipeline.

Inputs that live outside this directory, because every one of them degrades the
build silently rather than failing it:

  blender                on PATH. Missing, step 0 reuses out/blender/*.glb and
                         says so; the head, ribbons and outfit are then whatever
                         the last run left.
  ~/Downloads/MellowHeart_Dream1.05
                         the purchased outfit, path in blender/mellow.py.
  ~/vtuber-kit/bin       vrmrig.py, the skeleton comparison every gate calls.
  public/avatar/mika-pink.vrm
                         baseline.vrm is a byte-identical copy of it; it is the
                         model being modified and the baseline compare() runs
                         against.
  public/avatar/animations/*.vrma
                         the ten clips retarget, motion and envelope sweep.
  ~/milfy-refs           the 18 reference images measure.py and compare_sheet.py
                         sample. Only those two need it.
"""
import contextlib
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '/Users/charles/vtuber-kit/bin')

import build as build_mod  # noqa: E402
import customise  # noqa: E402
import partition  # noqa: E402
import proportion  # noqa: E402
import skin  # noqa: E402
import verify  # noqa: E402
import vrmrig  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'out')
BASELINE = os.path.join(BASE, 'baseline.vrm')

# Acc_HairClip_Base is the base model's own fringe clips, the crossed bars and
# the outlined stars, which are painted decals on their own primitives rather
# than accessory geometry. The fringe they sit on is kept: cutting a
# replacement off the face surface, which is what an earlier version did, gives
# a smooth 178-triangle shell that renders as a swim cap, and the VRoid fringe
# is real hair with strand shading that the hue pass recolours with the rest.
DROP = ['Outfit_Top', 'Outfit_Bottom', 'Outfit_Shoes', 'Acc_HairOrnament',
        'Acc_HairClip_Base']
HEAD_FACTOR = 1.06

# The geometry authored in Blender rather than by formula: ribbons and bows,
# which are flat strips following a path and were unconvincing as swept rings.
BLENDER_STEMS = ['bow', 'neckribbon', 'hairbow', 'details', 'head']
# The imported outfit, converted by the same Blender step so that editing
# mellow.py cannot leave a stale .glb behind. Leaving bow.py out of this
# list once cost a full rebuild that produced a byte-identical model and no
# warning, because a missing part is skipped by design and a stale one is
# quieter still.
MELLOW_SETS = ['inner', 'outer']
BLENDER = shutil.which('blender')
# The file name the site loads (avatarVariants.ts). Bump it with every byte
# change: /avatar/* is served cache-immutable. -3: 2026-09-04, the twintails
# hang outside the cardigan; -4: same day, proportion scales the face's morph
# deltas with the head, so the >< eyes clear the skin again; -5: same day,
# blonde hair with its own shade tone, and the hair-coloured paint in both skin
# atlases (cap edge, nape strips) no longer ships violet; -6: same week, the
# twintail normal transform used the wrong Jacobian in the tie/scalp
# transition band, folding the MToon outline shell into a dark gap that only
# showed once the tail was mid-swing; -7: same week, -6 only fixed that one
# band -- a per-vertex analytic normal has no way to represent a curtain
# rolling into a round bundle (up to 90 degrees of turn between neighbours
# near the seam), so it was still folding the outline elsewhere along both
# tails. Normals are now read off the deformed triangles themselves
# (twintail.smooth_normals), which cannot disagree with the surface that is
# actually there; -8: same week, -7's smooth_normals weighted each adjacent
# triangle by area, which let a thin "seam" triangle at the tube's pinch
# points (small angle at the vertex, but an area comparable to its
# well-formed neighbours because its far edge is long) pull the vertex
# normal towards its own face nearly as hard as either neighbour -- a
# bright, hard-edged "bump" at exactly the two sites -7 had just fixed.
# Weighting by the angle each triangle actually subtends at the vertex
# (Max 1999) instead of by area helps but does not fix it -- measured on -8,
# the worst normal-field creases (up to ~80 degrees between triangle-adjacent
# vertices) barely move between area- and angle-weighting, because they are
# not a normal-averaging artefact at all. `free` in twintail.apply() -- how
# much a vertex is pulled off the scalp into the tail -- comes from a raw
# nearest-neighbour query against the scalp mesh, which has no notion of
# mesh adjacency: two vertices ~15mm apart on the SAME strand can land at
# free=0.00 and free=0.63, both individually correct, and the position blend
# downstream then places them tens of centimetres apart -- a real fold in
# the geometry, which is why no normal scheme could hide it. -8's fix was
# real (it does reduce error elsewhere) but was answering the wrong
# question for this bug. -9: `free` is smoothed across the mesh's own
# triangle adjacency (twintail.smooth_scalar) before it drives the position
# blend, the same move smooth_normals already made for normals. -10: same
# week, the loop-shaped Hair_Ahoge strand at the crown dropped on request; and
# -9's smoothed `free` turned out to leak into twintail.apply()'s skin weight
# too (it drives both), so a vertex whose OWN scalp distance says "on the
# scalp" could still inherit a slice of its tail-bound neighbour's weight
# (measured: 130 vertices, up to 28%) -- invisible at rest, but exactly the
# "8.4% weight -> 14mm drift" failure appearance_test.py's
# test_scalp_layer_carries_no_tail_weight was written against. Fixed by
# keeping the smoothed value for position/normal (still needed for -9's
# crease fix) and only forcing weight to zero on vertices whose OWN raw,
# unsmoothed distance is inside SCALP_GAP -- everywhere outside that line
# still takes the smoothed weight, which matters: forcing every vertex to its
# raw value re-opened the same kind of mesh-adjacency jaggedness -9 had just
# fixed, now in the weight field instead of the position field (measured via
# a synthetic tail-bone swing, up to 12% of frame pixels changed vs. the
# leak; clamping only the exact on_skull set brought that to ~3%, concentrated
# on ordinary strand-edge antialiasing rather than a visible tear).
SHIPPED = 'mika-milfy-10.vrm'


@contextlib.contextmanager
def step(title):
    """Announce a step and say afterwards what it cost.

    The goal asks for per-step timing and the honest place to measure it is
    here, around the real call, rather than by parsing this script's own output
    from somewhere else -- that version reported every step as taking no time,
    because there was nothing to parse.
    """
    print(title)
    start = time.time()
    yield
    print(f'   ({time.time() - start:.1f}s)')


def gate(label, path):
    diffs = vrmrig.compare(vrmrig.read(BASELINE), vrmrig.read(path))
    bones = len(vrmrig.human_bones(vrmrig.read(path)))
    print(f'  gate {label}: compare={diffs} bones={bones}')
    if diffs or bones != 54:
        raise SystemExit(f'{label} 動到骨架了')


def main():
    p = lambda n: os.path.join(OUT, n)

    with step('0. Blender geometry'):
        if BLENDER is None:
            print('   找不到 blender，沿用 out/blender 既有的 .glb')
        else:
            os.makedirs(p('blender'), exist_ok=True)
            for stem in BLENDER_STEMS:
                subprocess.run([BLENDER, '-b', '--python',
                                os.path.join(BASE, 'blender', f'{stem}.py'),
                                '--', p(os.path.join('blender', f'{stem}.glb'))],
                               cwd=BASE, check=True, capture_output=True)
            for which in MELLOW_SETS:
                out = 'mellow.glb' if which == 'inner' else f'mellow_{which}.glb'
                subprocess.run([BLENDER, '-b', '--python',
                                os.path.join(BASE, 'blender', 'mellow.py'),
                                '--', which, p(os.path.join('blender', out))],
                               cwd=BASE, check=True, capture_output=True)
            print(f'   {len(BLENDER_STEMS)} 個部件 + '
                  f'{len(MELLOW_SETS)} 組匯入服裝重新輸出')

    with step('1. partition'):
        m, _ = partition.partition(BASELINE, p('parted.vrm'), p('parts.json'))
        print(f'   {len(m["parts"])} parts')
        gate('partition', p('parted.vrm'))

    with step('2. strip the VRoid outfit'):
        r = customise.apply(p('parted.vrm'), p('stripped.vrm'), p('parts.json'),
                            drop=DROP, manifest_out=p('parts.json'))
        print(f'   removed {r["primitives_removed"]} primitives, '
              f'{r["accessors_dropped"]} accessors swept')
        # The strip strands the VRoid outfit's own materials, and apply now
        # clears them here rather than leaving them for build.py's sweep at the
        # end. Printed because the count moving between the two steps is the
        # only visible sign of that, and a silent zero here would read as
        # "nothing was stranded" rather than "this step no longer looks".
        if r['materials_dropped']:
            print(f'   swept {len(r["materials_dropped"])} stranded materials: '
                  f'{", ".join(r["materials_dropped"])}')
        gate('strip', p('stripped.vrm'))

    with step("3. strip the outfit VRoid PAINTED on the body"):
        share, _ = skin.apply(p('stripped.vrm'), p('bare.vrm'))
        print(f'   repainted {share * 100:.1f}% of the body texture as skin')
        gate('skin', p('bare.vrm'))

    with step('4. proportion'):
        before, _, _ = proportion.ratio(p('bare.vrm'))
        n, _ = proportion.apply(p('bare.vrm'), p('proportioned.vrm'), HEAD_FACTOR)
        after, lo, hi = proportion.ratio(p('proportioned.vrm'))
        print(f'   {before:.2f} -> {after:.2f} heads tall, height {hi - lo:.4f}, '
              f'{n} position/morph accessors rescaled')
        gate('proportion', p('proportioned.vrm'))

    with step('5. build the outfit'):
        added, size, lm = build_mod.build(p('proportioned.vrm'), p('mika-milfy.vrm'),
                                          p('parts.json'), p('mika-milfy.parts.json'))
        print(f'   +{len(added)} parts, {size} bytes, waist y={lm["waist"]:.3f}')
        gate('build', p('mika-milfy.vrm'))

    with step('6. health check'):
        ok, stats = verify.report(p('mika-milfy.vrm'), BASELINE)
        if not ok:
            raise SystemExit('健檢未過')

    # /avatar/* is served cache-immutable for a year, so a model whose bytes
    # changed has to arrive under a new name; the registry in
    # src/components/chat/avatarVariants.ts points at this one. -2: 2026-09-03,
    # the scalp, the shared skin solve and the neck band. -3: 2026-09-04, the
    # twintails hang outside the cardigan and collide with it (twintail.py).
    # -4: same day, proportion scales the face's morph deltas with the head so
    # the >< eyes clear the skin (proportion.py). -5: same day, blonde hair with
    # a shade tone; cap edge and nape strips recoloured (customise.py).
    dest = os.path.join(BASE, '..', '..', 'public', 'avatar', SHIPPED)
    shutil.copy(p('mika-milfy.vrm'), dest)
    shutil.copy(p('mika-milfy.parts.json'),
                os.path.join(BASE, '..', '..', 'public', 'avatar',
                             SHIPPED.replace('.vrm', '.parts.json')))
    print(f'\nshipped {os.path.normpath(dest)}')

    subprocess.run([sys.executable, 'render.py', p('mika-milfy.vrm'), p('final')],
                   cwd=BASE, check=True)


if __name__ == '__main__':
    main()
