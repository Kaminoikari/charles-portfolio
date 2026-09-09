"""Re-home imported cloth that hangs off the body, so a limb stops dragging it.

An auto-fitted garment gets every vertex the skin weights of the body vertex
nearest to it. Where the cloth lies on the body that is right, and where it
creases garment.smooth_weights spreads the handover. Neither helps where the
cloth is not on the body at all: an oversized top flares into the space beside
the ribs, and "nearest" there reaches for whatever surface happens to be
closest, which under a raised arm is the underside of the upper arm on one side
of an edge and the ribs on the other.

Measured on the VRoid Studio dress-up export of 2026-09-09
(evidence/refit-0909.md): two neighbouring hoodie vertices 90.6mm and 97.2mm
off the body took 0.562 and 0.265 of leftUpperArm, copied from body vertices
holding 0.919 and 0.069. Because that fabric hangs 181mm from the shoulder
pivot, lifting the arm 60 degrees pulled a 49.8mm edge to 96.3mm and swung the
whole flank of the garment up with the humerus.

Smoothing cannot repair it and the numbers say why. The transition band sits
at a median radius of 200mm, so verify.BIND_GROWTH_MAX_MM allows 25/200 = 0.125
of weight per edge; spanning a 0.89 handover therefore needs eight edges in a
chain, and the void has about four. garment.smooth_weights stalls at 30.53mm by
32 passes, replacing the void's weights with the nearest torso vertex's reaches
31.60mm, and solving them harmonically from the on-body cloth reaches 38.88mm
because the anchors themselves still hold the handover. Every figure is from
evidence/refit-0909-sweep.log.

What works is removing the reason the handover is there. Cloth that has left
the body hangs from the torso, so its share of the limb goes back to the joint
the limb hangs from, faded in over how far the cloth has drifted. The fade is
spread over the cloth's own edges first, because an unfaded step only moves the
cliff: 101.27mm with neither diffusion, 31.93mm with the weights diffused but
the step left sharp. The R3 hoodie lands at 22.99mm and holds between 21.97 and
24.41mm across the ramp and pass counts either side of the defaults, with the
sleeve still 0.983 on the lower arm.
"""
import sys

import numpy as np
from scipy.spatial import cKDTree

import garment
import glb
import humanoid

# The ramp between cloth that is worn and cloth that hangs, in metres. Read off
# the same export: its sleeves sit 33mm from the arm they cover and the flank
# that tore sits 66-97mm from any body vertex, so the two are separable and the
# ramp belongs between them.
SHED_NEAR_M = 0.045
SHED_FAR_M = 0.075
# Diffusion passes for the shed field and then for the weights themselves.
SHED_PASSES = 24
WEIGHT_PASSES = 12
# Only the arms by default. verify.BIND_BENDS turns the arms and nothing else,
# so the legs' version of this has not been measured and is not claimed.
CHAIN_ROOTS = ('leftShoulder', 'rightShoulder')


def parents_of(doc):
    """child node index -> parent node index."""
    parent = {}
    for index, node in enumerate(doc['nodes']):
        for child in node.get('children', ()):
            parent[child] = index
    return parent


def descendants(doc, root):
    """`root` and every node under it, as a set of node indices."""
    seen = set()
    stack = [root]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(doc['nodes'][node].get('children', ()))
    return seen


def host_of(doc, root, joints):
    """The nearest ancestor of `root` that `joints` lists.

    Walked, never named: our own build hangs the shoulder off
    J_Bip_C_UpperChest and a VRoid dress-up export off J_Bip_C_Chest, and a
    table of names would be wrong on one of them without saying so.
    """
    parent = parents_of(doc)
    listed = {node: slot for slot, node in enumerate(joints)}
    node = parent.get(root)
    while node is not None:
        if node in listed:
            return node
        node = parent.get(node)
    raise SystemExit(f'no ancestor of node {root} is in this skin')


def body_distance(pos, pool_pos):
    """Each vertex's distance to the nearest body vertex.

    Measured vertex to vertex, so a coarse body reads further away than its
    surface is. The pool this was read on carries 9385 vertices over three
    meshes; a sparse body would need the ramp re-read.
    """
    return cKDTree(np.asarray(pool_pos)).query(np.asarray(pos))[0]


