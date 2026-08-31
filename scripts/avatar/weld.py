"""Attach geometry made in Blender to the VRM, without Blender touching the VRM.

Blender exports a bare .glb of new meshes and nothing else. This reads it, bakes
each object's node transform into its vertices, gives every vertex the skin
weights of the body vertex nearest to it, and attaches the result as a named part
of the original file. The original's humanoid map, morph targets, expression
groups and spring bones are never round-tripped through an exporter, so there is
nothing for one to lose.

Weights come from the body rather than from Blender on purpose. Blender would
have to carry the armature to export a skin at all, its joint order would be its
own, and the indices would then have to be mapped back by bone name. Assigning
them here uses the rule already proved on the collar and the wraps, and keeps
one place where skinning is decided.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import garment  # noqa: E402
import glb  # noqa: E402
import render  # noqa: E402


def pieces(path):
    """object name -> piece dict, in the VRM's own coordinates."""
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    world = render.world_matrices(doc)
    node_of_mesh = {}
    for i, n in enumerate(doc['nodes']):
        if 'mesh' in n:
            node_of_mesh.setdefault(n['mesh'], i)

    out = {}
    for mi, mesh in enumerate(doc['meshes']):
        pos, nrm, uv, tris = [], [], [], []
        base = 0
        m = world.get(node_of_mesh.get(mi, 0), np.eye(4))
        for pr in mesh['primitives']:
            a = pr['attributes']
            p = glb.read_accessor(doc, views, a['POSITION']).astype(np.float64)
            p = (m[:3, :3] @ p.T).T + m[:3, 3]
            if 'NORMAL' in a:
                n = glb.read_accessor(doc, views, a['NORMAL']).astype(np.float64)
                n = (m[:3, :3] @ n.T).T
            else:
                n = np.zeros_like(p)
            t = (glb.read_accessor(doc, views, a['TEXCOORD_0']).astype(np.float64)
                 if 'TEXCOORD_0' in a else np.zeros((len(p), 2)))
            idx = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
            pos.append(p)
            nrm.append(n)
            uv.append(t)
            tris.append(idx + base)
            base += len(p)
        length = np.linalg.norm(np.concatenate(nrm), axis=1, keepdims=True)
        out[mesh.get('name') or f'mesh{mi}'] = {
            'pos': np.concatenate(pos),
            'nrm': np.divide(np.concatenate(nrm), np.where(length == 0, 1, length)),
            'uv': np.concatenate(uv),
            'tris': np.concatenate(tris),
        }
    return out


def part(path, only=None, skip=()):
    """The objects in one Blender export, merged into a single piece.

    `only` keeps just those mesh names and `skip` drops them, which is how one
    export can supply two materials: the waist bow's knot has to be a different
    colour from the loops it divides, and it is built in the same file as them
    because its placement is derived from theirs.

    Returns None when the file is not there, so a build still runs on a machine
    without Blender: the parametric parts are all present, and only the lofted
    ones are missing.
    """
    if not os.path.exists(path):
        return None
    found = pieces(path)
    wanted = set(only) if only is not None else set(found)
    missing = wanted - set(found)
    if missing:
        raise SystemExit(f'{path} 裡沒有 {sorted(missing)}，名字改了就會靜默漏件')
    found = {k: v for k, v in found.items() if k in wanted and k not in skip}
    if not found:
        return None
    merged = garment.merge([dict(p, joints=np.zeros((len(p['pos']), 4), dtype=np.uint16),
                                 weights=np.zeros((len(p['pos']), 4), dtype=np.float32))
                            for p in found.values()])
    return merged


def attach(doc, views, manifest, piece, material, part_name, mesh='Body.baked',
           pool=None):
    pool = pool if pool is not None else garment.body_pool(doc, views, manifest)
    piece = dict(piece)
    piece['joints'] = np.zeros((len(piece['pos']), 4), dtype=np.uint16)
    piece['weights'] = np.zeros((len(piece['pos']), 4), dtype=np.float32)
    garment.bind(pool, piece)
    garment.attach(doc, views, mesh, piece, material, part_name)
    return len(piece['tris'])


if __name__ == '__main__':
    src = sys.argv[1]
    for name, piece in pieces(src).items():
        p = piece['pos']
        print(f'{name:<22} {len(p):>6} 點 {len(piece["tris"]):>6} 面  '
              f'x {p[:, 0].min():+.3f}..{p[:, 0].max():+.3f}  '
              f'y {p[:, 1].min():+.3f}..{p[:, 1].max():+.3f}  '
              f'z {p[:, 2].min():+.3f}..{p[:, 2].max():+.3f}')
