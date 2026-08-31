"""Read and rewrite a VRM's binary chunk, including adding geometry.

`scripts/repaint_vrm.py` already proved the safe shape of a GLB rewrite: pull
every bufferView out as bytes, change what you mean to change, then lay the
whole chunk down again with fresh offsets. Rewriting an offset in place is not
an option once any view changes length. This module is that same move, plus the
accessor plumbing needed to ADD vertices rather than only recolour them.

The skeleton assertion lives in vrmrig.compare(), not here — this module is
deliberately willing to write a file that compare() will then reject, because a
tool that silently refuses is harder to debug than one that writes and is
checked.
"""
import json
import struct

import numpy as np

GLB_MAGIC = 0x46546C67

# A vertex counts as moved by a morph target when it moves further than this,
# in metres. Every stage that asks "does this key still do anything" -- writing
# the sparse block, pruning after a deletion, reporting the manifest -- has to
# use the same number or they disagree about which keys exist. 0.02mm is two
# orders below the smallest movement any of this model's keys makes, and the
# tail it drops is the fraction-of-a-micron grazing a sculpt brush leaves
# behind, which is what keeps six keys at 0.7MB rather than putting every
# vertex of every garment into the sparse block.
MORPH_EPSILON = 0.00002

# glTF componentType -> numpy dtype. Little-endian is mandated by the spec.
DTYPE = {
    5120: np.dtype('<i1'), 5121: np.dtype('<u1'),
    5122: np.dtype('<i2'), 5123: np.dtype('<u2'),
    5125: np.dtype('<u4'), 5126: np.dtype('<f4'),
}
COMPONENT = {v: k for k, v in DTYPE.items()}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
TYPE_OF = {v: k for k, v in NCOMP.items()}


def load(path):
    """(doc, binary) from a .vrm / .glb."""
    raw = open(path, 'rb').read()
    magic, version, _ = struct.unpack('<III', raw[:12])
    assert magic == GLB_MAGIC and version == 2, f'{path} 不是 glb 2.0'
    jlen, _ = struct.unpack('<II', raw[12:20])
    doc = json.loads(raw[20:20 + jlen])
    blen, _ = struct.unpack('<II', raw[20 + jlen:28 + jlen])
    binary = raw[28 + jlen:28 + jlen + blen]
    return doc, binary


def views_of(doc, binary):
    """Every bufferView as its own bytearray, in index order."""
    out = []
    for bv in doc['bufferViews']:
        off = bv.get('byteOffset', 0)
        out.append(bytearray(binary[off:off + bv['byteLength']]))
    return out


def _dense_twin(doc, acc):
    """The dense base of a sparse accessor that has one. Not produced here."""
    raise NotImplementedError(
        'sparse accessor with a dense base bufferView; this project only writes '
        'the zero-base form, so reading one means the file came from elsewhere')


def read_accessor(doc, views, index):
    """One accessor as an (count, ncomp) float/int array, stride-aware."""
    acc = doc['accessors'][index]
    dtype = DTYPE[acc['componentType']]
    ncomp = NCOMP[acc['type']]
    count = acc['count']
    if 'sparse' in acc:
        # Resolve to the dense array the accessor stands for. The base is
        # whatever `bufferView` says, or zeros when it is absent, and the sparse
        # block patches entries into it. Returning the base alone would hand a
        # caller an array of zeros that looks like a real answer.
        sp = acc['sparse']
        if 'bufferView' in acc:
            base = read_accessor(doc, views, _dense_twin(doc, acc))
        else:
            base = np.zeros((count, ncomp), dtype=dtype)
        idtype = DTYPE[sp['indices']['componentType']]
        iview = sp['indices']['bufferView']
        idx = np.frombuffer(bytes(views[iview]), dtype=idtype,
                            count=sp['count'],
                            offset=sp['indices'].get('byteOffset', 0))
        vview = sp['values']['bufferView']
        vals = np.frombuffer(bytes(views[vview]), dtype=dtype,
                             count=sp['count'] * ncomp,
                             offset=sp['values'].get('byteOffset', 0))
        out = np.array(base)
        out[idx.astype(np.int64)] = vals.reshape(-1, ncomp)
        return out
    if 'bufferView' not in acc:                      # spec: absent = all zeros
        return np.zeros((count, ncomp), dtype=dtype)
    bv = doc['bufferViews'][acc['bufferView']]
    raw = bytes(views[acc['bufferView']])
    start = acc.get('byteOffset', 0)
    stride = bv.get('byteStride') or dtype.itemsize * ncomp
    packed = dtype.itemsize * ncomp
    if stride == packed:
        flat = np.frombuffer(raw, dtype=dtype, count=count * ncomp, offset=start)
        return flat.reshape(count, ncomp)
    rows = np.frombuffer(raw, dtype=np.uint8, count=count * stride, offset=start)
    rows = rows.reshape(count, stride)[:, :packed].copy()
    return rows.view(dtype).reshape(count, ncomp)


