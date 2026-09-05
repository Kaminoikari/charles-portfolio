# Read a VRM's skeleton without a renderer.
#
# Lived in ~/vtuber-kit/bin until 2026-09-05. That directory has no git
# history, and every gate in this pipeline (make.py, verify.py, selftest.py)
# calls compare(), so the module now lives beside the code that calls it;
# ~/vtuber-kit/bin/check_variants.py imports it from here. The move was not a
# plain copy: the kit's version read VRM 0.x only and told 1.0 files to
# re-export, and this one adds the 1.0 branch of human_bones plus vrm_version,
# forward_z, required_missing, expression_names and spring_bones (each with a
# mutation receipt in evidence/mutations-0905-humanoid.md).
#
# What it answers: is this file's humanoid rest pose the same as that file's.
# Variants exported from one VRoid project with the body sliders untouched share
# a skeleton, and that is what lets one set of motion clips serve all of them.
# "I did not touch the sliders" is a claim about a GUI session; the file is where
# it can actually be checked. (Sharing a skeleton does NOT make the clips free:
# their clearance numbers were measured against one body and have to be
# re-measured once per rig family. See avatarVariants.ts.)
#
# A VRM is a glb: a 12-byte header, then chunks, the first of which is the glTF
# JSON. Everything needed here -- the node tree and the humanoid bone map -- is
# in that JSON, so this needs no three.js, no browser, and no GPU. That matters
# on this machine specifically: its Playwright runs software WebGL, where
# rendered frames are unreliable but numbers read out of a file are not.
#
# Both VRM 0.x (`extensions.VRM`, humanoid map as a list of {bone, node}) and
# VRM 1.0 (`extensions.VRMC_vrm`, humanoid map as a dict keyed by bone name)
# are read. The two differ in more than the map's shape -- 1.0 faces +Z where
# 0.x faces -Z, and springs live in a different extension -- so the version is
# exposed too, for callers whose numbers depend on it.
import json
import math
import os
import struct

GLB_MAGIC = 0x46546C67   # 'glTF'
CHUNK_JSON = 0x4E4F534A  # 'JSON'

# Rest-pose coordinates written by an exporter are bit-identical between two
# exports of an untouched body, so this is a float-noise floor rather than a
# similarity threshold. A real slider change moves a bone by millimetres at
# least, and a millimetre in the shoulder is a hand through a face.
TOLERANCE = 1e-6

# The bones a VRM humanoid must have, per the spec's VRMRequiredHumanBoneName
# (@pixiv/three-vrm-core, 15 names). chest, neck, shoulders, toes and eyes are
# optional; a body without them is still a body the loader accepts.
REQUIRED = (
    'hips', 'spine', 'head',
    'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
)


class BadRig(Exception):
    """A file we cannot read a VRM skeleton out of, and why."""


def _name(doc: dict) -> str:
    return doc.get('_name', '這個檔')


def read(path: str) -> dict:
    """The glTF JSON chunk of a .vrm / .glb."""
    with open(path, 'rb') as fh:
        header = fh.read(12)
        if len(header) < 12:
            raise BadRig(f'{os.path.basename(path)} 太小，不是 glTF 檔。')
        magic, version, _ = struct.unpack('<III', header)
        if magic != GLB_MAGIC:
            raise BadRig(f'{os.path.basename(path)} 不是 glTF 二進位檔（glb／vrm）。')
        if version != 2:
            raise BadRig(f'{os.path.basename(path)} 是 glTF {version}，只支援 2。')
        # A copy that stopped halfway is the input this tool most has to expect,
        # and struct.unpack on a short read raises something check_variants does
        # not catch — one bad file would end the whole comparison and take the
        # other variants' results with it.
        chunk = fh.read(8)
        if len(chunk) < 8:
            raise BadRig(f'{os.path.basename(path)} 不完整：讀不到區塊標頭，'
                         '檔案可能複製到一半。')
        length, kind = struct.unpack('<II', chunk)
        if kind != CHUNK_JSON:
            raise BadRig(f'{os.path.basename(path)} 的第一個區塊不是 JSON。')
        body = fh.read(length)
        if len(body) < length:
            raise BadRig(
                f'{os.path.basename(path)} 不完整：檔頭說 JSON 區塊有 {length} '
                f'bytes，實際只讀到 {len(body)}。檔案可能複製到一半。')
        try:
            doc = json.loads(body)
        except ValueError as e:
            raise BadRig(f'{os.path.basename(path)} 的 JSON 讀不出來：{e}') from e
    doc['_name'] = os.path.basename(path)
    return doc


