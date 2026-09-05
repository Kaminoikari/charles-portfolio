"""Skin the mesh to a pose, so clothes can be checked where they actually fail.

A garment grown off the body looks perfect at rest and can still be wrong: the
test is whether it follows when the joint under it rotates. That needs real
linear blend skinning, so this builds the joint matrices and applies them.

Two things get checked with it. Whether a garment penetrates the body once bent
(sample the garment's vertices against the nearest body surface), and whether a
morph target still produces a sane shape (compare bounding boxes, since a broken
delta shows up as a vertex flung across the room long before it looks subtle).
"""
import numpy as np

import glb
import humanoid
from render import world_matrices

# A garment vertex further than this from any skin vertex is not resting on the
# body, so 'how deep is it buried' is not a question about it.
NEAR = 0.030


def quat(axis, degrees):
    a = np.radians(degrees) / 2
    v = np.asarray(axis, dtype=np.float64)
    v = v / np.linalg.norm(v)
    return np.array([*(v * np.sin(a)), np.cos(a)])


def joint_matrices(doc, rotations=None, replace=False):
    """World matrix per node, with `rotations` (node index -> xyzw) applied.

    `replace` is the difference between a clip and a nudge. A .vrma rotation
    channel states the node's local rotation outright, so composing it onto the
    rest rotation doubles the bend and reports穿模 that is not there. The
    synthetic POSES below are increments, and compose.
    """
    nodes = [dict(n) for n in doc['nodes']]
    for idx, q in (rotations or {}).items():
        if replace:
            nodes[idx]['rotation'] = [float(v) for v in q]
            continue
        base = np.array(nodes[idx].get('rotation', [0, 0, 0, 1]), dtype=np.float64)
        x1, y1, z1, w1 = base
        x2, y2, z2, w2 = q
        nodes[idx]['rotation'] = [
            w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
            w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        ]
    return world_matrices({**doc, 'nodes': nodes})


def skinned(doc, views, rotations=None, replace=False):
    """Every primitive's vertices in the posed world, keyed by (mesh, prim)."""
    skin = doc['skins'][0]
    inv = glb.read_accessor(doc, views, skin['inverseBindMatrices'])
    inv = inv.reshape(-1, 4, 4).transpose(0, 2, 1)
    world = joint_matrices(doc, rotations, replace)
    mats = np.stack([world[n] @ inv[i] for i, n in enumerate(skin['joints'])])

    out = {}
    for mi, mesh in enumerate(doc['meshes']):
        for pi, pr in enumerate(mesh['primitives']):
            a = pr['attributes']
            p = glb.read_accessor(doc, views, a['POSITION']).astype(np.float64)
            if 'JOINTS_0' not in a:
                out[(mesh.get('name'), pi)] = p
                continue
            j = glb.read_accessor(doc, views, a['JOINTS_0']).astype(np.int64)
            w = glb.read_accessor(doc, views, a['WEIGHTS_0']).astype(np.float64)
            total = w.sum(axis=1, keepdims=True)
            w = np.divide(w, np.where(total == 0, 1, total))
            hom = np.concatenate([p, np.ones((len(p), 1))], axis=1)
            acc = np.zeros_like(p)
            for k in range(j.shape[1]):
                m = mats[j[:, k]]
                acc += (np.einsum('nij,nj->ni', m, hom)[:, :3]) * w[:, k:k + 1]
            out[(mesh.get('name'), pi)] = acc
    return out


POSES = {
    'arms_down': lambda b: {b['leftUpperArm']: quat([0, 0, 1], -68),
                            b['rightUpperArm']: quat([0, 0, 1], 68)},
    'knees_bent': lambda b: {b['leftUpperLeg']: quat([1, 0, 0], -55),
                             b['rightUpperLeg']: quat([1, 0, 0], -55),
                             b['leftLowerLeg']: quat([1, 0, 0], 75),
                             b['rightLowerLeg']: quat([1, 0, 0], 75)},
    'arms_up': lambda b: {b['leftUpperArm']: quat([0, 0, 1], 55),
                          b['rightUpperArm']: quat([0, 0, 1], -55)},
}


def bones(doc):
    return humanoid.bones(doc)


def skinned_normals(doc, views, rotations=None, replace=False):
    """Per-primitive normals rotated by the same joint matrices as the points."""
    skin = doc['skins'][0]
    inv = glb.read_accessor(doc, views, skin['inverseBindMatrices'])
    inv = inv.reshape(-1, 4, 4).transpose(0, 2, 1)
    world = joint_matrices(doc, rotations, replace)
    mats = np.stack([world[n] @ inv[i] for i, n in enumerate(skin['joints'])])

    out = {}
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            a = pr['attributes']
            if 'NORMAL' not in a:
                continue
            n = glb.read_accessor(doc, views, a['NORMAL']).astype(np.float64)
            if 'JOINTS_0' not in a:
                out[(mesh.get('name'), pi)] = n
                continue
            j = glb.read_accessor(doc, views, a['JOINTS_0']).astype(np.int64)
            w = glb.read_accessor(doc, views, a['WEIGHTS_0']).astype(np.float64)
            total = w.sum(axis=1, keepdims=True)
            w = np.divide(w, np.where(total == 0, 1, total))
            acc = np.zeros_like(n)
            for k in range(j.shape[1]):
                m = mats[j[:, k]][:, :3, :3]
                acc += np.einsum('nij,nj->ni', m, n) * w[:, k:k + 1]
            length = np.linalg.norm(acc, axis=1, keepdims=True)
            out[(mesh.get('name'), pi)] = np.divide(acc, np.where(length == 0, 1, length))
    return out


def penetration(doc, views, parts, pose_name, garment_parts,
                body_part='Body_Skin', rotations=None, replace=False):
    """How far each garment part sinks below the body surface, in millimetres.

    Depth is measured along the nearest BODY VERTEX'S OWN NORMAL. An earlier
    version used the direction from the body's centroid instead, which put the
    centroid at the waist and therefore called every hair clip 50mm sunken: the
    outward direction at the scalp has nothing to do with the direction from the
    hips. Normals are skinned with the same matrices as the points, so the test
    stays honest once the joint rotates.
    """
    if rotations is None:
        b = bones(doc)
        rotations = POSES[pose_name](b) if pose_name else {}
    rot = rotations
    posed = skinned(doc, views, rot, replace)
    normals = skinned_normals(doc, views, rot, replace)

    mesh_name = parts[body_part]['mesh']
    body = np.concatenate([posed[(mesh_name, i)] for i in parts[body_part]['primitives']])
    body_n = np.concatenate([normals[(mesh_name, i)]
                             for i in parts[body_part]['primitives']])

    report = {}
    for name in garment_parts:
        info = parts.get(name)
        if not info or not info['primitives']:
            continue
        pts = np.concatenate([posed[(info['mesh'], i)] for i in info['primitives']])
        sample = pts[::max(1, len(pts) // 400)]
        worst = 0.0
        for q in sample:
            d = body - q
            dist2 = (d * d).sum(axis=1)
            k = int(np.argmin(dist2))
            # Only points actually near the skin can be said to sink into it.
            # A hair clip's nearest body vertex is a shoulder 50mm away, and the
            # shoulder's normal says nothing about whether the clip is buried.
            if dist2[k] > NEAR ** 2:
                continue
            worst = min(worst, float(np.dot(q - body[k], body_n[k])))
        report[name] = round(-worst * 1000, 2)
    return report
