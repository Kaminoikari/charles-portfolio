"""Turn the base model's back curtain into two tails, geometry and rig together.

The reference wears twintails. This model wore long hair that had been *named*
twintails: partition.py splits the back mass down the middle into
Hair_Twintail_L and Hair_Twintail_R, the ribbons from blender/hairbow.py sit on
top of the split, and from the front it passes. From the back it does not, and
the part map says why -- at waist height those two parts own 3,250 and 3,221
pixels each, side by side with no gap, which is a curtain. Behind it the black
cardigan is fully modelled and completely hidden.

The rig said the same thing more plainly: there is ONE hair chain down the back,
root node 27, six joints from y=1.325 to y=0.768, and it starts at x=-0.026,
which is the middle. No rotation of any existing bone can make two tails out of
one chain in the centre, so this adds two, one under each tie, and moves both the
vertices and their weights onto them.

Three things have to agree afterwards or the model breaks in a way that only
shows in motion:
  - the vertices sit on the new axis,
  - the joints sit on the same axis, so the spring swings where the hair is,
  - each joint's inverse bind matrix is the inverse of its NEW world transform.
Skip the third and the hair renders in the right place at rest and explodes the
moment anything moves.
"""
import numpy as np

import glb

# The tie the ribbons are already wrapped around, from blender/hairbow.py. If
# that moves, this moves with it.
TIE_X, TIE_Y, TIE_Z = 0.072, 1.450, 0.086
DROP = 0.690          # tie to tip; the curtain's own lowest vertex is y=0.749
SEGMENTS = 6          # one more than the chain it replaces, same segment length
BLEND = 0.040         # above the tie the scalp is left alone
TAIL_HIT_RADIUS = 0.035


def axis(side, t):
    """Where the tail's centre line is, a fraction t of the way down.

    The outward drift is the whole trick and the first attempt did not have
    enough of it. At 85mm the two tails still met on the spine -- the left one
    reached x=+0.030 -- and the waist showed nine pixels of cardigan. A tail has
    to clear the torso's own half-width, about 110mm at the waist and 190mm once
    the skirt flares, or it is a curtain with a seam down it. 125mm of drift on
    top of the 75mm tie puts the inner edge outside the ribs.
    """
    return np.array([side * (TIE_X + 0.125 * t),
                     TIE_Y - DROP * t,
                     TIE_Z + 0.040 * t])


def thickness(t):
    """Radius of the bundle. Widest below the tie, tapering to the tip."""
    return 0.042 + 0.034 * np.sin(np.pi * np.clip(t, 0.0, 1.0))


def _prims(doc, manifest, part):
    mesh = next(m for m in doc['meshes'] if m.get('name') == manifest[part]['mesh'])
    return [mesh['primitives'][i] for i in manifest[part]['primitives']]


def _overwrite(doc, views, index, array):
    """Replace an accessor's data in place.

    Only safe because every one of these accessors owns its bufferView outright:
    offset 0, no byteStride, length exactly the array. Checked rather than
    assumed, because writing past a shared view would corrupt a neighbour.
    """
    acc = doc['accessors'][index]
    bv = doc['bufferViews'][acc['bufferView']]
    array = np.ascontiguousarray(array)
    if acc.get('byteOffset', 0) or bv.get('byteStride') or bv['byteLength'] != array.nbytes:
        raise SystemExit(f'accessor {index} 不是獨佔的 bufferView，不能就地覆寫')
    views[acc['bufferView']] = bytearray(array.tobytes())
    if 'min' in acc:
        acc['min'] = [float(v) for v in array.min(axis=0)]
        acc['max'] = [float(v) for v in array.max(axis=0)]


def _chain(doc, head, side, name):
    """Append a joint chain under the head, following axis().

    Returns (node indices, their world positions). The world positions are
    returned rather than looked up afterwards, and that is the whole point: the
    first version derived them by walking the parent map, which had been built
    before these nodes existed, so every one of them resolved to its own local
    translation as though it sat at the scene root. The inverse bind matrices
    came out wrong by the head's height, the rest pose still rendered correctly
    because a rest render reads POSITION and never skins, and the hair shot
    vertically off the top of the frame the moment any clip played.

    Every node is a pure translation with no rotation, which is what the chain it
    replaces was, and it keeps the inverse bind matrix a plain negated position
    instead of a matrix inversion.
    """
    made, worlds, prev = [], [], None
    for k in range(SEGMENTS + 1):
        world = axis(side, k / SEGMENTS)
        local = world - (prev if prev is not None else head)
        doc['nodes'].append({'name': f'{name}{k}',
                             'translation': [float(v) for v in local]})
        idx = len(doc['nodes']) - 1
        if made:
            doc['nodes'][made[-1]].setdefault('children', []).append(idx)
        made.append(idx)
        worlds.append(world)
        prev = world
    return made, worlds