# ------------------------------------------------------------------ matrices ---
def _trs(node: dict) -> list:
    """A node's local transform as a row-major 4x4, from its TRS or its matrix.

    Rotation is not optional. A T-pose usually has identity rotations, so
    accumulating translations alone gives the right answer often enough to look
    correct and then quietly gives the wrong one for any rig that does not.
    """
    if 'matrix' in node:
        m = node['matrix']  # glTF stores column-major
        if len(m) != 16:
            raise BadRig(f'節點的 matrix 有 {len(m)} 個數字，應該是 16 個。')
        return [[m[0], m[4], m[8], m[12]],
                [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]],
                [m[3], m[7], m[11], m[15]]]

    tx, ty, tz = node.get('translation', (0.0, 0.0, 0.0))
    qx, qy, qz, qw = node.get('rotation', (0.0, 0.0, 0.0, 1.0))
    sx, sy, sz = node.get('scale', (1.0, 1.0, 1.0))

    r = [[1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
         [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
         [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)]]
    s = (sx, sy, sz)
    return [[r[i][0] * s[0], r[i][1] * s[1], r[i][2] * s[2], (tx, ty, tz)[i]]
            for i in range(3)] + [[0.0, 0.0, 0.0, 1.0]]


def _mul(a: list, b: list) -> list:
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)]
            for i in range(4)]


# ------------------------------------------------------------------- version ---
def vrm_version(doc: dict) -> str:
    """'0' for VRM 0.x (extensions.VRM), '1' for VRM 1.0 (extensions.VRMC_vrm).

    A file carrying both is read as 0.x: that is what three-vrm does, and a
    reader that picked the other one would disagree with the browser.
    """
    ext = doc.get('extensions') or {}
    if 'VRM' in ext:
        return '0'
    if 'VRMC_vrm' in ext:
        return '1'
    raise BadRig(f'{_name(doc)} 裡沒有 VRM 也沒有 VRMC_vrm 擴充，不是 VRM 檔。')


def forward_z(doc: dict) -> int:
    """Which way the model faces along world Z: -1 for VRM 0.x, +1 for VRM 1.0.

    The spec flipped this between versions. Every number measured in world
    space (reach, clearances, spring collider offsets) has to know which one
    it is looking at, and every retarget has to flip a VRM1-authored clip for a
    VRM0 body and leave it alone for a VRM1 one.
    """
    return -1 if vrm_version(doc) == '0' else 1


# ------------------------------------------------------------------ skeleton ---
def human_bones(doc: dict) -> dict:
    """Humanoid bone name -> node index, for either VRM version."""
    ext = doc.get('extensions') or {}
    if vrm_version(doc) == '0':
        bones = (ext['VRM'].get('humanoid') or {}).get('humanBones') or []
        return {b['bone']: b['node'] for b in bones if 'bone' in b and 'node' in b}
    bones = (ext['VRMC_vrm'].get('humanoid') or {}).get('humanBones') or {}
    return {name: b['node'] for name, b in bones.items()
            if isinstance(b, dict) and 'node' in b}


def required_missing(doc: dict) -> list:
    """The spec-required humanoid bones this file does not declare, in spec order."""
    have = human_bones(doc)
    return [b for b in REQUIRED if b not in have]


def expression_names(doc: dict) -> list:
    """The names of the file's expressions, in file order.

    VRM 0.x calls them blendShapeGroups; VRM 1.0 splits them into preset and
    custom expressions. Either way the list is what a lip-sync or emotion table
    looks names up in, and a body missing one silently stops making that face.
    """
    ext = doc.get('extensions') or {}
    if vrm_version(doc) == '0':
        master = ext['VRM'].get('blendShapeMaster') or {}
        return [g.get('name', '') for g in master.get('blendShapeGroups', [])]
    expr = ext['VRMC_vrm'].get('expressions') or {}
    return list((expr.get('preset') or {}).keys()) + list((expr.get('custom') or {}).keys())


