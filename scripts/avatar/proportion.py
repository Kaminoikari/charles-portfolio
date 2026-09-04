"""Shift the head-to-body ratio without moving a single bone.

The reference reads younger than the VRoid base, and almost all of that is one
number: how tall the head is against the whole figure. This scales the head
about the chin and leaves the body alone, so the figure grows by the head's
extra height and the feet stay on the floor (see rescale for why the body is
no longer compressed to compensate).

Bones are untouched on purpose. Moving them would invalidate the clearance
numbers the ten motion clips were measured against, and vrmrig.compare() would
reject the file — which is the check, not an inconvenience. The head bone
therefore stays where it was, and every accessory bound to it must be attached
AFTER this runs, or it will sit at the old scale.

The morph targets ride along. A target's delta is the difference between two
positions in the same frame, so a head scaled by `factor` needs its deltas
scaled by `factor` too; until 2026-09-04 only the positions were scaled, and
the one expression that depends on an absolute distance broke: `Extra` (the ><
eyes) pushes the EyeExtra plane 30.8mm forward, which on the base face lands
it 1mm proud of the skin and on a 6% larger face 1mm behind it, so the >< was
swallowed except for two tips at the inner corners.
"""
import collections
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


def rescale_deltas(delta, pos, factor, chin=CHIN_Y):
    """A morph target's deltas for the mesh `rescale` grew: head rows (the
    vertex sits at or above the chin) scale by the same factor, body rows are
    left alone. A delta is a difference of two positions in one frame, and the
    frame's scale is uniform, so all three axes scale and normals do not."""
    out = delta.copy()
    out[pos[:, 1] >= chin] *= factor
    return out


def _write(doc, views, acc, out, owners):
    """Replace a dense accessor's data by replacing its whole bufferView.
    That is only right when the accessor is the view's sole user, sits at
    offset 0, is tightly packed and not sparse (VRoid's export is all four);
    the assert pins each of them, `owners` being how many accessors reference
    each bufferView."""
    a = doc['accessors'][acc]
    bv = doc['bufferViews'][a['bufferView']]
    assert a.get('byteOffset', 0) == 0 and bv.get('byteStride') in (None, 12) \
        and 'sparse' not in a and owners[a['bufferView']] == 1, \
        f'accessor {acc} does not own a plain dense vec3 bufferView'
    views[a['bufferView']] = bytearray(out.tobytes())
    a['min'] = [float(v) for v in out.min(axis=0)]
    a['max'] = [float(v) for v in out.max(axis=0)]


def apply(src, dst, factor, chin=CHIN_Y):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    owners = collections.Counter(a['bufferView'] for a in doc['accessors'] if 'bufferView' in a)
    touched = 0
    seen = set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            acc = pr['attributes']['POSITION']
            if acc not in seen:
                seen.add(acc)
                arr = glb.read_accessor(doc, views, acc).astype(np.float64)
                _write(doc, views, acc, rescale(arr, factor, chin).astype('<f4'), owners)
                touched += 1
            if not any(t.get('POSITION') not in seen | {None} for t in pr.get('targets', [])):
                continue
            # The primitive's own positions decide which rows are head rows;
            # the scaled block says the same thing as the original did.
            pos = glb.read_accessor(doc, views, acc).astype(np.float64)
            for target in pr['targets']:
                tacc = target.get('POSITION')
                if tacc is None or tacc in seen:
                    continue     # checked per target: two targets of one primitive may share an accessor
                seen.add(tacc)
                delta = glb.read_accessor(doc, views, tacc).astype(np.float64)
                _write(doc, views, tacc, rescale_deltas(delta, pos, factor, chin).astype('<f4'), owners)
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
    print(f'{n} position/morph accessors rescaled by {factor}')
    print(f'  heads tall {before:.2f} -> {after:.2f}')
    print(f'  height {hi0 - lo0:.4f} -> {hi1 - lo1:.4f}  (feet {lo0:.4f} -> {lo1:.4f})')
