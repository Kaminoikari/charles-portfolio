"""Does the clip's pose survive the move onto our skeleton?

The two earlier attempts both produced a file that loaded and rendered, and both
were wrong: one applied the clip's bind pose on top of its animation, the other
removed each bone's own rest but not its parent's. Neither could be caught by
looking at the model alone, because a wrong pose is still a pose.

The discriminating observation is the clip's own skeleton. Pose it with its own
rotations, measure which way each limb points, and measure the same limb on our
retargeted model. Direction is what an animation means; bone lengths differ
between rigs and are allowed to. Agreement to a few degrees says the transfer is
faithful, and nothing else does.

Two rigs never agree exactly. Measured at rest, after the VRM1-to-VRM0 half
turn, these two disagree by up to 10 degrees at the ankle and about 5 elsewhere,
because our VRoid base rests in a slight A-pose where the clip rests square. The
retarget preserves the turn away from rest, so that standing disagreement rides
along and the threshold has to leave room for it.
"""
import glob
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import humanoid  # noqa: E402
import motion  # noqa: E402
import pose as pose_mod  # noqa: E402

# parent -> child pairs whose direction carries the pose
LIMBS = [
    ('leftUpperLeg', 'leftLowerLeg'), ('leftLowerLeg', 'leftFoot'),
    ('rightUpperLeg', 'rightLowerLeg'), ('rightLowerLeg', 'rightFoot'),
    ('leftUpperArm', 'leftLowerArm'), ('leftLowerArm', 'leftHand'),
    ('rightUpperArm', 'rightLowerArm'), ('rightLowerArm', 'rightHand'),
    ('spine', 'chest'), ('neck', 'head'),
]


def quat_matrix(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def clip_world(path, at, rest=False):
    """humanoid bone -> world position, posing the clip on its OWN skeleton."""
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bones = humanoid.animation_bones(doc)

    anim = doc['animations'][0]
    local = {}
    for ch in ([] if rest else anim['channels']):
        if ch['target']['path'] != 'rotation':
            continue
        s = anim['samplers'][ch['sampler']]
        t = glb.read_accessor(doc, views, s['input']).ravel()
        v = glb.read_accessor(doc, views, s['output'])
        i = int(np.clip(np.searchsorted(t, at) - 1, 0, len(t) - 2))
        span = t[i + 1] - t[i]
        f = 0.0 if span <= 0 else float((at - t[i]) / span)
        q = v[i] * (1 - f) + v[i + 1] * f
        n = np.linalg.norm(q)
        local[ch['target']['node']] = (q / n) if n else np.array([0.0, 0, 0, 1.0])

    par = motion.node_parents(doc)
    world = {}

    def walk(i):
        if i in world:
            return world[i]
        n = doc['nodes'][i]
        q = local.get(i, np.array(n.get('rotation', [0, 0, 0, 1]), dtype=np.float64))
        t = np.array(n.get('translation', [0, 0, 0]), dtype=np.float64)
        m = np.eye(4)
        m[:3, :3] = quat_matrix(q)
        m[:3, 3] = t
        p = par.get(i)
        world[i] = m if p is None else walk(p) @ m
        return world[i]

    return {b: walk(n)[:3, 3] for b, n in bones.items()}


def rest_gap(model, clip):
    """limb -> the angle the two rigs already disagree by while standing still.

    This is the number the animated frames have to be judged against. A fixed
    threshold would either fail the head, which stands 9.9 degrees apart before
    anything moves, or pass a real retarget error hiding under it.
    """
    doc, _ = glb.load(model)
    bones = pose_mod.bones(doc)
    mine = pose_mod.joint_matrices(doc, {}, replace=True)
    ref = clip_world(clip, -1.0, rest=True)
    out = {}
    for a, b in LIMBS:
        out[(a, b)] = angle(mine[bones[b]][:3, 3] - mine[bones[a]][:3, 3],
                            ref[b] - ref[a])
    return out


def angle(u, v):
    """Between our direction and the clip's, brought into our world.

    The clip is VRM 1.0 and faces +Z; this model is VRM 0.x and faces -Z, so the
    reference turns a half turn about Y before the two can be compared at all.
    """
    v = v * np.array([-1.0, 1.0, -1.0])
    nu, nv = np.linalg.norm(u), np.linalg.norm(v)
    if nu < 1e-6 or nv < 1e-6:
        return 0.0
    return float(np.degrees(np.arccos(np.clip(u @ v / (nu * nv), -1, 1))))


def compare(model, clips, samples=4):
    doc, binary = glb.load(model)
    bones = pose_mod.bones(doc)
    rows = []
    for clip in clips:
        gap = rest_gap(model, clip)
        _, dur = motion.retarget(clip, 0.0, doc)
        worst, where = -180.0, None
        for k in range(samples):
            at = dur * (k + 0.5) / samples
            rot, _ = motion.retarget(clip, at, doc)
            applied = {bones[b]: q for b, q in rot.items() if b in bones}
            mine = pose_mod.joint_matrices(doc, applied, replace=True)
            ref = clip_world(clip, at)
            for a, b in LIMBS:
                if a not in bones or b not in bones or a not in ref or b not in ref:
                    continue
                u = mine[bones[b]][:3, 3] - mine[bones[a]][:3, 3]
                excess = angle(u, ref[b] - ref[a]) - gap[(a, b)]
                if excess > worst:
                    worst, where = excess, (b, round(at, 2))
        rows.append((os.path.basename(clip), worst, where))
    return rows


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    model = os.path.join(base, 'out', 'mika-milfy.vrm')
    clips = sorted(glob.glob(os.path.join(base, '..', '..', 'public', 'avatar',
                                          'animations', '*.vrma')))
    limit = 3.0
    rows = compare(model, clips)
    print(f'GATE retarget fidelity ({len(clips)} clips x 4 frames x {len(LIMBS)} limbs, '
          f'flag above {limit} degrees on top of the rest gap)')
    ok = True
    for name, ang, where in rows:
        ok &= ang <= limit
        tail = '' if ang <= limit else f'   <-- {where[0]} at t={where[1]}s'
        print(f'  {name:<22} worst {ang:>+6.2f} deg{tail}')
    print(f'\n  {"PASS" if ok else "FAIL"}')
    sys.exit(0 if ok else 1)
