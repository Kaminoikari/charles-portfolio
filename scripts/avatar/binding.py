"""How a piece is skinned, decided from what the piece is.

Until 2026-09-06 four strategies lived in four places and a part got whichever
one its author happened to call: garment.shell copied the body's own rows
(inherit), garment.bind copied the nearest skin vertex (nearest), every
parametric constructor tiled one row (single), and a drape() inside build()
faded the nearest rows into the two upper legs down a skirt. Nothing recorded
which a part got and nothing tested the choice, so a second body would have
inherited this one's guesses. This module takes the choice from measurements,
writes it into the manifest, and is the one place where skinning is decided.

Rules, in order (`choose`):

  origin 'shell'  -> inherit  the piece was offset from this body's skin and
                              already carries the rows of the vertices it came
                              from
  annulus band    -> drape    some 1cm band below the crotch line covers every
                              one of DRAPE_SECTORS bearings round the hips axis
                              as one ring (min radius / max radius at least
                              DRAPE_ANNULUS_MIN): cloth that surrounds both
                              legs has to follow both, and hang off the hips
                              in between
  one joint       -> single   every nearest skin vertex is wholly on the same
                              joint: the piece sits on a rigid region and moves
                              with that bone alone
  otherwise       -> nearest  each vertex copies the skin vertex nearest to it,
                              diffused `smooth` passes over its own edges when
                              the caller asks (the armpit, see garment.bind)

The thresholds were read off the real build, not chosen
(evidence/binding-0906.md). Both skirts' best band below the crotch covers all
twelve bearings at an annulus ratio of 0.65-0.79; the socks and the shoes
together also cover all twelve, at 0.16-0.20, because two feet either side
of the axis reach every bearing without ever being one ring. The plan's
"both sides at least 20%" reading of the same idea fails twice on this body:
the left thigh band takes 21% of its nearest vertices from the RIGHT leg
(the inner thigh's nearest skin is the other leg) and the vendor skirt's
upper primitive takes 1% from each. Every head accessory sits on skin that is
1.0 on the head everywhere; the vendor's neck ribbon sits on 0.99 upperChest
with a 1% shoulder blend and stays nearest, which is why "wholly on one
joint" is exact rather than a variance threshold. The plan's 60mm diameter
cap on `single` is not here: the buns are 86-161mm across and rigid to the
head, and what the cap stood for -- not straddling a joint -- is what the
one-joint test measures directly.

Slots are body-skin slots throughout; `apply` translates them into the skin
of the mesh the piece is attached to, by joint node. VRoid's three skins list
the same joints, so that is the identity here and a real translation on a
body whose hair skin lists fewer.
"""
import numpy as np
from scipy.spatial import cKDTree

import garment
import humanoid

STRATEGIES = ('inherit', 'nearest', 'single', 'drape')
# What partition.py stamps on every part the source file already skinned.
EXPORTED = {'strategy': 'inherit', 'reason': 'skinned by the source file (VRoid export)'}

DRAPE_SECTORS = 12          # bearings round the hips axis a band has to reach
DRAPE_ANNULUS_MIN = 0.5     # min radius / max radius within that band
DRAPE_BAND = 0.01           # metres per band
DRAPE_BAND_MIN_VERTICES = 6
CROTCH_SHARE = 0.25         # crotch line = hip - CROTCH_SHARE * (hip - knee)
# The drape's fade, from build.py's drape() as it was: the share of a hem
# vertex handed to the legs, and the half-width over which left fades to right.
DRAPE_LEG_SHARE = 0.75
DRAPE_SIDE_X = 0.12
LEAD_TOP = 3                # joints named in a decision's `lead`
TIE = 1e-9                  # metres; candidates this close are re-ranked exactly


def tree_of(pos):
    return cKDTree(np.asarray(pos, dtype=np.float64))


