"""The two tables in refit-0909.md: four repair approaches, then refit's ramp.

Three of the four approaches are not in production because they do not reach
the gate; they live here so the table can be re-run, not just trusted.

    python3 scripts/avatar/evidence/refit-0909-sweep.py <dressed.vrm>

The model is a VRoid Studio dress-up export under the ignored build/ tree
(build/mika-reuse/r3-studio-20260909/R3-B-clean-base-dressup.vrm on 2026-09-09,
sha256 c062e296a0875cb977f66c1b48406795c630027ec45d6d9241fa1731a1d56b07). It is
not in the repository, so this takes the path as an argument.
"""
import os
import sys
import tempfile

import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import garment  # noqa: E402
import glb  # noqa: E402
import humanoid  # noqa: E402
import refit  # noqa: E402
import verify  # noqa: E402

CLOTH = ('Tops.baked', 0)
BODY = (('InnerTop.baked', 0), ('InnerBottom.baked', 0),
        ('Body (merged).baked(copy).baked', 0))


def load(src):
    doc, binary = glb.load(src)
    return doc, glb.views_of(doc, binary)


def parts(doc, views):
    primitive, piece = refit.piece_of(doc, views, *CLOTH)
    pool = np.vstack([refit.piece_of(doc, views, n, p)[1]['pos'] for n, p in BODY])
    return primitive, piece, pool


def written(doc, views, primitive, piece):
    primitive['attributes']['JOINTS_0'] = glb.add_accessor(
        doc, views, piece['joints'], target=34962)
    primitive['attributes']['WEIGHTS_0'] = glb.add_accessor(
        doc, views, piece['weights'].astype(np.float32), target=34962)
    out = os.path.join(tempfile.mkdtemp(), 'candidate.vrm')
    glb.save(out, doc, glb.rebuild(doc, views))
    return out


def worst(path):
    """The cloth's worst edge growth over every bend, threshold ignored."""
    return max(g for (mesh, prim, _, _, g)
               in verify.torn_bindings(path, limit=-1e9)
               if (mesh, prim) == CLOTH)


def sleeve_hold(path):
    """The median lower-arm weight of the vertices the sleeve is made of."""
    doc, views = load(path)
    joints = doc['skins'][humanoid.skin_of_mesh(doc, CLOTH[0])]['joints']
    names = [doc['nodes'][j].get('name', '') for j in joints]
    _, piece = refit.piece_of(doc, views, *CLOTH)
    dense = np.zeros((len(piece['joints']), len(names)))
    for column in range(4):
        np.add.at(dense, (np.arange(len(dense)), piece['joints'][:, column]),
                  piece['weights'][:, column])
    column = dense[:, names.index('J_Bip_L_LowerArm')]
    return float(np.median(column[column > 0.5]))


def diffusion(src, passes):
    doc, views = load(src)
    primitive, piece, _ = parts(doc, views)
    if passes:
        garment.smooth_weights(piece, passes)
    return written(doc, views, primitive, piece)


def nearest_torso(src, passes):
    """Replace the void's weights with the nearest torso vertex's, then diffuse."""
    doc, views = load(src)
    primitive, piece, pool = parts(doc, views)
    joints = doc['skins'][humanoid.skin_of_mesh(doc, CLOTH[0])]['joints']
    slot = {node: i for i, node in enumerate(joints)}
    arms = set()
    for root in refit.CHAIN_ROOTS:
        arms |= {slot[n] for n in joints
                 if n in refit.descendants(doc, humanoid.bones(doc)[root])}
    pool_w = []
    for name, prim in BODY:
        _, part = refit.piece_of(doc, views, name, prim)
        # The body meshes carry their own skins, wider than the cloth's; a slot
        # index means a different bone in each, so translate by node and drop
        # what the cloth cannot address.
        own = doc['skins'][humanoid.skin_of_mesh(doc, name)]['joints']
        into = np.array([slot.get(node, -1) for node in own])
        dense = np.zeros((len(part['joints']), len(joints)))
        for column in range(4):
            target = into[part['joints'][:, column]]
            live = target >= 0
            np.add.at(dense, (np.arange(len(dense))[live], target[live]),
                      part['weights'][:, column][live])
        pool_w.append(dense)
    pool_w = np.vstack(pool_w)
    torso = pool_w[:, sorted(arms)].sum(axis=1) < 0.15
    distance = refit.body_distance(piece['pos'], pool)
    hang = pool_w[torso][cKDTree(pool[torso]).query(piece['pos'])[1]]
    dense = np.zeros((len(piece['joints']), len(joints)))
    for column in range(4):
        np.add.at(dense, (np.arange(len(dense)), piece['joints'][:, column]),
                  piece['weights'][:, column])
    alpha = np.clip((distance - 0.040) / (0.090 - 0.040), 0, 1)[:, None]
    dense = (1 - alpha) * dense + alpha * hang
    keep_top(piece, dense)
    if passes:
        garment.smooth_weights(piece, passes)
    return written(doc, views, primitive, piece)


