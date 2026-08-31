"""Drive the model with the real .vrma clips and check the clothes survive.

A synthetic pose is a guess about what the clips do. These are the clips the
site actually plays, so the garments get tested against the rotations they will
really see, at frames sampled across the whole clip rather than at rest.

A .vrma is a glTF whose VRMC_vrm_animation extension maps humanoid bone names to
its own node indices. Those names are the bridge: the clip says "leftUpperArm
turns like this", and we look up which node that is in OUR file. The rotation
itself does not survive the trip unchanged, and retarget() is where that is
dealt with.
"""
import glob
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '/Users/charles/vtuber-kit/bin')

import glb  # noqa: E402
import pierce  # noqa: E402
import pose as pose_mod  # noqa: E402

IDENT = np.array([0.0, 0.0, 0.0, 1.0])

# A half turn about Y. A .vrma carries VRMC_vrm_animation, a VRM 1.0 extension,
# and VRM 1.0 faces +Z; this model is VRM 0.x, which faces -Z. Measured, not
# assumed: at rest the clip's left arm runs along +X and ours along -X, and its
# toes point the opposite way down Z.
YAW = np.array([0.0, 1.0, 0.0, 0.0])


def qmul(a, b):
    """Hamilton product of two xyzw quaternions."""
    x1, y1, z1, w1 = a
    x2, y2, z2, w2 = b
    return np.array([
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    ])