def nearest(tree, pool_pos, q):
    """Index of the pool vertex nearest each row of `q`.

    Ties go to the lowest index, exactly as the dense argmin this replaced
    resolved them, and a VRoid body is full of ties: every vertex along a UV
    seam is duplicated. The tree's own answer on an exact tie is whichever
    leaf it visited first, and on a pool with duplicated positions it differs
    from the argmin on a third of the queries (binding_test.Nearest). So every
    candidate within TIE of the nearest distance is re-ranked by the same
    float64 squared distance the argmin used, lowest index first.
    """
    q = np.asarray(q, dtype=np.float64)
    pool_pos = np.asarray(pool_pos, dtype=np.float64)
    d, idx = tree.query(q)
    out = np.asarray(idx, dtype=np.int64).copy()
    for i, cand in enumerate(tree.query_ball_point(q, d + TIE)):
        if len(cand) > 1:
            cand = np.sort(np.asarray(cand, dtype=np.int64))
            exact = ((q[i][None, :] - pool_pos[cand]) ** 2).sum(axis=1)
            out[i] = cand[int(exact.argmin())]
    return out


def context(doc, pool, manifest, landmarks, drape):
    """Everything a decision reads, computed once per build.

    `drape` is (top_y, hem_y): the band over which a draped piece fades from
    the skin's own rows into the legs. build() hands it the skirt's waist and
    hem, so the vendor's skirt fades over the same heights the hand-built one
    did.
    """
    skin = doc['skins'][humanoid.body_skin(doc, manifest)]
    bones = humanoid.bones(doc)
    node_bone = humanoid.node_bone(doc)
    names = [node_bone.get(n) or doc['nodes'][n].get('name') or f'node {n}'
             for n in skin['joints']]
    hips = humanoid.rest_world(doc)[bones['hips']][:3, 3]
    hip, knee = landmarks['hip'], landmarks['knee']
    legs = None
    if 'leftUpperLeg' in bones and 'rightUpperLeg' in bones:
        legs = (skin['joints'].index(bones['leftUpperLeg']),
                skin['joints'].index(bones['rightUpperLeg']))
    return {
        'doc': doc, 'pool': pool, 'tree': tree_of(pool['pos']),
        'skin': skin, 'names': names, 'legs': legs,
        'axis': (float(hips[0]), float(hips[2])),
        'crotch': hip - CROTCH_SHARE * (hip - knee),
        'drape': (float(drape[0]), float(drape[1])),
        'slots': {},
    }


def drape_band(ctx, pos):
    """The best 1cm band below the crotch line: (y, coverage, annulus), or None.

    Coverage is the share of DRAPE_SECTORS bearings round the hips axis the
    band's vertices reach; annulus is the band's smallest radius over its
    largest. Ranked by coverage first, then annulus.
    """
    ax, az = ctx['axis']
    top = min(ctx['crotch'], float(pos[:, 1].max()))
    best = None
    y = float(pos[:, 1].min())
    while y < top:
        band = (pos[:, 1] >= y) & (pos[:, 1] < y + DRAPE_BAND)
        if band.sum() >= DRAPE_BAND_MIN_VERTICES:
            dx, dz = pos[band, 0] - ax, pos[band, 2] - az
            bearing = (np.arctan2(dz, dx) + np.pi) / (2 * np.pi / DRAPE_SECTORS)
            sectors = np.floor(bearing).astype(int) % DRAPE_SECTORS
            coverage = len(set(sectors.tolist())) / DRAPE_SECTORS
            r = np.hypot(dx, dz)
            annulus = float(r.min() / r.max()) if r.max() > 0 else 0.0
            if best is None or (coverage, annulus) > best[1:]:
                best = (y, coverage, annulus)
        y += DRAPE_BAND
    return best