def shed_field(piece, distance, near=SHED_NEAR_M, far=SHED_FAR_M,
               passes=SHED_PASSES):
    """Per vertex, 0 where the cloth is worn and 1 where it hangs free.

    The raw ramp is a step wherever the body ends, and writing a step into the
    weights just moves the tear. Diffused over the cloth's own welded edges
    first, the same information arrives as a slope. Welded, because a UV split
    would otherwise stop the spread dead at the seam.
    """
    if not far > near:
        raise SystemExit(f'the shed ramp needs far > near, got {near} {far}')
    seam, edges = garment.welded_edges(piece)
    n = int(seam.max()) + 1
    field = np.zeros(n)
    np.add.at(field, seam, np.asarray(distance, dtype=np.float64))
    field /= np.bincount(seam, minlength=n)
    field = np.clip((field - near) / (far - near), 0.0, 1.0)
    degree = np.bincount(edges.ravel(), minlength=n).astype(np.float64)
    degree[degree == 0] = 1.0
    for _ in range(passes):
        acc = np.zeros(n)
        np.add.at(acc, edges[:, 0], field[edges[:, 1]])
        np.add.at(acc, edges[:, 1], field[edges[:, 0]])
        field = 0.5 * field + 0.5 * acc / degree
    return field[seam]


def rehome(piece, distance, moves, near=SHED_NEAR_M, far=SHED_FAR_M,
           shed_passes=SHED_PASSES, weight_passes=WEIGHT_PASSES, keep=4):
    """Move each limb's hold on free-hanging cloth to its host, in place.

    `moves` pairs a chain of slots in this piece's own skin with the slot the
    chain hangs from. Every chain sheds against one shed field and the result
    is diffused once, because two arms are one garment: running the whole
    operation per arm would diffuse the first arm's result a second time.

    The shed share is taken from every joint of a chain at once, so a sleeve
    that is genuinely worn keeps all of it and only the fabric past the ramp
    lets go.
    """
    joints = np.asarray(piece['joints'])
    weights = np.asarray(piece['weights'], dtype=np.float64)
    reach = [int(joints.max())]
    for chain, host in moves:
        reach += [int(host), *(int(c) for c in chain)]
    # Never narrower than the four slots the attributes have to be written
    # back into: a skin listing three joints would otherwise leave argsort
    # returning three columns and glb.add_accessor writing a VEC3 JOINTS_0.
    dense = np.zeros((len(joints), max(max(reach) + 1, keep)))
    for column in range(joints.shape[1]):
        np.add.at(dense, (np.arange(len(joints)), joints[:, column]),
                  weights[:, column])
    shed = shed_field(piece, distance, near, far, shed_passes)
    for chain, host in moves:
        # Deduplicated: a skin may list one node in two slots, and a repeated
        # column is subtracted once by fancy indexing while moved.sum adds it
        # twice, which would hand the host more than the chain ever held.
        chain = sorted({int(c) for c in chain})
        moved = dense[:, chain] * shed[:, None]
        dense[:, chain] -= moved
        dense[:, host] += moved.sum(axis=1)
    top = np.argsort(-dense, axis=1)[:, :keep]
    kept = np.take_along_axis(dense, top, axis=1)
    total = kept.sum(axis=1, keepdims=True)
    piece['joints'] = top.astype(joints.dtype)
    piece['weights'] = (kept / np.where(total == 0, 1.0, total)).astype(
        np.asarray(piece['weights']).dtype)
    if weight_passes:
        garment.smooth_weights(piece, weight_passes, keep=keep)
    return piece