def qconj(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def node_parents(doc):
    par = {}
    for i, n in enumerate(doc['nodes']):
        for c in n.get('children', ()):
            par[c] = i
    return par


def tree_order(doc, par):
    """Node indices with every parent ahead of its children."""
    order, seen = [], set()

    def walk(i):
        if i in seen:
            return
        p = par.get(i)
        if p is not None:
            walk(p)
        seen.add(i)
        order.append(i)

    for i in range(len(doc['nodes'])):
        walk(i)
    return order


def globals_of(doc, par, order, local=None):
    """node -> rotation accumulated from the scene root.

    `local` overrides a node's own rotation, which is how a posed skeleton and a
    resting one are read with the same code. Accumulating matters: a glTF
    rotation is relative to the immediate parent, so a bone six joints down an
    arm inherits every rotation above it.
    """
    out = {}
    for i in order:
        q = (local or {}).get(i)
        if q is None:
            q = np.array(doc['nodes'][i].get('rotation', [0, 0, 0, 1]), dtype=np.float64)
        p = par.get(i)
        out[i] = q if p is None else qmul(out[p], q)
    return out


def sample_locals(doc, views, at):
    """node -> its local rotation at time `at`, read off the clip's channels."""
    anim = doc['animations'][0]
    out, duration = {}, 0.0
    for ch in anim['channels']:
        if ch['target']['path'] != 'rotation':
            continue
        s = anim['samplers'][ch['sampler']]
        t = glb.read_accessor(doc, views, s['input']).ravel()
        v = glb.read_accessor(doc, views, s['output'])
        duration = max(duration, float(t.max()))
        i = int(np.clip(np.searchsorted(t, at) - 1, 0, len(t) - 2))
        span = t[i + 1] - t[i]
        f = 0.0 if span <= 0 else float((at - t[i]) / span)
        q = v[i] * (1 - f) + v[i + 1] * f
        n = np.linalg.norm(q)
        out[ch['target']['node']] = (q / n) if n else IDENT.copy()
    return out, duration


def retarget(path, at, model_doc):
    """humanoid bone name -> the local rotation to give OUR node at `at`.

    Retargeting, not copying, and this took three tries to get right, so the
    reasoning is worth keeping.

    What transfers between two rigs is how far a bone has turned away from its
    own rest, measured in the world. So for each bone take its animated rotation
    accumulated to the clip's root, cancel its rest rotation accumulated the same
    way, turn the result into our world, and lay it back onto our rest. Then walk
    our own tree to express that as a local rotation, because our parents have
    moved too.

    The three failures each skipped one of those steps. Writing the clip's value
    straight onto our node applied the clip's bind pose as well as its animation
    and put the head at hip height. Cancelling only the bone's OWN rest left the
    parent's frame wrong, and a squat came out as splayed legs. Cancelling the
    rest chain but reading the parent's rotation from the REST pose instead of
    the animated one left the legs nearly right and the arms 174 degrees out,
    because an arm hangs six joints below the hips and inherits all six.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bone_node = {k: v['node'] for k, v
                 in doc['extensions']['VRMC_vrm_animation']['humanoid']['humanBones'].items()}

    par = node_parents(doc)
    order = tree_order(doc, par)
    local, duration = sample_locals(doc, views, at)
    rest = globals_of(doc, par, order)
    posed = globals_of(doc, par, order, local)

    delta = {}
    for bone, n in bone_node.items():
        d = qmul(posed[n], qconj(rest[n]))
        delta[bone] = qmul(YAW, qmul(d, qconj(YAW)))

    mpar = node_parents(model_doc)
    morder = tree_order(model_doc, mpar)
    mrest = globals_of(model_doc, mpar, morder)
    mbone = {b['node']: b['bone'] for b
             in model_doc['extensions']['VRM']['humanoid']['humanBones']}

    world, out = {}, {}
    for i in morder:
        p = mpar.get(i)
        pg = world[p] if p is not None else IDENT
        bone = mbone.get(i)
        if bone in delta:
            target = qmul(delta[bone], mrest[i])
            world[i] = target
            out[bone] = qmul(qconj(pg), target)
        else:
            q = np.array(model_doc['nodes'][i].get('rotation', [0, 0, 0, 1]),
                         dtype=np.float64)
            world[i] = qmul(pg, q)
    return out, duration


def check(model, manifest, clips, samples=4, size=(360, 620)):
    """Per clip: how far its worst part went over its own limit, and where.

    A ratio rather than a raw count, because the limit is per part -- see
    pierce.limit. 1.00 is exactly at the limit.

    Pixels underneath, because that is what 穿模 means: the count comes from
    pierce.py, which draws the frame and asks where the body is in front of the
    cloth. The volume test in inside.py answered a different question and
    flagged linings and collar hollows that no viewer can see.
    """
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest))['parts']
    bones = pose_mod.bones(doc)

    rows, worst_overall = [], {}
    for clip in clips:
        name = os.path.basename(clip)
        _, dur = retarget(clip, 0.0, doc)
        worst, where = 0, None
        for k in range(samples):
            at = dur * (k + 0.5) / samples
            rot, _ = retarget(clip, at, doc)
            applied = {bones[b]: q for b, q in rot.items() if b in bones}
            r, a = pierce.count(doc, views, parts, posed=pose_mod.skinned(
                doc, views, applied, True), size=size, detail=True)
            for part, n in r.items():
                # Per part, keep the worst RATIO and the frame that produced it.
                # Keeping the worst pixel count instead and dividing it by the
                # largest area seen anywhere would compare two different frames:
                # the camera frames each pose to its own bounding box, so a
                # crouch draws every part half again as large, and the summary
                # would quote a limit that never applied to that count.
                over = n / max(pierce.limit(a.get(part, 0)), 1)
                if over > worst_overall.get(part, (0,))[0]:
                    worst_overall[part] = (over, n, pierce.limit(a.get(part, 0)),
                                           a.get(part, 0), name, round(at, 2))
                if over > worst:
                    worst, where = over, (round(at, 2), part, n)
        rows.append((name, worst, where))
    return rows, worst_overall


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    model = os.path.join(base, 'out', 'mika-milfy.vrm')
    mani = os.path.join(base, 'out', 'mika-milfy.parts.json')
    clips = sorted(glob.glob(os.path.join(base, '..', '..', 'public', 'avatar',
                                          'animations', '*.vrma')))
    # Each clip is scored by how far its worst part is over that part's own
    # limit; 1.00 is exactly at it. Calibration, all measured on this model at
    # rest: it renders clean in a close-up and nothing is over 0.09. Sinking a
    # garment 25mm into itself puts the bodice at 38, the socks at 20, the
    # skirt at 11 and the cardigan at 8. The boot is the one that mutation
    # cannot express -- sink a closed shoe and the foot swallows it, 0.15 --
    # so it is checked by shrinking it a tenth instead, which reads as a boot a
    # size too small and scores 2.83.
    rows, worst = check(model, mani, clips)
    print(f'GATE motion clips ({len(clips)} clips x 4 frames x 3 views, flag above '
          f'{pierce.ABSOLUTE} pixels of body showing through cloth, or {pierce.SHARE:.0%} of '
          f'that garment\'s own area, whichever is smaller)')
    ok = True
    for name, over, where in rows:
        flag = '' if over <= 1.0 else f'   <-- {where[1]} {where[2]}px at t={where[0]}s'
        ok &= over <= 1.0
        print(f'  {name:<22} worst {over:>5.2f} of limit{flag}')
    print('\n  worst per part across every clip and frame:')
    for part, (over, n, lim, ar, clip, at) in sorted(
            worst.items(), key=lambda kv: -kv[1][0]):
        if not n:
            continue
        print(f'    {part:<24} {n:>5} px  of {lim:>5.0f} allowed '
              f'({ar} px on screen)  {over:>5.2f}x  {clip} t={at}s')
    print(f'\n  {"PASS" if ok else "FAIL"}')
    sys.exit(0 if ok else 1)