def spring_bones(doc: dict) -> dict:
    """The file's spring bones in one shape for either version.

    Returns {'groups': [...], 'colliderGroups': [...]}. Each group carries
    `bones` (node indices, root first), `colliderGroups` (indices into the
    returned colliderGroups), and the group-level parameters `hitRadius`,
    `gravityPower`, `stiffness`, `dragForce`, `center`. Each collider group
    carries `colliders`, each of which is {node, offset: {x, y, z}, radius,
    shape}; `node` on the group itself is the shared node when every collider
    in it hangs off one node (always true for 0.x) and None otherwise.

    VRM 1.0 lets every joint in a spring carry its own parameters; the
    group-level numbers here are the ROOT joint's, and the raw per-joint list
    is kept under `joints` for callers that need the rest.

    Offsets are copied exactly as the file wrote them. VRM 0.x stores collider
    offsets with z negated relative to glTF (three-vrm's _v0Import flips it on
    load); this reader does not, so a caller placing a 0.x collider in world
    space has to negate z itself, as springsim.ts does.
    """
    ext = doc.get('extensions') or {}
    if vrm_version(doc) == '0':
        sec = ext['VRM'].get('secondaryAnimation') or {}
        groups = []
        for g in sec.get('boneGroups', []):
            groups.append({
                'name': g.get('comment', ''),
                'bones': list(g.get('bones', [])),
                'colliderGroups': list(g.get('colliderGroups', [])),
                'hitRadius': g.get('hitRadius'),
                'gravityPower': g.get('gravityPower'),
                'stiffness': g.get('stiffiness', g.get('stiffness')),
                'dragForce': g.get('dragForce'),
                'center': g.get('center'),
                'joints': None,
            })
        colliders = []
        for cg in sec.get('colliderGroups', []):
            node = cg.get('node')
            colliders.append({
                'node': node,
                'colliders': [{'node': node, 'offset': dict(c.get('offset', {})),
                               'radius': c.get('radius'), 'shape': 'sphere'}
                              for c in cg.get('colliders', [])],
            })
        return {'groups': groups, 'colliderGroups': colliders}

    sb = ext.get('VRMC_springBone') or {}
    raw_colliders = sb.get('colliders', [])

    def one(c):
        shape = c.get('shape') or {}
        kind = 'capsule' if 'capsule' in shape else 'sphere'
        s = shape.get(kind) or {}
        off = s.get('offset', [0.0, 0.0, 0.0])
        return {'node': c.get('node'),
                'offset': {'x': off[0], 'y': off[1], 'z': off[2]},
                'radius': s.get('radius'), 'shape': kind}

    colliders = []
    for cg in sb.get('colliderGroups', []):
        items = [one(raw_colliders[i]) for i in cg.get('colliders', [])
                 if 0 <= i < len(raw_colliders)]
        nodes = {c['node'] for c in items}
        colliders.append({'node': nodes.pop() if len(nodes) == 1 else None,
                          'colliders': items})
    groups = []
    for s in sb.get('springs', []):
        joints = s.get('joints', [])
        root = joints[0] if joints else {}
        groups.append({
            'name': s.get('name', ''),
            'bones': [j['node'] for j in joints if 'node' in j],
            'colliderGroups': list(s.get('colliderGroups', [])),
            'hitRadius': root.get('hitRadius'),
            'gravityPower': root.get('gravityPower'),
            'stiffness': root.get('stiffness'),
            'dragForce': root.get('dragForce'),
            'center': s.get('center'),
            'joints': joints,
        })
    return {'groups': groups, 'colliderGroups': colliders}


def rest_positions(doc: dict) -> dict:
    """Humanoid bone name -> world-space rest position, from the scene root."""
    bones = human_bones(doc)
    nodes = doc.get('nodes') or []
    scenes = doc.get('scenes') or []
    index = doc.get('scene', 0)
    if not 0 <= index < len(scenes):
        raise BadRig(
            f'{_name(doc)} 指定的場景是第 {index} 個，'
            f'但檔案裡只有 {len(scenes)} 個場景。這個匯出檔是壞的。')
    scene = scenes[index]

    world = {}
    stack = [(i, [[1.0 if r == c else 0.0 for c in range(4)] for r in range(4)])
             for i in scene.get('nodes', [])]
    while stack:
        idx, parent = stack.pop()
        if idx in world or idx >= len(nodes):
            continue
        try:
            local = _trs(nodes[idx])
        except BadRig as e:
            raise BadRig(f'{_name(doc)}：{e}') from e
        m = _mul(parent, local)
        world[idx] = m
        for child in nodes[idx].get('children', ()):
            stack.append((child, m))

    out = {}
    orphans = []
    for bone, idx in bones.items():
        if idx not in world:
            orphans.append(bone)
            continue
        m = world[idx]
        out[bone] = (round(m[0][3], 6), round(m[1][3], 6), round(m[2][3], 6))
    if orphans:
        raise BadRig(
            f'{_name(doc)} 的 humanoid 指到不在場景樹裡的節點：'
            f'{", ".join(sorted(orphans))}。這個匯出檔是壞的。')
    return out


def compare(a: dict, b: dict, tolerance: float = TOLERANCE) -> list:
    """Bones whose rest position differs, worst first.

    A bone present in one and missing from the other has no distance, and comes
    back with `distance` None rather than 0 — reporting 0 would read as "these
    match" in every summary that sorts or sums.
    """
    pa, pb = rest_positions(a), rest_positions(b)
    diffs = []
    for bone in sorted(set(pa) | set(pb)):
        if bone not in pa or bone not in pb:
            diffs.append({'bone': bone, 'distance': None,
                          'note': '只有一邊有這根骨頭'})
            continue
        d = math.dist(pa[bone], pb[bone])
        if d > tolerance:
            diffs.append({'bone': bone, 'distance': d,
                          'from': pa[bone], 'to': pb[bone]})
    diffs.sort(key=lambda d: (d['distance'] is not None, -(d['distance'] or 0)))
    return diffs
