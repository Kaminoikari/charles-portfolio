"""A body of the same shape at a different size.

The plan's fixture list asks for a second body whose height differs from the
shipped one by at least 10%, and says why: a constant that is really a length in
metres cannot be told apart from a derived landmark while every body it is tried
on is the same size. Seed-san, the real second body, came out 0.1% taller than
ours (docs/plans/avatar-fixture-seed-san.md), so it closed the SHAPE dimension
and left the SCALE one open. This closes it synthetically.

What it does is a similarity transform about the origin: every node translation,
every vertex, every morph delta, every inverse bind matrix's translation, and
the spring bones' own lengths (`hitRadius`, collider `offset` and `radius`) are
multiplied by one factor. Nothing else moves, so the result is the same body,
the same topology, the same skinning and the same proportions, at a size the
pipeline has never seen.

WHAT IT DELIBERATELY DOES NOT SCALE. `stiffiness`, `dragForce` and
`gravityPower` are left alone. The first two are dimensionless, but
`gravityPower` is not: a truly self-similar body would need it changed, and by
how much depends on how three-vrm integrates it, which is a physics claim this
file is not in a position to make. The fixture is therefore honest for geometry
and landmarks -- what it was built for -- and its hair hangs differently from a
real body of that size. springsim on it measures this file's spring settings at
that scale, not "what a 1.25x body's hair would do".

VRM 0.x only, matching the rest of the pipeline: make.py converts 1.0 at the
door (vrm1to0.ensure_vrm0) and every writer downstream is 0.x.

    python3 scripts/avatar/scalebody.py <src.vrm> <dst.vrm> <factor>
"""
import sys

import numpy as np

import glb
import humanoid

# Every accessor this touches is a plain dense block of floats; a sparse or
# strided one would need the write to interleave, and VRoid's export has neither.
def _write_accessor(doc, views, index, out):
    acc = doc['accessors'][index]
    assert 'sparse' not in acc, f'accessor {index} is sparse; this writer only handles dense blocks'
    assert 'bufferView' in acc, f'accessor {index} has no bufferView'
    bv = doc['bufferViews'][acc['bufferView']]
    dtype = glb.DTYPE[acc['componentType']]
    ncomp = glb.NCOMP[acc['type']]
    packed = dtype.itemsize * ncomp
    assert bv.get('byteStride') in (None, packed), \
        f'accessor {index} is interleaved (stride {bv.get("byteStride")}, packed {packed})'
    start = acc.get('byteOffset', 0)
    data = out.astype(dtype).tobytes()
    assert len(data) == acc['count'] * packed
    views[acc['bufferView']][start:start + len(data)] = data
    if 'min' in acc:
        acc['min'] = [float(v) for v in np.asarray(out).reshape(-1, ncomp).min(axis=0)]
    if 'max' in acc:
        acc['max'] = [float(v) for v in np.asarray(out).reshape(-1, ncomp).max(axis=0)]


def _scale_springs(doc, k, log):
    """VRM 0.x spring lengths. Radii and offsets are metres; the rest are not."""
    sa = doc.get('extensions', {}).get('VRM', {}).get('secondaryAnimation')
    if sa is None:
        return
    for group in sa.get('boneGroups', []):
        if 'hitRadius' in group:
            group['hitRadius'] *= k
            log('hitRadius')
    for cg in sa.get('colliderGroups', []):
        for collider in cg.get('colliders', []):
            if 'radius' in collider:
                collider['radius'] *= k
                log('collider radius')
            if 'offset' in collider:
                collider['offset'] = {a: v * k for a, v in collider['offset'].items()}
                log('collider offset')


def apply(src, dst, factor):
    """Write `src` scaled by `factor` to `dst`. Returns a count of what moved."""
    doc, binary = glb.load(src)
    if humanoid.version(doc) != '0':
        raise SystemExit(
            f'{src} 是 VRM 1.0。這條管線內部一律 0.x，先過 vrm1to0.ensure_vrm0 再縮放。')
    views = glb.views_of(doc, binary)
    counts = {}
    def log(what):
        counts[what] = counts.get(what, 0) + 1

    for node in doc['nodes']:
        if 'translation' in node:
            node['translation'] = [v * factor for v in node['translation']]
            log('node translation')
        if 'matrix' in node:
            # Column-major: the translation is the last four floats.
            m = list(node['matrix'])
            m[12:15] = [v * factor for v in m[12:15]]
            node['matrix'] = m
            log('node matrix')

    seen = set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            for acc in [pr['attributes']['POSITION']] + \
                       [t['POSITION'] for t in pr.get('targets', []) if 'POSITION' in t]:
                if acc in seen:
                    continue
                seen.add(acc)
                # A morph delta is a difference of two positions in one frame, so
                # it scales exactly as a position does.
                arr = glb.read_accessor(doc, views, acc).astype(np.float64) * factor
                _write_accessor(doc, views, acc, arr)
                log('position/morph accessor')

    for skin in doc.get('skins', []):
        acc = skin.get('inverseBindMatrices')
        if acc is None or acc in seen:
            continue
        seen.add(acc)
        # IBM = inverse(bind world). Scaling every joint's world translation by k
        # scales the inverse's translation column by k and leaves its rotation
        # alone, so only the last row of each column-major mat4 moves.
        ibm = glb.read_accessor(doc, views, acc).astype(np.float64)
        ibm[:, 12:15] *= factor
        _write_accessor(doc, views, acc, ibm)
        log('inverse bind matrices')

    _scale_springs(doc, factor, log)

    vrm = doc.get('extensions', {}).get('VRM', {})
    offset = vrm.get('firstPerson', {}).get('firstPersonBoneOffset')
    if offset is not None:
        vrm['firstPerson']['firstPersonBoneOffset'] = {a: v * factor for a, v in offset.items()}
        log('firstPersonBoneOffset')
    for bone in vrm.get('humanoid', {}).get('humanBones', []):
        if 'center' in bone:
            bone['center'] = {a: v * factor for a, v in bone['center'].items()}
            log('humanBone center')
        if 'axisLength' in bone:
            bone['axisLength'] *= factor
            log('humanBone axisLength')

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    return counts, size


def _height(doc, views):
    lo, hi, seen = np.inf, -np.inf, set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            acc = pr['attributes']['POSITION']
            if acc in seen:
                continue
            seen.add(acc)
            arr = glb.read_accessor(doc, views, acc)
            lo, hi = min(lo, float(arr[:, 1].min())), max(hi, float(arr[:, 1].max()))
    return lo, hi


def height(path):
    doc, binary = glb.load(path)
    return _height(doc, glb.views_of(doc, binary))


if __name__ == '__main__':
    src, dst, factor = sys.argv[1], sys.argv[2], float(sys.argv[3])
    lo0, hi0 = height(src)
    counts, size = apply(src, dst, factor)
    lo1, hi1 = height(dst)
    for what, n in sorted(counts.items()):
        print(f'  {n:5d}  {what}')
    print(f'  height {hi0 - lo0:.4f} -> {hi1 - lo1:.4f}  '
          f'(x{(hi1 - lo1) / (hi0 - lo0):.6f}, asked x{factor})')
    print(f'  {dst}（{size} bytes）')
