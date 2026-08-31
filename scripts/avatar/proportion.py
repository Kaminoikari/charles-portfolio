"""Shift the head-to-body ratio without moving a single bone.

The reference reads younger than the VRoid base, and almost all of that is one
number: how tall the head is against the whole figure. This scales the head
about the chin and compresses what is below it by the matching amount, so the
overall height is unchanged and the feet stay on the floor.

Bones are untouched on purpose. Moving them would invalidate the clearance
numbers the ten motion clips were measured against, and vrmrig.compare() would
reject the file — which is the check, not an inconvenience. The head bone
therefore stays where it was, and every accessory bound to it must be attached
AFTER this runs, or it will sit at the old scale.
"""
import sys

import numpy as np

import glb

CHIN_Y = 1.272        # where the jaw meets the neck on this body
FOOT_Y = 0.034


def rescale(pos, factor, chin=CHIN_Y, foot=FOOT_Y):
    """Grow the head about the chin. The body is left exactly alone.

    An earlier version also compressed the body to keep total height constant.
    That was wrong in a way the skeleton check could not see: bones must not
    move, so compressing only the mesh slides every vertex away from the joint
    that drives it. The skin still passed compare() and still deformed wrongly,
    and every landmark measured off a bone (hip, knee, ankle) silently stopped
    describing the mesh.

    Only the head moves here, and the head is rigidly weighted to one joint, so
    scaling it about the chin leaves the skinning correct.
    """
    p = pos.copy()
    head = p[:, 1] >= chin
    p[head, 1] = chin + (p[head, 1] - chin) * factor
    p[head, 0] *= factor
    p[head, 2] *= factor
    return p


def apply(src, dst, factor):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    touched = 0
    seen = set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            acc = pr['attributes']['POSITION']
            if acc in seen:
                continue
            seen.add(acc)
            arr = glb.read_accessor(doc, views, acc).astype(np.float64)
            out = rescale(arr, factor).astype('<f4')
            a = doc['accessors'][acc]
            views[a['bufferView']] = bytearray(out.tobytes())
            a['byteOffset'] = 0
            a['min'] = [float(v) for v in out.min(axis=0)]
            a['max'] = [float(v) for v in out.max(axis=0)]
            touched += 1
    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    return touched, size


def ratio(path, chin=CHIN_Y):
    """Heads-tall, measured off the mesh: total height over chin-to-crown."""
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    lo, hi = np.inf, -np.inf
    seen = set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            acc = pr['attributes']['POSITION']
            if acc in seen:
                continue
            seen.add(acc)
            arr = glb.read_accessor(doc, views, acc)
            lo = min(lo, float(arr[:, 1].min()))
            hi = max(hi, float(arr[:, 1].max()))
    return (hi - lo) / (hi - chin), lo, hi


if __name__ == '__main__':
    src, dst, factor = sys.argv[1], sys.argv[2], float(sys.argv[3])
    before, lo0, hi0 = ratio(src)
    n, size = apply(src, dst, factor)
    after, lo1, hi1 = ratio(dst)
    print(f'{n} position accessors rescaled by {factor}')
    print(f'  heads tall {before:.2f} -> {after:.2f}')
    print(f'  height {hi0 - lo0:.4f} -> {hi1 - lo1:.4f}  (feet {lo0:.4f} -> {lo1:.4f})')