def harmonic(src, anchor_m, iterations):
    """Hold the on-body cloth fixed and solve the void from it."""
    doc, views = load(src)
    primitive, piece, pool = parts(doc, views)
    joints = doc['skins'][humanoid.skin_of_mesh(doc, CLOTH[0])]['joints']
    seam, edges = garment.welded_edges(piece)
    n = int(seam.max()) + 1
    dense = np.zeros((n, len(joints)))
    for column in range(4):
        np.add.at(dense, (seam, piece['joints'][:, column]),
                  piece['weights'][:, column].astype(np.float64))
    dense /= np.bincount(seam, minlength=n)[:, None]
    distance = refit.body_distance(piece['pos'], pool)
    welded = np.full(n, np.inf)
    np.minimum.at(welded, seam, distance)
    anchor = welded <= anchor_m
    degree = np.bincount(edges.ravel(), minlength=n).astype(np.float64)
    degree[degree == 0] = 1.0
    fixed = dense.copy()
    for _ in range(iterations):
        acc = np.zeros_like(dense)
        np.add.at(acc, edges[:, 0], dense[edges[:, 1]])
        np.add.at(acc, edges[:, 1], dense[edges[:, 0]])
        dense = np.where(anchor[:, None], fixed, acc / degree[:, None])
    keep_top(piece, dense[seam])
    return written(doc, views, primitive, piece)


def keep_top(piece, dense, keep=4):
    top = np.argsort(-dense, axis=1)[:, :keep]
    kept = np.take_along_axis(dense, top, axis=1)
    total = kept.sum(axis=1, keepdims=True)
    piece['joints'] = top.astype(np.uint16)
    piece['weights'] = (kept / np.where(total == 0, 1.0, total)).astype(np.float32)


def shed(src, near, far, shed_passes, weight_passes):
    out = os.path.join(tempfile.mkdtemp(), 'refit.vrm')
    refit.apply(src, out, cloth=(CLOTH,), body=BODY, near=near, far=far,
                shed_passes=shed_passes, weight_passes=weight_passes)
    return out


def main(src):
    print(f'model {src}')
    print(f'  sha256 {__import__("hashlib").sha256(open(src, "rb").read()).hexdigest()}')
    print()
    print('== 修法比較（Tops.baked 全彎曲最壞邊）')
    print(f'  {"原始":38s} {worst(src):8.2f} mm')
    for passes in (2, 4, 8, 16, 24, 32):
        print(f'  {f"garment.smooth_weights {passes} pass":38s} '
              f'{worst(diffusion(src, passes)):8.2f} mm')
    for passes in (8, 16):
        print(f'  {f"最近軀幹頂點 + {passes} pass":38s} '
              f'{worst(nearest_torso(src, passes)):8.2f} mm')
    for iterations in (200, 600, 2000):
        print(f'  {f"調和場 anchor 45mm {iterations} 迭代":38s} '
              f'{worst(harmonic(src, 0.045, iterations)):8.2f} mm')
    for sp, wp in ((0, 0), (0, 12), (24, 0)):
        print(f'  {f"refit shed {sp} pass / weight {wp} pass":38s} '
              f'{worst(shed(src, 0.045, 0.075, sp, wp)):8.2f} mm')
    print()
    print('== refit 的 ramp 與 pass 數（門檻 25 mm）')
    print(f'  {"near":>5s} {"far":>5s} {"shed":>5s} {"weight":>7s} '
          f'{"最壞邊":>9s} {"袖子下臂":>9s}')
    for near, far, sp, wp in ((0.045, 0.075, 20, 12), (0.045, 0.075, 24, 10),
                              (0.045, 0.075, 24, 12), (0.045, 0.075, 24, 14),
                              (0.045, 0.075, 28, 12), (0.045, 0.075, 32, 12),
                              (0.040, 0.070, 24, 12), (0.050, 0.080, 24, 12),
                              (0.045, 0.075, 24, 16), (0.045, 0.075, 40, 12)):
        path = shed(src, near, far, sp, wp)
        print(f'  {near * 1000:5.0f} {far * 1000:5.0f} {sp:5d} {wp:7d} '
              f'{worst(path):9.2f} {sleeve_hold(path):9.3f}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