def signals(ctx, pieces):
    """What the chooser reads, measured on the union of `pieces`.

    A part can arrive as several primitives (the vendor's skirt is two), and
    the decision is one per part, so the measurement is on all of them: the
    skirt's upper primitive on its own stops at the hip joint and would copy
    the skin.
    """
    pos = np.concatenate([np.asarray(p['pos'], dtype=np.float64) for p in pieces])
    pool = ctx['pool']
    near = nearest(ctx['tree'], pool['pos'], pos)
    rows_j = np.asarray(pool['joints'])[near]
    rows_w = np.asarray(pool['weights'], dtype=np.float64)[near]
    lead_slot = rows_j[np.arange(len(near)), rows_w.argmax(axis=1)]
    total = np.zeros(len(ctx['names']))
    for c in range(rows_j.shape[1]):
        np.add.at(total, rows_j[:, c], rows_w[:, c])
    share = total / total.sum() if total.sum() > 0 else total
    lead = {ctx['names'][s]: round(float(share[s]), 2)
            for s in np.argsort(-share)[:LEAD_TOP] if share[s] > 0}
    whole = rows_w.max(axis=1) >= 1.0 - 1e-6
    one = int(lead_slot[0]) if whole.all() and (lead_slot == lead_slot[0]).all() else None
    return {'n': len(pos), 'near': near, 'lead_slot': lead_slot, 'lead': lead,
            'one_joint': one, 'band': drape_band(ctx, pos) if ctx['legs'] else None}


def choose(ctx, sig, origin, smooth=0):
    """A Decision: {'strategy', 'reason', 'lead'} plus 'smooth' for a
    diffused nearest and 'joint' for a single."""
    if origin == 'shell':
        return {'strategy': 'inherit', 'lead': sig['lead'],
                'reason': "offset from this body's own skin; keeps the rows of "
                          'the vertices it was shelled from'}
    band = sig['band']
    if band and band[1] >= 1.0 and band[2] >= DRAPE_ANNULUS_MIN:
        depth = (ctx['crotch'] - band[0]) * 1000
        return {'strategy': 'drape', 'lead': sig['lead'],
                'reason': f'a ring round both legs {depth:.0f}mm below the crotch '
                          f'line (all {DRAPE_SECTORS} bearings, annulus {band[2]:.2f}): '
                          'hangs off the hips and follows both legs'}
    if sig['one_joint'] is not None:
        name = ctx['names'][sig['one_joint']]
        return {'strategy': 'single', 'joint': name, 'lead': {name: 1.0},
                'reason': f'every nearest skin vertex is wholly on {name}: rigid to it'}
    decision = {'strategy': 'nearest', 'lead': sig['lead'],
                'reason': 'copies the skin vertex nearest each vertex'}
    if smooth:
        decision['smooth'] = int(smooth)
        decision['reason'] += f', diffused {int(smooth)} passes over its own edges'
    return decision


def decide(ctx, pieces, origin, smooth=0):
    return choose(ctx, signals(ctx, pieces), origin, smooth)


def override(ctx, pieces, strategy, reason, smooth=0):
    """A caller's decision, with what the chooser would have said kept beside
    it so the manifest shows every deviation."""
    if strategy not in STRATEGIES:
        raise ValueError(f'unknown binding strategy {strategy!r}')
    chosen = decide(ctx, pieces, 'param', smooth)
    decision = {'strategy': strategy, 'lead': chosen['lead'],
                'reason': f'{reason} (chooser: {chosen["strategy"]})',
                'chosen': chosen['strategy']}
    if strategy == 'nearest' and smooth:
        decision['smooth'] = int(smooth)
    return decision


def _slots(ctx, mesh):
    """Body-skin slot -> slot in the skin of `mesh`, or None when the two
    skins list the same joints and nothing needs translating."""
    if mesh not in ctx['slots']:
        target = ctx['doc']['skins'][humanoid.skin_of_mesh(ctx['doc'], mesh)]
        if target['joints'] == ctx['skin']['joints']:
            ctx['slots'][mesh] = None
        else:
            where = {node: i for i, node in enumerate(target['joints'])}
            ctx['slots'][mesh] = np.array([where.get(node, -1) for node in ctx['skin']['joints']],
                                          dtype=np.int64)
    return ctx['slots'][mesh]


def _translate(ctx, mesh, joints, weights):
    table = _slots(ctx, mesh)
    if table is None:
        return joints
    out = table[np.asarray(joints, dtype=np.int64)]
    live = np.asarray(weights) > 0
    if (out[live] < 0).any():
        missing = sorted({ctx['names'][int(s)] for s in np.asarray(joints)[live & (out < 0)]})
        raise humanoid.BadRig(f'{mesh} 的 skin 沒有 {", ".join(missing)}，權重搬不過去')
    out[~live] = 0
    return out.astype(np.asarray(joints).dtype)