def piece_of(doc, views, mesh_name, prim):
    """One primitive as the dict garment.py's helpers take."""
    mesh = next((m for m in doc['meshes'] if m.get('name') == mesh_name), None)
    if mesh is None:
        raise SystemExit(f'no mesh named {mesh_name!r}')
    primitive = mesh['primitives'][prim]
    if 'indices' not in primitive:
        raise SystemExit(f'{mesh_name}[{prim}] is not indexed')
    if primitive.get('mode', 4) != 4:
        # A strip or fan reshaped three at a time is a different mesh, and the
        # edges welded_edges would walk are not the ones that are there.
        raise SystemExit(f'{mesh_name}[{prim}] is not a triangle list')
    attributes = primitive['attributes']
    if 'JOINTS_0' not in attributes:
        raise SystemExit(f'{mesh_name}[{prim}] has no skin weights')
    return primitive, {
        'pos': glb.read_accessor(doc, views, attributes['POSITION']).astype(np.float64),
        'tris': glb.read_accessor(doc, views, primitive['indices']).astype(np.int64).reshape(-1, 3),
        'joints': glb.read_accessor(doc, views, attributes['JOINTS_0']).astype(np.uint16),
        'weights': glb.read_accessor(doc, views, attributes['WEIGHTS_0']).astype(np.float32),
    }


def apply(src, dst, cloth, body, chains=CHAIN_ROOTS, near=SHED_NEAR_M,
          far=SHED_FAR_M, shed_passes=SHED_PASSES, weight_passes=WEIGHT_PASSES):
    """Rewrite `cloth`'s weights in `src` and write the model to `dst`.

    `cloth` and `body` are (mesh name, primitive index) pairs; the body ones
    must be named because an auto-masked export has holes
    exactly where the garment covers it, and a pool with holes would read the
    cloth as further from the body than it is.
    """
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    bones = humanoid.bones(doc)
    pool = np.vstack([piece_of(doc, views, name, prim)[1]['pos']
                      for name, prim in body])
    report = []
    for name, prim in cloth:
        primitive, piece = piece_of(doc, views, name, prim)
        joints = doc['skins'][humanoid.skin_of_mesh(doc, name)]['joints']
        slot = {node: index for index, node in enumerate(joints)}
        distance = body_distance(piece['pos'], pool)
        moves = []
        for root in chains:
            if root not in bones:
                continue
            under = descendants(doc, bones[root])
            chain = [slot[node] for node in joints if node in under]
            if not chain:
                continue
            host = slot[host_of(doc, bones[root], joints)]
            moves.append((chain, host))
            report.append({'cloth': f'{name}[{prim}]', 'chain': root,
                           'joints': len(chain),
                           'host': doc['nodes'][joints[host]].get('name')})
        if not moves:
            # Writing the file back unchanged and reporting an empty list reads
            # as success. A rig with no shoulders is legal and passes every
            # existing gate, so nothing downstream would catch it either.
            raise SystemExit(f'{name}[{prim}] has no joint of {list(chains)} '
                             'in its skin: nothing to re-home')
        rehome(piece, distance, moves, near, far, shed_passes, weight_passes)
        primitive['attributes']['JOINTS_0'] = glb.add_accessor(
            doc, views, piece['joints'], target=34962)
        primitive['attributes']['WEIGHTS_0'] = glb.add_accessor(
            doc, views, piece['weights'].astype(np.float32), target=34962)
    size = glb.save(dst, doc, glb.rebuild(doc, views))
    return {'path': dst, 'bytes': size, 'rehomed': report}


def _pairs(text):
    """'Mesh A:0,Mesh B:1' -> (('Mesh A', 0), ('Mesh B', 1)).

    Split on the last colon so a mesh name may hold one; a mesh name holding a
    comma cannot be addressed from the command line and has to call apply().
    """
    out = []
    for item in text.split(','):
        name, colon, prim = item.rpartition(':')
        if not colon or not name or not prim.lstrip('-').isdigit():
            raise SystemExit(f'expected "mesh name:primitive", got {item!r}')
        out.append((name, int(prim)))
    return tuple(out)


if __name__ == '__main__':
    if len(sys.argv) < 5:
        raise SystemExit('refit.py <src.vrm> <dst.vrm> '
                         '<cloth mesh:prim,...> <body mesh:prim,...>')
    print(apply(sys.argv[1], sys.argv[2],
                _pairs(sys.argv[3]), _pairs(sys.argv[4])))