def add_view(doc, views, data):
    """Append raw bytes as their own bufferView. Returns its index."""
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': 0, 'byteLength': len(data)})
    views.append(bytearray(data))
    return len(doc['bufferViews']) - 1


def add_accessor(doc, views, array, target=None, minmax=False):
    """Append `array` as a fresh tightly-packed bufferView + accessor.

    Returns the accessor index. `target` is 34962 for vertex attributes and
    34963 for indices; leaving it None is legal but some loaders are happier
    when it is set, and three.js is one of them.
    """
    array = np.ascontiguousarray(array)
    if array.ndim == 1:
        array = array.reshape(-1, 1)
    count, ncomp = array.shape
    bv = {'buffer': 0, 'byteOffset': 0, 'byteLength': array.nbytes}
    if target is not None:
        bv['target'] = target
    doc['bufferViews'].append(bv)
    views.append(bytearray(array.tobytes()))
    acc = {
        'bufferView': len(doc['bufferViews']) - 1,
        'componentType': COMPONENT[array.dtype.newbyteorder('<')],
        'count': count,
        'type': TYPE_OF[ncomp],
    }
    if minmax:
        acc['min'] = [float(v) for v in array.min(axis=0)]
        acc['max'] = [float(v) for v in array.max(axis=0)]
    doc['accessors'].append(acc)
    return len(doc['accessors']) - 1


def add_sparse_accessor(doc, views, count, indices, values):
    """A mostly-zero VEC3 accessor, stored as only the entries that are not zero.

    This exists for morph targets. glTF requires every primitive in a mesh to
    carry the SAME number of targets, so grafting one shape key onto the skirt
    obliges the boots, the socks, the body and every hair strand in that mesh to
    carry a target too. Dense, that is the whole vertex array again per target
    per primitive: seven keys over Body.baked would be about 4MB of zeros. A
    sparse accessor stores the moved vertices and nothing else, and the ones
    that move are a few thousand out of tens of thousands.

    `indices` are vertex indices into the primitive, `values` the matching
    deltas. The spec forbids an empty sparse block, so a target that moves
    nothing is written as a single zero delta rather than as no entries.
    """
    indices = np.ascontiguousarray(np.asarray(indices, dtype='<u4'))
    values = np.ascontiguousarray(np.asarray(values, dtype='<f4').reshape(-1, 3))
    if len(indices) == 0:
        indices = np.zeros(1, dtype='<u4')
        values = np.zeros((1, 3), dtype='<f4')
    if len(indices) != len(values):
        raise ValueError(f'{len(indices)} 個索引配 {len(values)} 個位移')

    def _view(array):
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': 0,
                                   'byteLength': array.nbytes})
        views.append(bytearray(array.tobytes()))
        return len(doc['bufferViews']) - 1

    # No target on either view. 34962 (ARRAY_BUFFER) says "upload this as a
    # vertex buffer", and a sparse accessor's own storage is read on the CPU to
    # patch the zeros; three.js rejects the file if the index view claims to be
    # a vertex buffer.
    iview, vview = _view(indices), _view(values)
    # The spec asks for the bounds of what the accessor RESOLVES to, sparse
    # substitution applied -- so the zeros count, but only when some vertex is
    # still a zero. A primitive whose every vertex is patched has none, and
    # folding 0.0 in anyway writes a bound the data never reaches, which is
    # exactly what glTF-Validator flags as ACCESSOR_MIN/MAX_MISMATCH. Four of
    # this model's targets are fully patched, so this is not hypothetical.
    lo, hi = values.min(axis=0), values.max(axis=0)
    if len(indices) < count:
        lo, hi = np.minimum(lo, 0.0), np.maximum(hi, 0.0)
    doc['accessors'].append({
        'componentType': 5126, 'count': int(count), 'type': 'VEC3',
        'min': [float(v) for v in lo], 'max': [float(v) for v in hi],
        'sparse': {
            'count': int(len(indices)),
            'indices': {'bufferView': iview, 'byteOffset': 0,
                        'componentType': 5125},
            'values': {'bufferView': vview, 'byteOffset': 0},
        },
    })
    return len(doc['accessors']) - 1


def rebuild(doc, views):
    """Re-lay every view end to end, fixing offsets. Returns the new chunk."""
    blob = bytearray()
    for i, bv in enumerate(doc['bufferViews']):
        while len(blob) % 4:
            blob.append(0)
        bv['byteOffset'] = len(blob)
        bv['byteLength'] = len(views[i])
        blob += views[i]
    while len(blob) % 4:
        blob.append(0)
    doc['buffers'] = [{'byteLength': len(blob)}]
    return bytes(blob)


def save(path, doc, blob):
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    pad = bytes((4 - len(blob) % 4) % 4)
    blob = blob + pad
    glb = (
        struct.pack('<III', GLB_MAGIC, 2, 12 + 8 + len(js) + 8 + len(blob))
        + struct.pack('<II', len(js), 0x4E4F534A) + js
        + struct.pack('<II', len(blob), 0x004E4942) + blob
    )
    open(path, 'wb').write(glb)
    return len(glb)