def apply(doc, views, manifest, parts=('Hair_Twintail_L', 'Hair_Twintail_R')):
    """Rebuild the back hair as two tails. Returns what it moved, per part."""
    nodes = doc['nodes']
    skin = doc['skins'][0]
    joints = skin['joints']

    head_node = next(b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']
                     if b['bone'] == 'head')
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}

    def world_of(i):
        p = np.zeros(3)
        while True:
            n = nodes[i]
            if n.get('rotation') and list(n['rotation']) != [0, 0, 0, 1]:
                raise SystemExit(f'節點 {i} 有旋轉，這裡的平移假設不成立')
            p = p + np.array(n.get('translation', [0, 0, 0]), dtype=np.float64)
            if i not in parent:
                return p
            i = parent[i]

    head_world = world_of(head_node)

    # The chain being replaced, as skin-joint indices, deepest last.
    old = [27]
    while nodes[old[-1]].get('children'):
        old.append(nodes[old[-1]]['children'][0])
    old_slots = [joints.index(n) for n in old]

    ibm = glb.read_accessor(doc, views, skin['inverseBindMatrices']).reshape(-1, 4, 4)
    report = {}

    for part in parts:
        prims = _prims(doc, manifest, part)
        pos = [glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
               for pr in prims]
        side = float(np.sign(np.mean(np.vstack(pos)[:, 0])))

        chain, chain_world = _chain(doc, head_world, side,
                                    f'HairTail{"L" if side < 0 else "R"}_')
        doc['nodes'][head_node].setdefault('children', []).append(chain[0])
        new_slots = []
        for i, world in zip(chain, chain_world):
            joints.append(i)
            m = np.eye(4)
            m[:3, 3] = -world
            ibm = np.concatenate([ibm, m.T[None]])      # glTF matrices are column-major
            new_slots.append(len(joints) - 1)

        # Where the curtain's own centre is at each height, so the tail is built
        # from the cloth that was actually there rather than from the mesh origin.
        every = np.vstack(pos)
        below = every[every[:, 1] <= TIE_Y]
        edges = np.linspace(below[:, 1].min(), TIE_Y, 24)
        mids = 0.5 * (edges[:-1] + edges[1:])
        centre = np.array([below[(below[:, 1] >= a) & (below[:, 1] < b)][:, [0, 2]].mean(axis=0)
                           if ((below[:, 1] >= a) & (below[:, 1] < b)).sum() else [np.nan, np.nan]
                           for a, b in zip(edges[:-1], edges[1:])])
        for c in range(2):                               # carry the last good value
            good = ~np.isnan(centre[:, c])
            centre[:, c] = np.interp(mids, mids[good], centre[good, c])
        # The 90th percentile of the distance to the centre, not the mean. The
        # mean was the second mistake: a flat sheet 300mm across has a mean
        # radius of about 90mm, which is roughly the radius a tail should have,
        # so the scale came out near 1 and the sheet stayed a sheet. What has to
        # come down is the sheet's REACH, and that is its outer edge.
        spread = np.array([np.percentile(np.linalg.norm(
            below[(below[:, 1] >= a) & (below[:, 1] < b)][:, [0, 2]]
            - centre[k], axis=1), 90)
            if ((below[:, 1] >= a) & (below[:, 1] < b)).sum() else np.nan
            for k, (a, b) in enumerate(zip(edges[:-1], edges[1:]))])
        spread = np.interp(mids, mids[~np.isnan(spread)], spread[~np.isnan(spread)])

        moved = 0.0
        for pr, p in zip(prims, pos):
            t = np.clip((TIE_Y - p[:, 1]) / DROP, 0.0, 1.0)
            fade = np.clip((TIE_Y + BLEND - p[:, 1]) / BLEND, 0.0, 1.0)
            cx = np.interp(p[:, 1], mids, centre[:, 0])
            cz = np.interp(p[:, 1], mids, centre[:, 1])
            sp = np.maximum(np.interp(p[:, 1], mids, spread), 1e-4)
            r = np.minimum(thickness(t) / sp, 1.0)
            a = np.stack([side * (TIE_X + 0.125 * t), p[:, 1], TIE_Z + 0.040 * t], axis=1)

            out = p.copy()
            out[:, 0] = a[:, 0] + (p[:, 0] - cx) * r
            out[:, 2] = a[:, 2] + (p[:, 2] - cz) * r
            out = p + (out - p) * fade[:, None]
            moved = max(moved, float(np.abs(out - p).max()))
            _overwrite(doc, views, pr['attributes']['POSITION'], out.astype(np.float32))

            if 'NORMAL' in pr['attributes']:
                n = glb.read_accessor(doc, views, pr['attributes']['NORMAL']).astype(np.float64)
                # A scale of r across the horizontal plane sends normals through
                # its inverse transpose, which for diag(r,1,r) is diag(1/r,1,1/r).
                inv = np.where(fade > 0, 1.0 / np.maximum(r, 1e-3), 1.0)
                n = np.stack([n[:, 0] * inv, n[:, 1], n[:, 2] * inv], axis=1)
                n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
                _overwrite(doc, views, pr['attributes']['NORMAL'], n.astype(np.float32))

            j = glb.read_accessor(doc, views, pr['attributes']['JOINTS_0']).copy()
            for a_slot, b_slot in zip(old_slots, new_slots):
                j[j == a_slot] = b_slot
            _overwrite(doc, views, pr['attributes']['JOINTS_0'], j)

        report[part] = {'side': side, 'moved_mm': moved * 1000, 'chain': chain}

    skin['inverseBindMatrices'] = glb.add_accessor(
        doc, views, ibm.reshape(-1, 16).astype(np.float32))

    # Every skin, not just skins[0]. The VRoid export carries three -- face,
    # body and hair -- over the same joint list, and the hair mesh is on the
    # third. Appending the tail bones to the first alone left the rewritten
    # JOINTS_0 pointing at slots 125..136 of a 125-slot skin. Nothing in this
    # pipeline noticed, because it skins from skins[0] throughout; three.js
    # loaded the file, reported all 54 humanoid bones, and then threw reading
    # `skeleton.bones[i].matrixWorld` the moment it drew a frame -- the model
    # was unusable in a browser and every gate here was green.
    for other in doc['skins']:
        if other is skin or other['joints'] == joints:
            continue
        if other['joints'] != joints[:len(other['joints'])]:
            raise SystemExit('skin 的關節列表不是共用前綴，新骨鏈無法安全附加')
        other['joints'] = list(joints)
        other['inverseBindMatrices'] = skin['inverseBindMatrices']

    # The spring that drove the single centre chain now drives the two tails.
    secondary = doc['extensions']['VRM']['secondaryAnimation']
    for group in secondary['boneGroups']:
        if old[0] in group.get('bones', []):
            group['bones'] = [report[p]['chain'][0] for p in report]
            # The source curtain used a 96mm collision radius. The two rebuilt
            # tails are much narrower, and keeping that radius places their
            # first two segments inside the head colliders at rest. three-vrm
            # resolves the overlap on its first physics frame as a visible
            # snap, then repeats it whenever a motion brings the head back
            # across the collider boundary.
            group['hitRadius'] = TAIL_HIT_RADIUS
            # Even with a fitted radius, collider projection produces 27°
            # single-frame jumps during dance. Free tail springs remain smooth
            # and keep their inertia, so they do not project against the source
            # model's head and arm collider set.
            group['colliderGroups'] = []
            group['comment'] = 'Twintails'

    # The remaining VRoid HairJoint chains only drive small upper-hair tufts.
    # During quick mocap they overshoot by roughly 29 degrees in one 60 Hz
    # frame, producing the visible twitch. The rebuilt HairTail chains retain
    # secondary motion, while these short tufts follow the head rigidly.
    secondary['boneGroups'] = [
        group for group in secondary['boneGroups']
        if not any(
            doc['nodes'][root].get('name', '').startswith('HairJoint-')
            for root in group.get('bones', ())
        )
    ]
    prune_stranded_collider_groups(doc)
    return report


def prune_stranded_collider_groups(doc):
    """Drop collider groups no spring references, remapping the survivors.

    The two edits above orphan most of the source model's collider set: the
    tails stop referencing the head and arm groups, and the removed HairJoint
    springs take their references with them. Bone groups address collider
    groups BY INDEX, so the survivors' references must be rewritten in the
    same pass that compacts the list -- dropping without remapping would point
    the skirt at whatever slid into positions 10 and 11.
    """
    secondary = doc['extensions']['VRM']['secondaryAnimation']
    groups = secondary.get('colliderGroups', [])
    used = sorted({index
                   for group in secondary.get('boneGroups', [])
                   for index in group.get('colliderGroups', [])})
    if len(used) == len(groups):
        return []
    remap = {old_index: new_index for new_index, old_index in enumerate(used)}
    removed = [(index, doc['nodes'][groups[index].get('node')].get('name', ''))
               for index in range(len(groups)) if index not in remap]
    secondary['colliderGroups'] = [groups[index] for index in used]
    for group in secondary.get('boneGroups', []):
        group['colliderGroups'] = [remap[index]
                                   for index in group.get('colliderGroups', [])]
    return removed