def apply(ctx, piece, decision, mesh):
    """Write the decided rows into `piece`'s joints/weights, in place."""
    strategy = decision['strategy']
    pool = ctx['pool']
    q = np.asarray(piece['pos'], dtype=np.float64)
    if strategy == 'inherit':
        if len(piece.get('joints', ())) != len(q) or len(piece.get('weights', ())) != len(q):
            raise ValueError('inherit 需要部件自己帶著每個頂點的權重')
        return piece
    if strategy == 'single':
        slot = ctx['names'].index(decision['joint'])
        table = _slots(ctx, mesh)
        if table is not None:
            if table[slot] < 0:
                raise humanoid.BadRig(f'{mesh} 的 skin 沒有 {decision["joint"]}')
            slot = int(table[slot])
        piece['joints'] = np.tile(np.array([slot, 0, 0, 0], dtype=np.uint16), (len(q), 1))
        piece['weights'] = np.tile(np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32), (len(q), 1))
        return piece
    near = nearest(ctx['tree'], pool['pos'], q)
    if strategy == 'nearest':
        piece['joints'] = _translate(ctx, mesh, pool['joints'][near], pool['weights'][near])
        piece['weights'] = pool['weights'][near]
        if decision.get('smooth'):
            garment.smooth_weights(piece, decision['smooth'])
        return piece
    if strategy == 'drape':
        return _drape(ctx, piece, q, near, mesh)
    raise ValueError(f'unknown binding strategy {strategy!r}')


def _drape(ctx, piece, q, near, mesh):
    """Weight a skirt so it follows the body at the top and the legs below.

    Three failures got it here. Bound rigidly to the waist, the thigh walked
    straight through the front when the hip bent. Weighting it to the two
    upper legs fixed most of that and left the waistband pierced by the belly,
    because the waistband was on `hips` while the abdomen above it is driven
    by the spine: bend at the waist and the stomach swings forward while the
    band stays behind. Widening the band twice did nothing, since the gap was
    never the problem.

    So the top of the skirt simply borrows the body's own weights from the
    skin beneath it, whatever they happen to be, and the leg weights fade in
    going down. The known cost stays: a wide stride stretches the cloth
    between the legs, because there is no bone in the middle to hold it up.
    """
    if not ctx['legs']:
        raise humanoid.BadRig('drape 需要 leftUpperLeg 與 rightUpperLeg')
    pool = ctx['pool']
    left_j, right_j = ctx['legs']
    top_y, hem_y = ctx['drape']
    base_j, base_w = pool['joints'][near], pool['weights'][near]

    drop = np.clip((top_y - q[:, 1]) / max(top_y - hem_y, 1e-6), 0.0, 1.0)
    follow = DRAPE_LEG_SHARE * drop ** 1.5
    # About x = 0, not about the hips axis: this body's hips sit at
    # x = 4.2e-5 and subtracting that would move every skirt weight by a bit
    # for no visible reason. A body built off the axis belongs to Phase 6b.
    sx = np.clip(q[:, 0] / DRAPE_SIDE_X, -1.0, 1.0)
    left = (1.0 - sx) / 2.0

    joints = np.zeros((len(q), 4), dtype=np.uint16)
    weights = np.zeros((len(q), 4), dtype=np.float32)
    for i in range(len(q)):
        acc = {}
        for c in range(base_j.shape[1]):
            w = float(base_w[i, c]) * (1.0 - follow[i])
            if w > 0:
                acc[int(base_j[i, c])] = acc.get(int(base_j[i, c]), 0.0) + w
        for j, w in ((left_j, follow[i] * left[i]),
                     (right_j, follow[i] * (1.0 - left[i]))):
            if w > 0:
                acc[j] = acc.get(j, 0.0) + w
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top) or 1.0
        for c, (j, w) in enumerate(top):
            joints[i, c] = j
            weights[i, c] = w / total
    piece['joints'] = _translate(ctx, mesh, joints, weights)
    piece['weights'] = weights
    return piece
